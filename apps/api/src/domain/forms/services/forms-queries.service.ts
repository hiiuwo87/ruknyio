import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma/prisma.service';
import { RedisService } from '../../../core/cache/redis.service';
import { S3Service } from '../../../services/s3.service';

/**
 * 🔍 Forms Queries Service
 * Handles: findAll, findById, findBySlug, findPublicByUsername
 *
 * ~280 lines - follows golden rule of ≤300 lines per service
 */
@Injectable()
export class FormsQueriesService {
  private readonly bucket = process.env.S3_BUCKET || 'rukny-storage';

  // Cache TTLs in seconds
  private readonly CACHE_TTL = {
    FORM_BY_SLUG: 300, // 5 min - public form structure
    PUBLIC_FORMS: 120, // 2 min - user's public forms list
  };

  constructor(
    private prisma: PrismaService,
    private redisService: RedisService,
    private s3Service: S3Service,
  ) {}

  /**
   * Find all forms with filters and pagination
   */
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
          _count: { select: { fields: true, submissions: true } },
          events: { select: { id: true, title: true, slug: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.form.count({ where }),
    ]);

    // Convert S3 keys to presigned URLs
    const formsWithUrls = await Promise.all(
      forms.map((form) => this.transformFormImages(form)),
    );

    return {
      forms: formsWithUrls,
      pagination: { total, page, limit, pages: Math.ceil(total / limit) },
    };
  }

  /**
   * Find public forms by username (with caching)
   */
  async findPublicByUsername(username: string, limit = 10) {
    const cacheKey = `forms:public:${username}:${limit}`;

    // Try cache first
    try {
      const cached = await this.redisService.get(cacheKey);
      if (cached) return cached;
    } catch (e) {
      // Cache miss, continue
    }

    const profile = await this.prisma.profile.findUnique({
      where: { username },
      select: { userId: true },
    });

    if (!profile) return { forms: [], featured: null };

    const forms = await this.prisma.form.findMany({
      where: { userId: profile.userId, status: 'PUBLISHED' },
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
        _count: { select: { submissions: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    const featured = forms.find((f: any) => f.coverImage) || forms[0] || null;

    const transformedForms = await Promise.all(
      forms.map(async (f: any) => ({
        ...f,
        coverImage: await this.getPresignedUrl(f.coverImage),
        expiresAt: f.closesAt,
      })),
    );

    const result = {
      forms: transformedForms,
      featured: featured
        ? {
            ...featured,
            coverImage: await this.getPresignedUrl(featured.coverImage),
            expiresAt: featured.closesAt,
          }
        : null,
    };

    // Cache result
    try {
      await this.redisService.set(
        cacheKey,
        JSON.stringify(result),
        this.CACHE_TTL.PUBLIC_FORMS,
      );
    } catch (e) {
      // Cache write failed, continue
    }

    return result;
  }

  /**
   * Find form by ID
   */
  async findById(formId: string, userId?: string) {
    const form = await this.prisma.form.findUnique({
      where: { id: formId },
      include: this.getDetailInclude(),
    });

    if (!form) throw new NotFoundException('Form not found');
    if (userId && form.userId !== userId) {
      throw new ForbiddenException('Not authorized to access this form');
    }

    return this.transformFormWithUser(form);
  }

  /**
   * Find form by slug (with caching for public access)
   */
  async findBySlug(slug: string) {
    const cacheKey = `form:slug:${slug}`;

    // Try cache first
    try {
      const cached = await this.redisService.get(cacheKey);
      if (cached) {
        const form = cached;
        // Increment view count async (don't wait)
        this.incrementViewCount(form.id).catch(() => {});
        return form;
      }
    } catch (e) {
      // Cache miss
    }

    const form = await this.prisma.form.findUnique({
      where: { slug },
      include: this.getDetailInclude(),
    });

    if (!form) throw new NotFoundException('Form not found');

    // Increment view count async
    this.incrementViewCount(form.id).catch(() => {});

    const transformed = await this.transformFormWithUser(form);

    // Cache only published forms
    if (form.status === 'PUBLISHED') {
      try {
        await this.redisService.set(
          cacheKey,
          JSON.stringify(transformed),
          this.CACHE_TTL.FORM_BY_SLUG,
        );
      } catch (e) {
        // Cache write failed
      }
    }

    return transformed;
  }

  /**
   * Get form steps
   */
  async getFormSteps(userId: string, formId: string) {
    const form = await this.prisma.form.findUnique({ where: { id: formId } });

    if (!form) throw new NotFoundException('Form not found');
    if (form.userId !== userId) throw new ForbiddenException('Not authorized');

    return this.prisma.form_steps.findMany({
      where: { formId },
      orderBy: { order: 'asc' },
      include: { form_fields: { orderBy: { order: 'asc' } } },
    });
  }

  // ============ Private Helpers ============

  private async incrementViewCount(formId: string) {
    await this.prisma.form
      .update({
        where: { id: formId },
        data: { viewCount: { increment: 1 } },
      })
      .catch(() => {});
  }

  private async getPresignedUrl(key: string | null): Promise<string | null> {
    if (!key || key.startsWith('http')) return key;
    try {
      return await this.s3Service.getPresignedGetUrl(this.bucket, key, 3600);
    } catch (e) {
      return null;
    }
  }

  private async transformFormImages(form: any) {
    if (!form?.coverImage || form.coverImage.startsWith('http')) return form;
    return { ...form, coverImage: await this.getPresignedUrl(form.coverImage) };
  }

  private async transformFormWithUser(form: any) {
    const coverImage = await this.getPresignedUrl(form.coverImage);

    const bannerImages: string[] = [];
    if (form.bannerImages?.length) {
      for (const img of form.bannerImages) {
        const url = await this.getPresignedUrl(img);
        if (url) bannerImages.push(url);
      }
    }

    let userWithUrls = form.user;
    if (form.user?.profile) {
      const avatar = await this.getPresignedUrl(form.user.profile.avatar);
      const coverImageUser = await this.getPresignedUrl(
        form.user.profile.coverImage,
      );
      userWithUrls = {
        ...form.user,
        profile: { ...form.user.profile, avatar, coverImage: coverImageUser },
      };
    }

    return { ...form, coverImage, bannerImages, user: userWithUrls };
  }

  private getDetailInclude() {
    return {
      fields: { orderBy: { order: 'asc' as const } },
      steps: {
        orderBy: { order: 'asc' as const },
        include: { form_fields: { orderBy: { order: 'asc' as const } } },
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
      events: { select: { id: true, title: true, slug: true } },
      _count: { select: { submissions: true } },
    };
  }
}
