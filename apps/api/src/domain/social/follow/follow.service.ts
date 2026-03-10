import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma/prisma.service';
import { randomUUID } from 'crypto';
import { FollowStatsDto } from './dto';

@Injectable()
export class FollowService {
  constructor(private prisma: PrismaService) {}

  /**
   * Follow a user
   */
  async followUser(followerId: string, followingId: string) {
    // Cannot follow yourself
    if (followerId === followingId) {
      throw new BadRequestException('You cannot follow yourself');
    }

    // Check if user exists
    const userToFollow = await this.prisma.user.findUnique({
      where: { id: followingId },
    });

    if (!userToFollow) {
      throw new NotFoundException('User not found');
    }

    // Check if already following
    const existingFollow = await this.prisma.follows.findUnique({
      where: {
        followerId_followingId: {
          followerId,
          followingId,
        },
      },
    });

    if (existingFollow) {
      throw new ConflictException('Already following this user');
    }

    // Create follow relationship
    return this.prisma.follows.create({
      data: {
        id: randomUUID(),
        followerId,
        followingId,
      },
      include: {
        followed: {
          select: {
            id: true,
            email: true,
            profile: {
              select: {
                username: true,
                bio: true,
                avatar: true,
              },
            },
          },
        },
      },
    });
  }

  /**
   * Unfollow a user
   */
  async unfollowUser(followerId: string, followingId: string) {
    const follow = await this.prisma.follows.findUnique({
      where: {
        followerId_followingId: {
          followerId,
          followingId,
        },
      },
    });

    if (!follow) {
      throw new NotFoundException('Follow relationship not found');
    }

    await this.prisma.follows.delete({
      where: {
        followerId_followingId: {
          followerId,
          followingId,
        },
      },
    });

    return { message: 'Successfully unfollowed user' };
  }

  /**
   * Get user's followers
   */
  async getFollowers(userId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;

    const [followers, total] = await Promise.all([
      this.prisma.follows.findMany({
        where: { followingId: userId },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          createdAt: true,
          follower: {
            select: {
              id: true,
              email: true,
              profile: {
                select: {
                  name: true,
                  username: true,
                  bio: true,
                  avatar: true,
                },
              },
            },
          },
        },
      }),
      this.prisma.follows.count({
        where: { followingId: userId },
      }),
    ]);

    return {
      data: followers.map((f) => f.follower),
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get users that a user is following
   */
  async getFollowing(userId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;

    const [following, total] = await Promise.all([
      this.prisma.follows.findMany({
        where: { followerId: userId },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          createdAt: true,
          followed: {
            select: {
              id: true,
              email: true,
              profile: {
                select: {
                  name: true,
                  username: true,
                  bio: true,
                  avatar: true,
                },
              },
            },
          },
        },
      }),
      this.prisma.follows.count({
        where: { followerId: userId },
      }),
    ]);

    return {
      data: following.map((f) => f.followed),
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get follow statistics for a user
   */
  async getFollowStats(userId: string): Promise<FollowStatsDto> {
    const [followersCount, followingCount] = await Promise.all([
      this.prisma.follows.count({
        where: { followingId: userId },
      }),
      this.prisma.follows.count({
        where: { followerId: userId },
      }),
    ]);

    return {
      followersCount,
      followingCount,
    };
  }

  /**
   * Check if current user is following another user
   */
  async isFollowing(followerId: string, followingId: string): Promise<boolean> {
    const follow = await this.prisma.follows.findUnique({
      where: {
        followerId_followingId: {
          followerId,
          followingId,
        },
      },
    });

    return !!follow;
  }

  /**
   * Get follow suggestions for a user
   */
  async getFollowSuggestions(userId: string, limit = 10) {
    // Get users that:
    // 1. Current user is NOT following
    // 2. Have profiles
    // 3. Are followed by users that current user follows (mutual connections)

    const currentUserFollowing = await this.prisma.follows.findMany({
      where: { followerId: userId },
      select: { followingId: true },
    });

    const followingIds = currentUserFollowing.map((f) => f.followingId);

    // Get users followed by people I follow
    const suggestions = await this.prisma.user.findMany({
      where: {
        AND: [
          { id: { not: userId } }, // Not myself
          { id: { notIn: followingIds } }, // Not already following
          { profile: { isNot: null } }, // Has a profile
          {
            followers: {
              some: {
                followerId: { in: followingIds },
              },
            },
          },
        ],
      },
      take: limit,
      select: {
        id: true,
        email: true,
        profile: {
          select: {
            name: true,
            username: true,
            bio: true,
            avatar: true,
          },
        },
        _count: {
          select: {
            followers: true,
            following: true,
          },
        },
      },
      orderBy: {
        followers: {
          _count: 'desc',
        },
      },
    });

    return suggestions;
  }
}
