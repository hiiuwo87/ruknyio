import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  BadRequestException,
  Inject,
  forwardRef,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../core/database/prisma/prisma.service';
import { CreateFormDto, UpdateFormDto, SubmitFormDto, FormStatus } from './dto';
import { EmailService } from '../../integrations/email/email.service';
import { ValidationService } from '../../core/common/validation.service';
import { ConditionalLogicService } from './services/conditional-logic.service';
import { WebhookService } from './services/webhook.service';
import { SecureIds } from '../../core/common/utils/secure-id.util';
import { NotificationsGateway } from '../notifications/notifications.gateway';
import { NotificationType, FileCategory } from '@prisma/client';
import { GoogleSheetsService } from '../../integrations/google-sheets/google-sheets.service';
import { GoogleDriveService } from '../../integrations/google-drive/google-drive.service';
import { RedisService } from '../../core/cache/redis.service';
import { CacheManager } from '../../core/cache/cache.manager';
import { CacheKeys, CACHE_TTL, CACHE_TAGS } from '../../core/cache/cache.constants';
import { S3Service } from '../../services/s3.service';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class FormsService {
  private readonly logger = new Logger(FormsService.name);
  private readonly bucket = process.env.S3_BUCKET || 'rukny-storage';

  // Image processing constants
  private readonly FORM_COVER_WIDTH = 1200;
  private readonly FORM_COVER_HEIGHT = 630;
  private readonly MAX_COVER_SIZE = 5 * 1024 * 1024; // 5MB

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
    private emailService: EmailService,
    private validationService: ValidationService,
    private conditionalLogicService: ConditionalLogicService,
    private webhookService: WebhookService,
    private notificationsGateway: NotificationsGateway,
    @Inject(forwardRef(() => GoogleSheetsService))
    private googleSheetsService: GoogleSheetsService,
    @Inject(forwardRef(() => GoogleDriveService))
    private googleDriveService: GoogleDriveService,
    private readonly redisService: RedisService,
    private readonly cacheManager: CacheManager,
    private readonly s3Service: S3Service,
  ) {}

  /**
   * Extract S3 key from a presigned URL
   * Example: https://bucket.s3.region.amazonaws.com/users/xxx/forms/yyy/cover/zzz.webp?X-Amz-... 
   * Returns: users/xxx/forms/yyy/cover/zzz.webp
   */
  private extractS3KeyFromUrl(url: string): string | null {
    try {
      const urlObj = new URL(url);
      // Remove leading slash and return the path without query params
      const path = urlObj.pathname.replace(/^\//, '');
      // Validate it looks like an S3 key for forms
      if (path.startsWith('users/') || path.startsWith('forms/')) {
        return path;
      }
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Process and upload cover image to S3
   * Accepts base64 data URL or returns existing S3 key/URL unchanged
   * Includes timeout protection to prevent request aborts
   */
  private async processCoverImage(
    coverImage: string | undefined,
    userId: string,
    formId: string,
  ): Promise<string | undefined> {
    if (!coverImage) return undefined;

    // If it's already an S3 key (not base64 or URL), return as-is
    if (
      coverImage.startsWith('users/') ||
      coverImage.startsWith('forms/')
    ) {
      return coverImage;
    }

    // If it's a presigned URL, extract the S3 key
    if (coverImage.startsWith('http')) {
      const s3Key = this.extractS3KeyFromUrl(coverImage);
      if (s3Key) {
        return s3Key;
      }
      // If we can't extract the key, log warning and return undefined
      this.logger.warn(`Could not extract S3 key from URL: ${coverImage.substring(0, 100)}...`);
      return undefined;
    }

    // Normalize the cover image - handle cases where 'data:' was stripped by sanitizer
    let normalizedCoverImage = coverImage;
    if (coverImage.startsWith('image/') && coverImage.includes(';base64,')) {
      normalizedCoverImage = 'data:' + coverImage;
    }

    // Check if it's a base64 data URL
    if (!normalizedCoverImage.startsWith('data:image/')) {
      return coverImage; // Return unchanged if not recognizable format
    }

    try {
      // Extract mime type and base64 data
      // Support various image formats including webp, svg+xml, jpeg, png, gif
      // Handle both "data:image/png;base64," and "data:image/pngbase64," formats
      const matches = normalizedCoverImage.match(
        /^data:image\/([\w+\-]+)(?:;)?base64,(.+)$/is,
      );
      if (!matches) {
        // Log the format for debugging
        const preview = normalizedCoverImage.substring(0, 100);
        console.warn(`Invalid image format detected: ${preview}...`);
        throw new BadRequestException('Invalid image data format');
      }

      const [, imageType, base64Data] = matches;
      const buffer = Buffer.from(base64Data, 'base64');

      // Validate size
      if (buffer.length > this.MAX_COVER_SIZE) {
        throw new BadRequestException('Cover image exceeds 5MB limit');
      }

      // Process image with sharp (resize and convert to webp)
      // Wrap in Promise.race with timeout to prevent request aborts
      const sharp = await import('sharp');
      const processImageWithTimeout = Promise.race([
        sharp
          .default(buffer)
          .resize(this.FORM_COVER_WIDTH, this.FORM_COVER_HEIGHT, {
            fit: 'cover',
            position: 'center',
          })
          .webp({ quality: 85 })
          .toBuffer(),
        new Promise<Buffer>((_, reject) =>
          setTimeout(() => reject(new Error('Image processing timeout')), 30000) // 30s timeout
        ),
      ]);

      const processedBuffer = await processImageWithTimeout;

      // Generate S3 key
      const fileName = `${uuidv4()}.webp`;
      const s3Key = `users/${userId}/forms/${formId}/cover/${fileName}`;

      // Upload to S3 with built-in retry logic
      await this.s3Service.uploadBuffer(
        this.bucket,
        s3Key,
        processedBuffer,
        'image/webp',
      );

      // Track file in database for storage management
      // Use executeWithRetry to handle transient db errors
      await this.prisma.executeWithRetry(async () => {
        await this.prisma.userFile.create({
          data: {
            userId,
            key: s3Key,
            fileName: 'form-cover.webp',
            fileType: 'image/webp',
            fileSize: BigInt(processedBuffer.length),
            category: FileCategory.FORM_COVER,
            entityId: formId,
          },
        });
      });

      // Update storage usage
      await this.prisma.executeWithRetry(async () => {
        await this.prisma.profile.update({
          where: { userId },
          data: {
            storageUsed: { increment: BigInt(processedBuffer.length) },
          },
        });
      });

      return s3Key;
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      // Catch S3 permission errors specifically
      if (error instanceof Error && error.message.includes('AccessDenied')) {
        throw new BadRequestException(
          'Failed to upload cover image: S3 access denied. Please check AWS credentials.',
        );
      }
      
      this.logger.error('Failed to process cover image:', error);
      // Return generic error to user
      throw new BadRequestException(
        'Failed to process cover image. Please try again.',
      );
    }
  }

  /**
   * Process and upload multiple banner images to S3
   * Accepts array of base64 data URLs or returns existing S3 keys/URLs unchanged
   */
  private async processBannerImages(
    bannerImages: string[] | undefined,
    userId: string,
    formId: string,
  ): Promise<string[]> {
    if (!bannerImages || bannerImages.length === 0) return [];

    const processedImages: string[] = [];

    for (const image of bannerImages) {
      try {
        const processedImage = await this.processCoverImage(
          image,
          userId,
          formId,
        );
        if (processedImage) {
          processedImages.push(processedImage);
        }
      } catch (error) {
        console.error('Failed to process banner image:', error);
        // Continue with other images even if one fails
      }
    }

    return processedImages;
  }

  /**
   * Generate a unique slug by appending a random suffix if the base slug is taken
   */
  private async generateUniqueSlug(baseSlug: string): Promise<string> {
    let slug = baseSlug;
    let attempts = 0;
    const maxAttempts = 10;

    while (attempts < maxAttempts) {
      const existing = await this.prisma.form.findUnique({
        where: { slug },
        select: { id: true },
      });

      if (!existing) {
        return slug;
      }

      // Append random suffix
      const suffix = Math.random().toString(36).substring(2, 6);
      slug = `${baseSlug}-${suffix}`;
      attempts++;
    }

    // Fallback: use timestamp
    return `${baseSlug}-${Date.now()}`;
  }

  async create(userId: string, createFormDto: CreateFormDto) {
    // Generate unique slug (auto-append suffix if taken)
    const uniqueSlug = await this.generateUniqueSlug(createFormDto.slug);

    // Validate linked entities if provided
    if (createFormDto.linkedEventId) {
      const event = await this.prisma.event.findUnique({
        where: { id: createFormDto.linkedEventId },
      });
      if (!event || event.userId !== userId) {
        throw new NotFoundException('Linked event not found or unauthorized');
      }
    }

    if (createFormDto.linkedStoreId) {
      const store = await this.prisma.store.findUnique({
        where: { id: createFormDto.linkedStoreId },
      });
      if (!store || store.userId !== userId) {
        throw new NotFoundException('Linked store not found or unauthorized');
      }
    }

    // Extract fields and steps from DTO
    const {
      fields,
      steps,
      coverImage,
      bannerImages,
      bannerDisplayMode,
      // Integration settings - not stored in Form table, used after form creation
      enableGoogleSheets,
      storageProvider,
      ...formData
    } = createFormDto;

    // Log integration settings for future use
    // TODO: After form creation, automatically setup Google Sheets integration if enableGoogleSheets is true
    if (enableGoogleSheets) {
      this.logger.log(`Form will be created with Google Sheets integration enabled`);
    }
    if (storageProvider) {
      this.logger.log(`Form will use storage provider: ${storageProvider}`);
    }

    // Determine if it's a multi-step form
    const isMultiStep = formData.isMultiStep || (steps && steps.length > 0);

    // Create form with transaction to handle steps and fields properly
    // ⚠️ IMPORTANT: Image processing can take up to 30 seconds, so extend transaction timeout
    const form = await this.prisma.$transaction(
      async (tx) => {
        const formId = SecureIds.form();

      // Process cover image (upload to S3 if base64)
      let coverImageKey: string | undefined;
      if (coverImage) {
        coverImageKey = await this.processCoverImage(
          coverImage,
          userId,
          formId,
        );
      }

      // Process banner images (upload to S3 if base64)
      let bannerImageKeys: string[] = [];
      if (bannerImages && bannerImages.length > 0) {
        bannerImageKeys = await this.processBannerImages(
          bannerImages,
          userId,
          formId,
        );
        // Use first banner as cover image if no cover image provided
        if (!coverImageKey && bannerImageKeys.length > 0) {
          coverImageKey = bannerImageKeys[0];
        }
      }

      // Create the form first
      const createdForm = await tx.form.create({
        data: {
          id: formId,
          ...formData,
          slug: uniqueSlug, // Use the generated unique slug
          coverImage: coverImageKey,
          bannerImages: bannerImageKeys,
          bannerDisplayMode: bannerDisplayMode || 'single',
          userId,
          status: formData.status || 'DRAFT',
          isMultiStep: isMultiStep || false,
        },
      });

      // Handle multi-step forms
      if (isMultiStep && steps && steps.length > 0) {
        // Create steps and their fields
        for (const step of steps) {
          const stepId = SecureIds.generic();

          await tx.form_steps.create({
            data: {
              id: stepId,
              formId: formId,
              title: step.title,
              description: step.description,
              order: step.order,
              updatedAt: new Date(),
            },
          });

          // Create fields for this step - support both step.fields and step.fieldIds (⚡ createMany to avoid N+1)
          if (step.fields && Array.isArray(step.fields) && step.fields.length > 0) {
            await tx.formField.createMany({
              data: step.fields.map((field: any) => this.buildFormFieldRow(field, formId, stepId)),
            });
          } else if (step.fieldIds && fields?.length) {
            const stepFields = fields.filter((f) =>
              step.fieldIds?.includes(f.stepId || ''),
            );
            if (stepFields.length > 0) {
              await tx.formField.createMany({
                data: stepFields.map((field: any) => this.buildFormFieldRow(field, formId, stepId)),
              });
            }
          }
        }

        // Create any remaining fields not assigned to steps (⚡ createMany to avoid N+1)
        if (fields?.length) {
          const unassignedFields = fields.filter((f) => !f.stepId);
          if (unassignedFields.length > 0) {
            await tx.formField.createMany({
              data: unassignedFields.map((field: any) => this.buildFormFieldRow(field, formId)),
            });
          }
        }
      } else {
        // Non-multi-step form - create all fields directly (⚡ createMany to avoid N+1)
        if (fields?.length) {
          await tx.formField.createMany({
            data: fields.map((field: any) => this.buildFormFieldRow(field, formId)),
          });
        }
      }

      // Return the complete form with relations
      return tx.form.findUnique({
        where: { id: formId },
        include: {
          fields: {
            orderBy: { order: 'asc' },
          },
          steps: {
            orderBy: { order: 'asc' },
            include: {
              form_fields: {
                orderBy: { order: 'asc' },
              },
            },
          },
          _count: {
            select: {
              submissions: true,
            },
          },
          user: {
            include: { profile: true },
          },
        },
      });
    },
    {
      timeout: 30000, // 30 ثانية (من 5000ms الافتراضي)
      isolationLevel: 'ReadCommitted', // أفضل performance
    }
    );

    // Send form created notification email with QR code
    if (form.user?.email) {
      try {
        const userName =
          form.user.profile?.name || form.user.email.split('@')[0] || 'User';
        await this.emailService.sendFormCreatedNotification(
          form.user.email,
          userName,
          {
            formTitle: form.title,
            formSlug: form.slug,
            formId: form.id,
          },
        );
      } catch (emailError) {
        console.error('Error sending form created notification:', emailError);
        // Don't throw - email failure shouldn't break form creation
      }
    }

    // ⚡ Invalidate caches for form owner
    try {
      if (form.userId) {
        await this.cacheManager.invalidate(
          CacheKeys.dashboardStats(form.userId),
          CacheKeys.formsList(form.userId),
        );
      }
    } catch (err) {
      this.logger.warn(`Cache invalidation error (form create): ${err?.message || err}`);
    }

    // Return form with integration preferences for frontend to handle OAuth
    return {
      ...form,
      // Integration preferences - frontend will use these to initiate OAuth if needed
      _integrationPreferences: {
        enableGoogleSheets: enableGoogleSheets || false,
        storageProvider: storageProvider || 's3',
      },
    };
  }

  /**
   * ⚡ Performance: بناء صف واحد لـ createMany (تجنب N+1)
   */
  private buildFormFieldRow(field: any, formId: string, stepId?: string | null) {
    return {
      id: SecureIds.field(),
      formId,
      ...(stepId != null && { stepId }),
      label: field.label,
      description: field.description ?? null,
      type: field.type,
      order: field.order,
      required: field.required ?? false,
      placeholder: field.placeholder ?? null,
      options: field.options ?? null,
      minValue: field.minValue ?? null,
      maxValue: field.maxValue ?? null,
      allowedFileTypes: field.allowedFileTypes || [],
      maxFileSize: field.maxFileSize ?? null,
      maxFiles: field.maxFiles ?? null,
    } as any;
  }

  async findAll(filters?: {
    userId?: string;
    type?: string;
    status?: string;
    linkedEventId?: string;
    linkedStoreId?: string;
    page?: number;
    limit?: number;
  }) {
    const {
      userId,
      type,
      status,
      linkedEventId,
      linkedStoreId,
      page = 1,
      limit = 20,
    } = filters || {};

    const skip = (page - 1) * limit;

    const where: any = {};

    if (userId) where.userId = userId;
    if (type) where.type = type;
    if (status) where.status = status;
    if (linkedEventId) where.linkedEventId = linkedEventId;
    if (linkedStoreId) where.linkedStoreId = linkedStoreId;

    const [forms, total] = await Promise.all([
      this.prisma.form.findMany({
        where,
        include: {
          _count: {
            select: {
              fields: true,
              submissions: true,
            },
          },
          events: {
            select: {
              id: true,
              title: true,
              slug: true,
            },
          },
          // linkedStore: {
          //   select: {
          //     id: true,
          //     name: true,
          //     slug: true,
          //   },
          // },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.form.count({ where }),
    ]);

    // Convert coverImage S3 keys to presigned URLs
    const formsWithUrls = await Promise.all(
      forms.map(async (form: any) => {
        if (form.coverImage && !form.coverImage.startsWith('http')) {
          try {
            const presignedUrl = await this.s3Service.getPresignedGetUrl(
              this.bucket,
              form.coverImage,
              3600, // 1 hour expiry
            );
            return { ...form, coverImage: presignedUrl };
          } catch (e) {
            console.warn(`Failed to get presigned URL for form ${form.id}:`, e);
            return { ...form, coverImage: null };
          }
        }
        return form;
      }),
    );

    return {
      forms: formsWithUrls,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get public forms by username (for public profile page)
   * Only returns PUBLISHED forms
   * ⚡ Performance: Cached for 5 minutes
   */
  async findPublicByUsername(username: string, limit = 10) {
    const cacheKey = CacheKeys.publicFormsByUsername(username);

    return this.cacheManager.wrap(
      cacheKey,
      CACHE_TTL.MEDIUM,
      async () => {
        // First find the user by profile username
        const profile = await this.prisma.profile.findUnique({
          where: { username },
          select: { userId: true },
        });

        if (!profile) {
          return { forms: [], featured: null };
        }

        const forms = await this.prisma.form.findMany({
          where: {
            userId: profile.userId,
            status: 'PUBLISHED',
          },
          select: {
            id: true,
            title: true,
            description: true,
            slug: true,
            type: true,
            coverImage: true,
            theme: true,
            createdAt: true,
            closesAt: true,
            _count: {
              select: {
                submissions: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
          take: limit,
        });

        // Find featured form (first one or one with coverImage)
        const featured = forms.find((f: any) => f.coverImage) || forms[0] || null;

        // Convert coverImage keys to presigned URLs for private S3 bucket
        const transformedForms = await Promise.all(
          forms.map(async (f: any) => {
            let coverImageUrl = f.coverImage;
            if (f.coverImage && !f.coverImage.startsWith('http')) {
              try {
                coverImageUrl = await this.s3Service.getPresignedGetUrl(
                  this.bucket,
                  f.coverImage,
                  3600,
                );
              } catch (e) {
                coverImageUrl = null;
              }
            }
            return {
              ...f,
              coverImage: coverImageUrl,
              expiresAt: f.closesAt,
            };
          }),
        );

        // Get presigned URL for featured form's cover image
        let featuredWithUrl = null;
        if (featured) {
          let featuredCoverUrl = featured.coverImage;
          if (featured.coverImage && !featured.coverImage.startsWith('http')) {
            try {
              featuredCoverUrl = await this.s3Service.getPresignedGetUrl(
                this.bucket,
                featured.coverImage,
                3600,
              );
            } catch (e) {
              featuredCoverUrl = null;
            }
          }
          featuredWithUrl = {
            ...featured,
            coverImage: featuredCoverUrl,
            expiresAt: featured.closesAt,
          };
        }

        return {
          forms: transformedForms,
          featured: featuredWithUrl,
        };
      },
      { tags: [CACHE_TAGS.FORM] },
    );
  }

  async findById(formId: string, userId?: string) {
    const form = await this.prisma.form.findUnique({
      where: { id: formId },
      include: {
        fields: {
          orderBy: { order: 'asc' },
        },
        steps: {
          orderBy: { order: 'asc' },
          include: {
            form_fields: {
              orderBy: { order: 'asc' },
            },
          },
        },
        user: {
          select: {
            id: true,
            email: true,
            profile: {
              select: {
                name: true,
              },
            },
          },
        },
        events: {
          select: {
            id: true,
            title: true,
            slug: true,
          },
        },
        // linkedStore: {
        //   select: {
        //     id: true,
        //     name: true,
        //     slug: true,
        //   },
        // },
        _count: {
          select: {
            submissions: true,
          },
        },
      },
    });

    if (!form) {
      throw new NotFoundException('Form not found');
    }

    // التحقق من الملكية إذا تم تمرير userId
    if (userId && form.userId !== userId) {
      throw new ForbiddenException('Not authorized to access this form');
    }

    // Convert coverImage S3 key to presigned URL
    let coverImageUrl = form.coverImage;
    if (form.coverImage && !form.coverImage.startsWith('http')) {
      try {
        coverImageUrl = await this.s3Service.getPresignedGetUrl(
          this.bucket,
          form.coverImage,
          3600,
        );
      } catch (e) {
        console.warn(`Failed to get presigned URL for form ${form.id}:`, e);
        coverImageUrl = null;
      }
    }

    // Convert bannerImages S3 keys to presigned URLs
    const bannerImageUrls: string[] = [];
    if (form.bannerImages && form.bannerImages.length > 0) {
      for (const bannerImage of form.bannerImages) {
        if (bannerImage.startsWith('http')) {
          bannerImageUrls.push(bannerImage);
        } else {
          try {
            const url = await this.s3Service.getPresignedGetUrl(
              this.bucket,
              bannerImage,
              3600,
            );
            bannerImageUrls.push(url);
          } catch (e) {
            console.warn(`Failed to get presigned URL for banner image:`, e);
          }
        }
      }
    }

    return {
      ...form,
      coverImage: coverImageUrl,
      bannerImages: bannerImageUrls,
    };
  }

  async findBySlug(slug: string) {
    const form = await this.prisma.form.findUnique({
      where: { slug },
      include: {
        fields: {
          orderBy: { order: 'asc' },
        },
        steps: {
          orderBy: { order: 'asc' },
          include: {
            form_fields: {
              orderBy: { order: 'asc' },
            },
          },
        },
        user: {
          select: {
            id: true,
            email: true,
            profile: {
              select: {
                name: true,
                username: true,
                avatar: true,
                coverImage: true,
                bio: true,
              },
            },
          },
        },
        events: {
          select: {
            id: true,
            title: true,
            slug: true,
          },
        },
        // linkedStore: {
        //   select: {
        //     id: true,
        //     name: true,
        //     slug: true,
        //   },
        // },
        _count: {
          select: {
            submissions: true,
          },
        },
      },
    });

    if (!form) {
      throw new NotFoundException('Form not found');
    }

    // Increment view count
    await this.prisma.form
      .update({
        where: { id: form.id },
        data: { viewCount: { increment: 1 } },
      })
      .catch(() => {
        // Ignore errors
      });

    // Convert coverImage S3 key to presigned URL
    let coverImageUrl = form.coverImage;
    if (form.coverImage && !form.coverImage.startsWith('http')) {
      try {
        coverImageUrl = await this.s3Service.getPresignedGetUrl(
          this.bucket,
          form.coverImage,
          3600,
        );
      } catch (e) {
        console.warn(`Failed to get presigned URL for form ${form.id}:`, e);
        coverImageUrl = null;
      }
    }

    // Convert bannerImages S3 keys to presigned URLs
    const bannerImageUrls: string[] = [];
    if (form.bannerImages && form.bannerImages.length > 0) {
      for (const bannerImage of form.bannerImages) {
        if (bannerImage.startsWith('http')) {
          bannerImageUrls.push(bannerImage);
        } else {
          try {
            const url = await this.s3Service.getPresignedGetUrl(
              this.bucket,
              bannerImage,
              3600,
            );
            bannerImageUrls.push(url);
          } catch (e) {
            console.warn(`Failed to get presigned URL for banner image:`, e);
          }
        }
      }
    }

    // Convert user avatar and cover image S3 keys to presigned URLs
    let userWithUrls = form.user;
    if (form.user?.profile) {
      let avatarUrl = form.user.profile.avatar;
      let coverImageUserUrl = form.user.profile.coverImage;

      if (avatarUrl && !avatarUrl.startsWith('http')) {
        try {
          avatarUrl = await this.s3Service.getPresignedGetUrl(
            this.bucket,
            avatarUrl,
            3600,
          );
        } catch (e) {
          console.warn(`Failed to get presigned URL for user avatar:`, e);
          avatarUrl = null;
        }
      }

      if (coverImageUserUrl && !coverImageUserUrl.startsWith('http')) {
        try {
          coverImageUserUrl = await this.s3Service.getPresignedGetUrl(
            this.bucket,
            coverImageUserUrl,
            3600,
          );
        } catch (e) {
          console.warn(`Failed to get presigned URL for user cover image:`, e);
          coverImageUserUrl = null;
        }
      }

      userWithUrls = {
        ...form.user,
        profile: {
          ...form.user.profile,
          avatar: avatarUrl,
          coverImage: coverImageUserUrl,
        },
      };
    }

    return {
      ...form,
      coverImage: coverImageUrl,
      bannerImages: bannerImageUrls,
      user: userWithUrls,
    };
  }

  async update(userId: string, formId: string, updateFormDto: UpdateFormDto) {
    const form = await this.prisma.form.findUnique({
      where: { id: formId },
    });

    if (!form) {
      throw new NotFoundException('Form not found');
    }

    if (form.userId !== userId) {
      throw new ForbiddenException('Not authorized to update this form');
    }

    // Check slug uniqueness if updating
    if (updateFormDto.slug && updateFormDto.slug !== form.slug) {
      const existingForm = await this.prisma.form.findUnique({
        where: { slug: updateFormDto.slug },
      });

      if (existingForm) {
        throw new ConflictException('Form slug already taken');
      }
    }

    // Extract fields and steps from DTO if present
    const {
      fields,
      steps,
      coverImage,
      bannerImages,
      bannerDisplayMode,
      ...formData
    } = updateFormDto as any;

    // Determine if it's a multi-step form
    const isMultiStep = formData.isMultiStep || (steps && steps.length > 0);

    // Process cover image if provided (upload to S3 if base64)
    let coverImageKey: string | undefined;
    if (coverImage !== undefined) {
      if (coverImage) {
        coverImageKey = await this.processCoverImage(
          coverImage,
          form.userId,
          formId,
        );

        // Delete old cover image from S3 if it exists and is different
        if (
          form.coverImage &&
          form.coverImage !== coverImageKey &&
          (form.coverImage.startsWith('forms/') ||
            form.coverImage.startsWith('users/'))
        ) {
          await this.s3Service
            .deleteObject(this.bucket, form.coverImage)
            .catch(() => {});
        }
      } else {
        // coverImage is empty/null - remove existing
        coverImageKey = null as any;
        if (
          form.coverImage &&
          (form.coverImage.startsWith('forms/') ||
            form.coverImage.startsWith('users/'))
        ) {
          await this.s3Service
            .deleteObject(this.bucket, form.coverImage)
            .catch(() => {});
        }
      }
    }

    // Process banner images if provided
    let bannerImageKeys: string[] | undefined;
    if (bannerImages !== undefined) {
      if (bannerImages && bannerImages.length > 0) {
        bannerImageKeys = await this.processBannerImages(
          bannerImages,
          form.userId,
          formId,
        );

        // Delete old banner images from S3 that are not in the new list
        if (form.bannerImages && form.bannerImages.length > 0) {
          for (const oldImage of form.bannerImages) {
            if (
              (oldImage.startsWith('forms/') ||
                oldImage.startsWith('users/')) &&
              !bannerImageKeys.includes(oldImage)
            ) {
              await this.s3Service
                .deleteObject(this.bucket, oldImage)
                .catch(() => {});
            }
          }
        }

        // Use first banner as cover image if no cover image provided
        if (coverImageKey === undefined && bannerImageKeys.length > 0) {
          coverImageKey = bannerImageKeys[0];
        }
      } else {
        // bannerImages is empty - remove existing
        bannerImageKeys = [];
        if (form.bannerImages && form.bannerImages.length > 0) {
          for (const oldImage of form.bannerImages) {
            if (
              oldImage.startsWith('forms/') ||
              oldImage.startsWith('users/')
            ) {
              await this.s3Service
                .deleteObject(this.bucket, oldImage)
                .catch(() => {});
            }
          }
        }
      }
    }

    // Use transaction to update form, steps, and fields together
    const updated = await this.prisma.$transaction(async (tx) => {
      // Update form data
      await tx.form.update({
        where: { id: formId },
        data: {
          ...formData,
          ...(coverImageKey !== undefined ? { coverImage: coverImageKey } : {}),
          ...(bannerImageKeys !== undefined
            ? { bannerImages: bannerImageKeys }
            : {}),
          ...(bannerDisplayMode !== undefined ? { bannerDisplayMode } : {}),
          isMultiStep: isMultiStep || false,
        },
      });

      // Handle multi-step forms
      if (isMultiStep && steps && Array.isArray(steps)) {
        // Delete existing steps (will cascade delete step-field relations)
        await tx.form_steps.deleteMany({
          where: { formId },
        });

        // Delete existing fields
        await tx.formField.deleteMany({
          where: { formId },
        });

        // Create new steps and their fields
        for (const step of steps) {
          const stepId = SecureIds.generic();

          await tx.form_steps.create({
            data: {
              id: stepId,
              formId: formId,
              title: step.title,
              description: step.description,
              order: step.order,
              updatedAt: new Date(),
            },
          });

          // Create fields for this step (⚡ createMany to avoid N+1)
          if (step.fields && Array.isArray(step.fields) && step.fields.length > 0) {
            await tx.formField.createMany({
              data: step.fields.map((field: any) => this.buildFormFieldRow(field, formId, stepId)),
            });
          }
        }
      } else if (fields && Array.isArray(fields)) {
        // Non-multi-step form - handle fields directly
        await tx.form_steps.deleteMany({ where: { formId } });
        await tx.formField.deleteMany({ where: { formId } });
        if (fields.length > 0) {
          await tx.formField.createMany({
            data: fields.map((field: any) => this.buildFormFieldRow(field, formId)),
          });
        }
      }

      // Return updated form with all relations
      return tx.form.findUnique({
        where: { id: formId },
        include: {
          fields: {
            orderBy: { order: 'asc' },
          },
          steps: {
            orderBy: { order: 'asc' },
            include: {
              form_fields: {
                orderBy: { order: 'asc' },
              },
            },
          },
          _count: {
            select: {
              submissions: true,
            },
          },
        },
      });
    });

    // ⚡ Invalidate caches for form owner
    try {
      if (updated?.userId) {
        await this.cacheManager.invalidate(
          CacheKeys.dashboardStats(updated.userId),
          CacheKeys.formById(formId),
          CacheKeys.formBySlug(form.slug),
          CacheKeys.formsList(updated.userId),
        );
        // Also invalidate public forms cache if user has a profile
        const profile = await this.prisma.profile.findUnique({
          where: { userId: updated.userId },
          select: { username: true },
        });
        if (profile?.username) {
          await this.cacheManager.invalidate(CacheKeys.publicFormsByUsername(profile.username));
        }
      }
    } catch (err) {
      this.logger.warn(`Cache invalidation error (form update): ${err?.message || err}`);
    }

    // Convert coverImage S3 key to presigned URL
    if (
      updated &&
      updated.coverImage &&
      !updated.coverImage.startsWith('http')
    ) {
      try {
        const presignedUrl = await this.s3Service.getPresignedGetUrl(
          this.bucket,
          updated.coverImage,
          3600,
        );
        return { ...updated, coverImage: presignedUrl };
      } catch (e) {
        console.warn(`Failed to get presigned URL for form ${updated.id}:`, e);
        return { ...updated, coverImage: null };
      }
    }

    return updated;
  }
  async updateStatus(userId: string, formId: string, status: FormStatus) {
    const form = await this.prisma.form.findUnique({
      where: { id: formId },
    });

    if (!form) {
      throw new NotFoundException('Form not found');
    }

    if (form.userId !== userId) {
      throw new ForbiddenException('Not authorized to update this form');
    }

    const updated = await this.prisma.form.update({
      where: { id: formId },
      data: { status },
    });

    // ⚡ Invalidate caches for form owner
    try {
      if (updated?.userId) {
        await this.cacheManager.invalidate(
          CacheKeys.dashboardStats(updated.userId),
          CacheKeys.formById(formId),
          CacheKeys.formBySlug(form.slug),
          CacheKeys.formsList(updated.userId),
        );
      }
    } catch (err) {
      this.logger.warn(`Cache invalidation error (form updateStatus): ${err?.message || err}`);
    }

    return updated;
  }

  // ==================== STEPS MANAGEMENT ====================

  async getFormSteps(userId: string, formId: string) {
    const form = await this.prisma.form.findUnique({
      where: { id: formId },
    });

    if (!form) {
      throw new NotFoundException('Form not found');
    }

    if (form.userId !== userId) {
      throw new ForbiddenException('Not authorized to access this form');
    }

    return this.prisma.form_steps.findMany({
      where: { formId },
      orderBy: { order: 'asc' },
      include: {
        form_fields: {
          orderBy: { order: 'asc' },
        },
      },
    });
  }

  async updateFormSteps(userId: string, formId: string, steps: any[]) {
    const form = await this.prisma.form.findUnique({
      where: { id: formId },
    });

    if (!form) {
      throw new NotFoundException('Form not found');
    }

    if (form.userId !== userId) {
      throw new ForbiddenException('Not authorized to update this form');
    }

    return this.prisma.$transaction(async (tx) => {
      // Delete existing steps and fields
      await tx.form_steps.deleteMany({
        where: { formId },
      });

      await tx.formField.deleteMany({
        where: { formId },
      });

      // Update isMultiStep flag
      await tx.form.update({
        where: { id: formId },
        data: { isMultiStep: steps.length > 0 },
      });

      // Create new steps and their fields
      for (const step of steps) {
        const stepId = SecureIds.generic();

        await tx.form_steps.create({
          data: {
            id: stepId,
            formId: formId,
            title: step.title,
            description: step.description,
            order: step.order,
            updatedAt: new Date(),
          },
        });

        // Create fields for this step (⚡ createMany to avoid N+1)
        if (step.fields && Array.isArray(step.fields) && step.fields.length > 0) {
          await tx.formField.createMany({
            data: step.fields.map((field: any) => this.buildFormFieldRow(field, formId, stepId)),
          });
        }
      }

      // Return updated steps
      return tx.form_steps.findMany({
        where: { formId },
        orderBy: { order: 'asc' },
        include: {
          form_fields: {
            orderBy: { order: 'asc' },
          },
        },
      });
    });
  }

  async delete(userId: string, formId: string) {
    const form = await this.prisma.form.findUnique({
      where: { id: formId },
    });

    if (!form) {
      throw new NotFoundException('Form not found');
    }

    if (form.userId !== userId) {
      throw new ForbiddenException('Not authorized to delete this form');
    }

    await this.prisma.form.delete({
      where: { id: formId },
    });

    // ⚡ Invalidate caches for form owner
    try {
      if (form.userId) {
        await this.cacheManager.invalidate(
          CacheKeys.dashboardStats(form.userId),
          CacheKeys.formById(formId),
          CacheKeys.formBySlug(form.slug),
          CacheKeys.formsList(form.userId),
        );
        // Also invalidate public forms cache
        const profile = await this.prisma.profile.findUnique({
          where: { userId: form.userId },
          select: { username: true },
        });
        if (profile?.username) {
          await this.cacheManager.invalidate(CacheKeys.publicFormsByUsername(profile.username));
        }
      }
    } catch (err) {
      this.logger.warn(`Cache invalidation error (form delete): ${err?.message || err}`);
    }

    // Return nothing for NO_CONTENT response
    return;
  }

  async submitForm(
    formId: string,
    submitFormDto: SubmitFormDto,
    userId?: string,
  ) {
    const form = await this.prisma.form.findUnique({
      where: { id: formId },
      include: {
        fields: true,
      },
    });

    if (!form) {
      throw new NotFoundException('Form not found');
    }

    // Validate form status
    if (form.status !== 'PUBLISHED') {
      throw new BadRequestException('Form is not accepting submissions');
    }

    // Check if form is open
    const now = new Date();
    if (form.opensAt && now < form.opensAt) {
      throw new BadRequestException('Form is not open yet');
    }
    if (form.closesAt && now > form.closesAt) {
      throw new BadRequestException('Form is closed');
    }

    // Check authentication requirement
    if (form.requiresAuthentication && !userId) {
      throw new BadRequestException(
        'Authentication required to submit this form',
      );
    }

    // Check submission limit
    if (form.maxSubmissions) {
      const submissionCount = await this.prisma.form_submissions.count({
        where: { formId },
      });
      if (submissionCount >= form.maxSubmissions) {
        throw new BadRequestException('Form has reached maximum submissions');
      }
    }

    // Check multiple submissions
    if (!form.allowMultipleSubmissions && userId) {
      const existingSubmission = await this.prisma.form_submissions.findFirst({
        where: { formId, userId },
      });
      if (existingSubmission) {
        throw new BadRequestException('You have already submitted this form');
      }
    }

    // Check oneResponsePerUser (requires authentication)
    if (form.oneResponsePerUser && userId) {
      const existingSubmission = await this.prisma.form_submissions.findFirst({
        where: { formId, userId },
      });
      if (existingSubmission) {
        throw new BadRequestException('You can only submit this form once');
      }
    }

    // Apply conditional logic to determine visible/required fields
    const { visibleFieldIds, requiredFieldIds } =
      this.conditionalLogicService.getVisibleFields(
        form.fields,
        submitFormDto.data,
      );

    // Filter fields to only validate visible ones
    const fieldsToValidate = form.fields.filter((field) =>
      visibleFieldIds.includes(field.id),
    );

    // Update required status based on conditional logic
    const fieldsWithConditionalRequirements = fieldsToValidate.map((field) => ({
      ...field,
      required: requiredFieldIds.includes(field.id) || field.required,
    }));

    // Comprehensive field validation using ValidationService
    const validationResult = this.validationService.validateFormSubmission(
      fieldsWithConditionalRequirements,
      submitFormDto.data,
    );

    if (!validationResult.isValid) {
      const errorMessages = this.validationService.flattenErrors(
        validationResult.errors,
      );
      throw new BadRequestException({
        message: 'Form validation failed',
        errors: validationResult.errors,
        errorMessages,
      });
    }

    // Generate submission ID early for file naming
    const submissionId = SecureIds.submission();

    // Process signatures and files - upload to Google Drive if connected
    const processedData = await this.processSubmissionData(
      formId,
      form.fields,
      submitFormDto.data,
      submissionId,
    );

    // Create submission with processed data
    const submission = await this.prisma.form_submissions.create({
      data: {
        id: submissionId,
        formId,
        userId,
        data: processedData,
        ipAddress: submitFormDto.ipAddress,
        userAgent: submitFormDto.userAgent,
        timeToComplete: submitFormDto.timeToComplete,
        updatedAt: new Date(),
      },
    });

    // Update form submission count
    await this.prisma.form.update({
      where: { id: formId },
      data: { submissionCount: { increment: 1 } },
    });

    // Send email notifications
    if (form.notifyOnSubmission && form.notificationEmail) {
      await this.emailService.sendFormSubmissionNotification(
        form.notificationEmail,
        form.title,
        submitFormDto.data,
        formId,
      ).catch((error) => {
        console.error('Failed to send notification email:', error);
        // Don't throw error - email failure shouldn't block submission
      });
    }

    // Send real-time notification to form owner
    try {
      await this.notificationsGateway.sendNotification({
        userId: form.userId,
        type: NotificationType.FORM_SUBMISSION,
        title: 'استجابة نموذج جديدة',
        message: `تم استلام استجابة جديدة على النموذج "${form.title}"`,
        data: {
          formId: form.id,
          formTitle: form.title,
          formSlug: form.slug,
          submissionId: submission.id,
          responseCount: (form.submissionCount || 0) + 1,
        },
      });
    } catch (error) {
      console.error('Failed to send real-time notification:', error);
      // Don't throw error - notification failure shouldn't block submission
    }

    // Send auto-response to user
    if (form.autoResponseEnabled && form.autoResponseMessage && userId) {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { email: true },
      });

      if (user?.email) {
        await this.emailService.sendAutoResponse(
          user.email,
          form.title,
          form.autoResponseMessage,
        ).catch((error) => {
          console.error('Failed to send auto-response email:', error);
          // Don't throw error
        });
      }
    }

    // Send webhook notification if enabled
    // @ts-ignore - Webhook fields will be available after migration
    if (form.webhookEnabled && form.webhookUrl) {
      await this.webhookService
        .notifyFormSubmission(
          // @ts-ignore
          form.webhookUrl,
          // @ts-ignore
          form.webhookSecret,
          formId,
          form.slug,
          submission.id,
          submitFormDto.data,
        )
        .catch((error) => {
          console.error('Failed to send webhook:', error);
          // Don't throw error - webhook failure shouldn't block submission
        });
    }

    // Auto-sync to Google Sheets if enabled
    try {
      await this.googleSheetsService.addSubmissionToSheet(
        formId,
        submission.id,
      );
    } catch (error) {
      console.error('Failed to sync to Google Sheets:', error);
      // Don't throw error - Google Sheets sync failure shouldn't block submission
    }

    // ⚡ Invalidate caches for form owner (submission affects stats)
    try {
      if (form.userId) {
        await this.cacheManager.invalidate(
          CacheKeys.dashboardStats(form.userId),
        );
      }
    } catch (err) {
      this.logger.warn(`Cache invalidation error (form submit): ${err?.message || err}`);
    }

    return submission;
  }

  async getFormSubmissions(
    userId: string,
    formId: string,
    page = 1,
    limit = 50,
  ) {
    const form = await this.prisma.form.findUnique({
      where: { id: formId },
    });

    if (!form) {
      throw new NotFoundException('Form not found');
    }

    if (form.userId !== userId) {
      throw new ForbiddenException('Not authorized to view submissions');
    }

    const skip = (page - 1) * limit;

    const [submissions, total] = await Promise.all([
      this.prisma.form_submissions.findMany({
        where: { formId },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              profile: {
                select: {
                  name: true,
                },
              },
            },
          },
        },
        orderBy: { completedAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.form_submissions.count({ where: { formId } }),
    ]);

    return {
      submissions,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      },
    };
  }

  async deleteSubmission(userId: string, formId: string, submissionId: string) {
    // First check if form belongs to user
    const form = await this.prisma.form.findUnique({
      where: { id: formId },
    });

    if (!form) {
      throw new NotFoundException('Form not found');
    }

    if (form.userId !== userId) {
      throw new ForbiddenException('Not authorized to delete submissions');
    }

    // Check if submission exists and belongs to this form
    const submission = await this.prisma.form_submissions.findFirst({
      where: {
        id: submissionId,
        formId,
      },
    });

    if (!submission) {
      throw new NotFoundException('Submission not found');
    }

    // Delete the submission
    await this.prisma.form_submissions.delete({
      where: { id: submissionId },
    });

    // Decrement submission count
    await this.prisma.form.update({
      where: { id: formId },
      data: { submissionCount: { decrement: 1 } },
    });

    return;
  }

  async exportSubmissions(userId: string, formId: string) {
    // Check if form belongs to user
    const form = await this.prisma.form.findUnique({
      where: { id: formId },
      include: {
        fields: {
          orderBy: { order: 'asc' },
        },
      },
    });

    if (!form) {
      throw new NotFoundException('Form not found');
    }

    if (form.userId !== userId) {
      throw new ForbiddenException('Not authorized to export submissions');
    }

    // Get all submissions
    const submissions = await this.prisma.form_submissions.findMany({
      where: { formId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            profile: {
              select: {
                name: true,
              },
            },
          },
        },
      },
      orderBy: { completedAt: 'desc' },
    });

    if (submissions.length === 0) {
      throw new BadRequestException('No submissions to export');
    }

    // Build CSV with English headers
    const headers = [
      '#',
      'Name',
      'Email',
      'Date',
      'Time',
      'Duration (sec)',
      ...form.fields.map((field) => field.label),
    ];

    const rows = submissions.map((submission, index) => {
      // Format date and time in English
      const completedDate = submission.completedAt;
      const dateStr = completedDate.toLocaleDateString('en-US', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      });
      const timeStr = completedDate.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      });

      const row = [
        (index + 1).toString(),
        submission.user?.profile?.name || 'Anonymous',
        submission.user?.email || '-',
        dateStr,
        timeStr,
        submission.timeToComplete?.toString() || '-',
      ];

      // Add field values in the correct order
      form.fields.forEach((field) => {
        // Try to get value by field label first (common case), then by field id
        const value = submission.data[field.label] ?? submission.data[field.id];

        if (value === undefined || value === null || value === '') {
          row.push('-');
        } else if (Array.isArray(value)) {
          row.push(value.join(', '));
        } else if (typeof value === 'boolean') {
          row.push(value ? 'Yes' : 'No');
        } else if (typeof value === 'object') {
          row.push(JSON.stringify(value));
        } else {
          row.push(String(value));
        }
      });

      return row;
    });

    // Convert to CSV with proper escaping
    const csvContent = [headers, ...rows]
      .map((row) =>
        row
          .map((cell) => {
            // Escape quotes and wrap in quotes if contains special characters
            const cellStr = String(cell);
            if (
              cellStr.includes(',') ||
              cellStr.includes('\n') ||
              cellStr.includes('"')
            ) {
              return `"${cellStr.replace(/"/g, '""')}"`;
            }
            return cellStr;
          })
          .join(','),
      )
      .join('\r\n'); // Use CRLF for better Windows/Excel compatibility

    return {
      content: csvContent,
      filename: `${form.slug}-submissions-${Date.now()}.csv`,
      contentType: 'text/csv',
    };
  }

  async getFormAnalytics(userId: string, formId: string) {
    const form = await this.prisma.form.findUnique({
      where: { id: formId },
      include: {
        fields: true,
      },
    });

    if (!form) {
      throw new NotFoundException('Form not found');
    }

    if (form.userId !== userId) {
      throw new ForbiddenException('Not authorized to view analytics');
    }

    const submissions = await this.prisma.form_submissions.findMany({
      where: { formId },
    });

    // Calculate analytics
    const totalSubmissions = submissions.length;
    const completionRate =
      form.viewCount > 0 ? (totalSubmissions / form.viewCount) * 100 : 0;

    const avgTimeToComplete =
      submissions
        .filter((s) => s.timeToComplete)
        .reduce((acc, s) => acc + (s.timeToComplete || 0), 0) /
        (submissions.filter((s) => s.timeToComplete).length || 1) || 0;

    // Field-level analytics
    const fieldAnalytics = form.fields.map((field) => {
      const responses = submissions
        .map((s) => s.data[field.id])
        .filter(Boolean);

      // Calculate response distribution for select/radio fields
      let responseDistribution = null;
      if (
        ['SELECT', 'RADIO', 'CHECKBOX'].includes(field.type) &&
        field.options
      ) {
        const options = Array.isArray(field.options)
          ? field.options
          : (field.options as any).options || [];
        responseDistribution = options.map((option: any) => {
          const optionValue =
            typeof option === 'string' ? option : option.value;
          const count = responses.filter((r) => {
            if (Array.isArray(r)) {
              return r.includes(optionValue);
            }
            return r === optionValue;
          }).length;
          return {
            option: optionValue,
            count,
            percentage:
              responses.length > 0 ? (count / responses.length) * 100 : 0,
          };
        });
      }

      return {
        fieldId: field.id,
        label: field.label,
        type: field.type,
        totalResponses: responses.length,
        responseRate:
          totalSubmissions > 0
            ? (responses.length / totalSubmissions) * 100
            : 0,
        responseDistribution,
      };
    });

    // Calculate submissions over time (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentSubmissions = await this.prisma.form_submissions.findMany({
      where: {
        formId,
        completedAt: {
          gte: thirtyDaysAgo,
        },
      },
      select: {
        completedAt: true,
      },
      orderBy: {
        completedAt: 'asc',
      },
    });

    // Group submissions by date
    const submissionsByDate = recentSubmissions.reduce(
      (acc, sub) => {
        const date = sub.completedAt.toISOString().split('T')[0];
        acc[date] = (acc[date] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );

    const submissionsOverTime = Object.entries(submissionsByDate).map(
      ([date, count]) => ({
        date,
        count,
      }),
    );

    // Field analysis - which fields are filled most
    const fieldAnalysis: Record<string, any> = {};

    form.fields.forEach((field) => {
      const fieldKey = field.label;
      let filledCount = 0;
      const values: any[] = [];

      submissions.forEach((sub) => {
        const value = sub.data[field.label] || sub.data[field.id];
        if (value !== undefined && value !== null && value !== '') {
          filledCount++;
          values.push(value);
        }
      });

      fieldAnalysis[fieldKey] = {
        filledCount,
        uniqueValues: new Set(values.map((v) => JSON.stringify(v))).size,
        mostCommonValue: values.length > 0 ? values[0] : null,
      };
    });

    return {
      totalViews: form.viewCount,
      totalSubmissions,
      avgCompletionTime: Math.round(avgTimeToComplete),
      submissionsOverTime,
      fieldAnalysis,
    };
  }

  async duplicateForm(userId: string, formId: string) {
    const originalForm = await this.prisma.form.findUnique({
      where: { id: formId },
      include: {
        fields: true,
      },
    });

    if (!originalForm) {
      throw new NotFoundException('Form not found');
    }

    if (originalForm.userId !== userId) {
      throw new ForbiddenException('Not authorized to duplicate this form');
    }

    // Generate unique slug
    const baseSlug = `${originalForm.slug}-copy`;
    let slug = baseSlug;
    let counter = 1;
    while (await this.prisma.form.findUnique({ where: { slug } })) {
      slug = `${baseSlug}-${counter}`;
      counter++;
    }

    // Create duplicate
    const {
      id,
      createdAt,
      updatedAt,
      viewCount,
      submissionCount,
      ...formData
    } = originalForm;

    return this.prisma.form.create({
      data: {
        ...formData,
        title: `${originalForm.title} (Copy)`,
        slug,
        status: 'DRAFT',
        viewCount: 0,
        submissionCount: 0,
        fields: {
          create: originalForm.fields.map((field) => {
            const { id, formId, createdAt, updatedAt, ...fieldData } = field;
            return fieldData;
          }),
        },
      },
      include: {
        fields: {
          orderBy: { order: 'asc' },
        },
      },
    });
  }

  /**
   * Process submission data - upload signatures and files to Google Drive
   * Returns processed data with secure URLs instead of base64 strings
   */
  private async processSubmissionData(
    formId: string,
    fields: any[],
    data: Record<string, any>,
    submissionId: string,
  ): Promise<Record<string, any>> {
    const processedData = { ...data };

    // Check if Google Drive is connected for this form
    const isDriveConnected = await this.isDriveConnected(formId);
    console.log(
      `Processing submission for form ${formId}, Drive connected: ${isDriveConnected}`,
    );

    if (!isDriveConnected) {
      // If Drive is not connected, return data as-is
      console.log('Drive not connected, keeping data as-is');
      return processedData;
    }

    // Get API URL for building secure links
    const apiUrl = this.config.get('API_URL') || 'http://localhost:3001';

    // Process each field
    for (const field of fields) {
      // Try to find value by field.id or field.label (frontend may use either)
      const fieldKey =
        data[field.id] !== undefined
          ? field.id
          : data[field.label] !== undefined
            ? field.label
            : null;
      if (!fieldKey) continue;

      const value = data[fieldKey];
      if (!value) continue;

      try {
        // Process SIGNATURE fields
        // Check for base64 image data (with or without 'data:' prefix)
        const isBase64Image =
          typeof value === 'string' &&
          (value.startsWith('data:image') || value.startsWith('image/'));

        if (field.type === 'SIGNATURE' && isBase64Image) {
          // Normalize the base64 string to have proper data URL format
          let signatureData = value;
          if (!signatureData.startsWith('data:')) {
            signatureData = `data:${signatureData}`;
          }

          const uploadResult = await this.googleDriveService.uploadSignature(
            formId,
            signatureData,
            submissionId,
          );
          // Store both webViewLink (for Google Sheets) and secureUrl (for dashboard)
          processedData[fieldKey] = {
            type: 'secure_file',
            fileId: uploadResult.fileId,
            formId: formId,
            webViewLink: uploadResult.webViewLink,
            secureUrl: `${apiUrl}/api/v1/integrations/google-drive/secure/${formId}/${uploadResult.fileId}`,
          };
        }

        // Process FILE fields (if they contain base64 data)
        if (field.type === 'FILE') {
          console.log(`Processing FILE field ${field.id}:`, {
            isArray: Array.isArray(value),
            valueType: typeof value,
            hasData: value?.data !== undefined,
            dataType: typeof value?.data,
          });

          // Handle array of files
          if (Array.isArray(value)) {
            const processedFiles = [];
            for (const file of value) {
              // Ensure file.data is a valid base64 string
              let fileData = typeof file.data === 'string' ? file.data : null;

              // Normalize: add 'data:' prefix if missing
              if (
                fileData &&
                !fileData.startsWith('data:') &&
                fileData.includes(';base64,')
              ) {
                fileData = `data:${fileData}`;
              }

              if (fileData && fileData.startsWith('data:')) {
                // Upload base64 file to Drive (with submissionId for response subfolder)
                const base64Data = fileData.replace(/^data:[^;]+;base64,/, '');
                const buffer = Buffer.from(base64Data, 'base64');
                // Support both naming conventions: name/type (form) or originalName/mimeType (upload endpoint)
                const fileName =
                  file.name || file.originalName || `file_${Date.now()}`;
                const fileType =
                  file.type || file.mimeType || 'application/octet-stream';
                console.log(
                  `Uploading file to Drive: ${fileName} (${fileType})`,
                );
                const uploadResult = await this.googleDriveService.uploadFile(
                  formId,
                  {
                    buffer,
                    originalname: fileName,
                    mimetype: fileType,
                  },
                  submissionId,
                );
                console.log(`File uploaded to Drive: ${uploadResult.fileId}`);
                processedFiles.push({
                  name: fileName,
                  type: fileType,
                  size: file.size,
                  fileId: uploadResult.fileId,
                  formId: formId,
                  webViewLink: uploadResult.webViewLink,
                  secureUrl: `${apiUrl}/api/v1/integrations/google-drive/secure/${formId}/${uploadResult.fileId}`,
                });
              } else if (file.url || file.secureUrl || file.fileId) {
                // Already has URL (already uploaded to Drive)
                console.log(
                  `File already uploaded: ${file.fileId || file.url}`,
                );
                processedFiles.push(file);
              } else {
                // Keep file as-is if no data and no URL
                console.log(`File has no uploadable data:`, file);
                processedFiles.push(file);
              }
            }
            processedData[fieldKey] = processedFiles;
          } else if (typeof value === 'object' && value !== null) {
            // Single file object
            let fileData = typeof value.data === 'string' ? value.data : null;

            // Normalize: add 'data:' prefix if missing
            if (
              fileData &&
              !fileData.startsWith('data:') &&
              fileData.includes(';base64,')
            ) {
              fileData = `data:${fileData}`;
            }

            if (fileData && fileData.startsWith('data:')) {
              // Single file object with base64 data (with submissionId for response subfolder)
              const base64Data = fileData.replace(/^data:[^;]+;base64,/, '');
              const buffer = Buffer.from(base64Data, 'base64');
              // Support both naming conventions: name/type (form) or originalName/mimeType (upload endpoint)
              const fileName =
                value.name || value.originalName || `file_${Date.now()}`;
              const fileType =
                value.type || value.mimeType || 'application/octet-stream';
              console.log(
                `Uploading single file to Drive: ${fileName} (${fileType})`,
              );
              const uploadResult = await this.googleDriveService.uploadFile(
                formId,
                {
                  buffer,
                  originalname: fileName,
                  mimetype: fileType,
                },
                submissionId,
              );
              console.log(
                `Single file uploaded to Drive: ${uploadResult.fileId}`,
              );
              processedData[fieldKey] = {
                name: fileName,
                type: fileType,
                size: value.size,
                fileId: uploadResult.fileId,
                formId: formId,
                webViewLink: uploadResult.webViewLink,
                secureUrl: `${apiUrl}/api/v1/integrations/google-drive/secure/${formId}/${uploadResult.fileId}`,
              };
            } else if (value.url || value.secureUrl || value.fileId) {
              // Already has URL (already uploaded to Drive)
              console.log(
                `Single file already uploaded: ${value.fileId || value.url}`,
              );
              // Keep as-is
            } else {
              // Keep file as-is if no data and no URL
              console.log(`Single file has no uploadable data:`, value);
            }
          }
        }
      } catch (error) {
        console.error(
          `Error processing field ${field.id} (${field.label}):`,
          error,
        );
        // On error, keep original value - don't fail the entire submission
      }
    }

    return processedData;
  }

  /**
   * Check if Google Drive is connected for a form
   */
  private async isDriveConnected(formId: string): Promise<boolean> {
    const integration = await this.prisma.formIntegration.findFirst({
      where: {
        formId,
        type: 'google_sheets', // Drive uses same integration as Sheets
        isActive: true,
      },
    });
    console.log(`isDriveConnected for form ${formId}:`, {
      found: !!integration,
      integrationId: integration?.id,
      type: integration?.type,
      isActive: integration?.isActive,
    });
    return !!integration;
  }
}
