import {
  Injectable,
  NotFoundException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma/prisma.service';
import { CacheManager } from '../../core/cache/cache.manager';
import { CreateProfileDto, UpdateProfileDto } from './dto';
import { S3Service } from '../../shared/services/s3.service';

@Injectable()
export class ProfilesService {
  private readonly bucket = process.env.S3_BUCKET || 'rukny-storage';
  private readonly logger = new Logger(ProfilesService.name);

  constructor(
    private prisma: PrismaService,
    private s3Service: S3Service,
    private readonly cacheManager: CacheManager,
  ) {}

  /**
   * Helper to serialize BigInt fields to numbers for JSON response
   */
  private serializeProfile<
    T extends { storageUsed?: bigint | number; storageLimit?: bigint | number },
  >(profile: T): T & { storageUsed: number; storageLimit: number } {
    return {
      ...profile,
      storageUsed: Number(profile.storageUsed || 0),
      storageLimit: Number(profile.storageLimit || 0),
    };
  }

  /**
   * Create a new user profile
   */
  async create(userId: string, createProfileDto: CreateProfileDto) {
    // Check if username already exists
    const existingProfile = await this.prisma.profile.findUnique({
      where: { username: createProfileDto.username },
    });

    if (existingProfile) {
      throw new ConflictException(
        `Username "${createProfileDto.username}" is already taken`,
      );
    }

    // Check if user already has a profile
    const userProfile = await this.prisma.profile.findUnique({
      where: { userId },
    });

    if (userProfile) {
      throw new ConflictException('User already has a profile');
    }

    // Create the profile
    const profile = await this.prisma.profile.create({
      data: {
        username: createProfileDto.username,
        bio: createProfileDto.bio,
        visibility: createProfileDto.visibility,
        name: createProfileDto.name,
        user: {
          connect: { id: userId },
        },
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
          },
        },
        socialLinks: {
          orderBy: { displayOrder: 'asc' },
        },
      },
    });

    return this.serializeProfile(profile);
  }

  /**
   * Find profile by username
   * ⚡ Performance: Cached for 5 minutes
   */
  async findByUsername(username: string, requesterId?: string) {
    const cacheKey = `profile:username:${username}`;

    return this.cacheManager.wrap(cacheKey, 300, async () => {
      const profile = await this.prisma.profile.findUnique({
        where: { username },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              bannerUrls: true,
            },
          },
          socialLinks: {
            orderBy: { displayOrder: 'asc' },
          },
        },
      });

      if (!profile) {
        throw new NotFoundException(
          `Profile with username "${username}" not found`,
        );
      }

      // Don't return email if profile is private and not the owner
      if (profile.visibility === 'PRIVATE' && profile.userId !== requesterId) {
        delete profile.user.email;
      }

      // Respect privacy settings for non-owners
      if (profile.userId !== requesterId) {
        if ((profile as any).hideEmail) {
          delete profile.user.email;
        }
      }

      // Get follow counts separately
      const [followersCount, followingCount] = await Promise.all([
        this.prisma.follows.count({
          where: { followingId: profile.userId },
        }),
        this.prisma.follows.count({
          where: { followerId: profile.userId },
        }),
      ]);

      // Convert banner keys to presigned URLs (for private S3 buckets)
      const bannerKeys = (profile.user.bannerUrls || []).filter(
        (key: string) => key && !key.startsWith('http'),
      );
      const bannerUrls =
        bannerKeys.length > 0
          ? await this.s3Service.getPresignedGetUrls(
              this.bucket,
              bannerKeys,
              3600,
            )
          : [];

      // Convert avatar and cover keys (if any) to presigned URLs
      let avatarUrl = (profile as any).avatar as string | undefined | null;
      let coverUrl = (profile as any).coverImage as string | undefined | null;

      // Handle legacy local paths (convert to full API URL or clear if invalid)
      const apiBaseUrl = process.env.API_BASE_URL || 'http://localhost:3001';
      
      if (avatarUrl && !avatarUrl.startsWith('http')) {
        // Check if it's a legacy local path
        if (avatarUrl.startsWith('/uploads/')) {
          // Legacy local paths are no longer supported, clear them
          // User needs to upload a new avatar via S3
          this.logger.warn(`Legacy local avatar path detected for user, clearing: ${avatarUrl}`);
          avatarUrl = null;
        } else {
          try {
            avatarUrl = await this.s3Service.getPresignedGetUrl(
              this.bucket,
              avatarUrl,
              3600,
            );
          } catch (e) {
            this.logger.warn(`Failed to get presigned URL for avatar: ${e}`);
            avatarUrl = null;
          }
        }
      }

      if (coverUrl && !coverUrl.startsWith('http')) {
        // Check if it's a legacy local path
        if (coverUrl.startsWith('/uploads/')) {
          // Legacy local paths are no longer supported, clear them
          this.logger.warn(`Legacy local cover path detected for user, clearing: ${coverUrl}`);
          coverUrl = null;
        } else {
          try {
            coverUrl = await this.s3Service.getPresignedGetUrl(
              this.bucket,
              coverUrl,
              3600,
            );
          } catch (e) {
            this.logger.warn(`Failed to get presigned URL for coverImage: ${e}`);
            coverUrl = null;
          }
        }
      }

      // Transform response to include _count and banners at profile level
      return this.serializeProfile({
        ...profile,
        avatar: avatarUrl,
        coverImage: coverUrl,
        banners: bannerUrls,
        _count: {
          followers: followersCount,
          following: followingCount,
        },
      });
    });
  }

  /**
   * Find profile by user ID
   */
  async findByUserId(userId: string) {
    const profile = await this.prisma.profile.findUnique({
      where: { userId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            phone: true,
            twoFactorEnabled: true,
            googleId: true,
            linkedinId: true,
            isDeactivated: true,
            deactivatedAt: true,
          },
        },
        socialLinks: {
          orderBy: { displayOrder: 'asc' },
        },
      },
    });

    if (!profile) {
      throw new NotFoundException('Profile not found');
    }

    // Convert avatar/cover to presigned URLs when needed
    try {
      let avatarUrl = (profile as any)?.avatar;
      let coverUrl = (profile as any)?.coverImage;
      
      // Handle legacy local paths - clear them since files don't exist
      if (avatarUrl && !avatarUrl.startsWith('http')) {
        if (avatarUrl.startsWith('/uploads/')) {
          this.logger.warn(`Legacy local avatar path detected, clearing: ${avatarUrl}`);
          avatarUrl = null;
        } else {
          avatarUrl = await this.s3Service.getPresignedGetUrl(
            this.bucket,
            avatarUrl,
            3600,
          );
        }
      }
      if (coverUrl && !coverUrl.startsWith('http')) {
        if (coverUrl.startsWith('/uploads/')) {
          this.logger.warn(`Legacy local cover path detected, clearing: ${coverUrl}`);
          coverUrl = null;
        } else {
          coverUrl = await this.s3Service.getPresignedGetUrl(
            this.bucket,
            coverUrl,
            3600,
          );
        }
      }
      return this.serializeProfile({
        ...profile,
        avatar: avatarUrl,
        coverImage: coverUrl,
      });
    } catch (e) {
      return this.serializeProfile(profile);
    }
  }

  /**
   * Update user profile
   */
  async update(userId: string, updateProfileDto: UpdateProfileDto) {
    const profile = await this.prisma.profile.findUnique({
      where: { userId },
    });

    if (!profile) {
      throw new NotFoundException(
        'Profile not found. Please create a profile first.',
      );
    }

    // Check username uniqueness if updating username
    if (
      updateProfileDto.username &&
      updateProfileDto.username !== profile.username
    ) {
      const existingProfile = await this.prisma.profile.findUnique({
        where: { username: updateProfileDto.username },
      });

      if (existingProfile) {
        throw new ConflictException(
          `Username "${updateProfileDto.username}" is already taken`,
        );
      }
    }

    // Update the profile
    const updatedProfile = await this.prisma.profile.update({
      where: { userId },
      data: updateProfileDto,
      include: {
        user: {
          select: {
            id: true,
            email: true,
          },
        },
        socialLinks: {
          orderBy: { displayOrder: 'asc' },
        },
      },
    });

    return this.serializeProfile(updatedProfile);
  }

  /**
   * Upload profile avatar
   */
  async uploadAvatar(userId: string, fileName: string) {
    const profile = await this.prisma.profile.findUnique({
      where: { userId },
    });

    if (!profile) {
      throw new NotFoundException(
        'Profile not found. Please create a profile first.',
      );
    }

    const updatedProfile = await this.prisma.profile.update({
      where: { userId },
      data: { avatar: fileName },
      include: {
        user: {
          select: {
            id: true,
            email: true,
          },
        },
      },
    });

    return this.serializeProfile(updatedProfile);
  }

  /**
   * Upload cover image
   */
  async uploadCover(userId: string, fileName: string) {
    const profile = await this.prisma.profile.findUnique({
      where: { userId },
    });

    if (!profile) {
      throw new NotFoundException(
        'Profile not found. Please create a profile first.',
      );
    }

    const updatedProfile = await this.prisma.profile.update({
      where: { userId },
      data: { coverImage: fileName },
      include: {
        user: {
          select: {
            id: true,
            email: true,
          },
        },
      },
    });

    return this.serializeProfile(updatedProfile);
  }

  /**
   * Delete user profile
   */
  async remove(userId: string) {
    const profile = await this.prisma.profile.findUnique({
      where: { userId },
    });

    if (!profile) {
      throw new NotFoundException('Profile not found');
    }

    await this.prisma.profile.delete({
      where: { userId },
    });

    return { message: 'Profile deleted successfully' };
  }

  /**
   * Check if username is available
   */
  async checkUsernameAvailability(username: string) {
    const profile = await this.prisma.profile.findUnique({
      where: { username },
    });

    return {
      username,
      available: !profile,
    };
  }
}
