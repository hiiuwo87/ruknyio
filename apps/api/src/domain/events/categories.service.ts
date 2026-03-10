import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  OnModuleInit,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma/prisma.service';
import { CacheManager } from '../../core/cache/cache.manager';
import { CacheKeys, CACHE_TTL, CACHE_TAGS } from '../../core/cache/cache.constants';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { sanitizeInput } from './utils/event.utils';
import { EVENT_ERRORS } from './constants/event.constants';

@Injectable()
export class CategoriesService implements OnModuleInit {
  private readonly logger = new Logger(CategoriesService.name);

  constructor(
    private prisma: PrismaService,
    private cacheManager: CacheManager,
  ) {}

  /**
   * 🔥 Cache Warming - تحميل التصنيفات في الكاش عند بدء التشغيل
   */
  async onModuleInit() {
    try {
      this.logger.log('🔥 Warming categories cache...');
      await this.findAll(); // This will cache the categories
      this.logger.log('✅ Categories cache warmed successfully');
    } catch (error) {
      this.logger.warn(`⚠️ Failed to warm categories cache: ${error.message}`);
    }
  }

  /**
   * Create a new category
   * Admin only
   */
  async create(createCategoryDto: CreateCategoryDto) {
    // Sanitize inputs
    const name = sanitizeInput(createCategoryDto.name);
    const nameAr = createCategoryDto.nameAr
      ? sanitizeInput(createCategoryDto.nameAr)
      : name;

    // Generate slug from name
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-');

    // Check if category with same slug already exists
    const existingCategory = await this.prisma.eventCategory.findUnique({
      where: { slug },
    });

    if (existingCategory) {
      throw new ConflictException('Category with this name already exists');
    }

    return this.prisma.eventCategory.create({
      data: {
        name,
        nameAr,
        slug,
        description: createCategoryDto.description
          ? sanitizeInput(createCategoryDto.description)
          : null,
        icon: createCategoryDto.icon
          ? sanitizeInput(createCategoryDto.icon)
          : null,
        color: createCategoryDto.color || null,
      },
      include: {
        _count: {
          select: { events: true },
        },
      },
    });
  }

  /**
   * Get all categories
   * Public endpoint - ✅ Cached for 1 hour
   */
  async findAll() {
    return this.cacheManager.wrap(
      CacheKeys.eventCategories(),
      CACHE_TTL.CATEGORIES,
      async () => {
        return this.prisma.eventCategory.findMany({
          include: {
            _count: {
              select: { events: true },
            },
          },
          orderBy: {
            name: 'asc',
          },
        });
      },
      { tags: [CACHE_TAGS.CATEGORY] },
    );
  }

  /**
   * Get a single category by ID
   * Public endpoint
   */
  async findOne(id: string) {
    const category = await this.prisma.eventCategory.findUnique({
      where: { id },
      include: {
        _count: {
          select: { events: true },
        },
      },
    });

    if (!category) {
      throw new NotFoundException('Category not found');
    }

    return category;
  }

  /**
   * Get events by category
   * Public endpoint
   */
  async getEventsByCategory(categoryId: string, onlyActive: boolean = true) {
    // Check if category exists
    const category = await this.findOne(categoryId);

    const where: any = {
      categoryId,
    };

    if (onlyActive) {
      where.status = 'PUBLISHED';
      where.startDate = {
        gte: new Date(),
      };
    }

    return this.prisma.event.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            email: true,
            profile: {
              select: {
                name: true,
                avatar: true,
              },
            },
          },
        },
        category: true,
        _count: {
          select: {
            registrations: true,
            reviews: true,
          },
        },
      },
      orderBy: {
        startDate: 'asc',
      },
    });
  }

  /**
   * Update a category
   * Admin only
   */
  async update(id: string, updateCategoryDto: UpdateCategoryDto) {
    // Check if category exists
    await this.findOne(id);

    // Sanitize inputs
    const sanitizedData: any = {};

    if (updateCategoryDto.name) {
      sanitizedData.name = sanitizeInput(updateCategoryDto.name);

      // Generate new slug from name
      const newSlug = sanitizedData.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-');

      // Check if new slug already exists (excluding current category)
      const existingCategory = await this.prisma.eventCategory.findFirst({
        where: {
          slug: newSlug,
          id: { not: id },
        },
      });

      if (existingCategory) {
        throw new ConflictException('Category with this name already exists');
      }

      sanitizedData.slug = newSlug;
    }

    if (updateCategoryDto.nameAr !== undefined) {
      sanitizedData.nameAr = updateCategoryDto.nameAr
        ? sanitizeInput(updateCategoryDto.nameAr)
        : null;
    }

    if (updateCategoryDto.description !== undefined) {
      sanitizedData.description = updateCategoryDto.description
        ? sanitizeInput(updateCategoryDto.description)
        : null;
    }

    if (updateCategoryDto.icon !== undefined) {
      sanitizedData.icon = updateCategoryDto.icon
        ? sanitizeInput(updateCategoryDto.icon)
        : null;
    }

    if (updateCategoryDto.color !== undefined) {
      sanitizedData.color = updateCategoryDto.color;
    }

    const result = await this.prisma.eventCategory.update({
      where: { id },
      data: sanitizedData,
      include: {
        _count: {
          select: { events: true },
        },
      },
    });

    // 🔥 Invalidate categories cache
    await this.cacheManager.invalidateByTags(CACHE_TAGS.CATEGORY);

    return result;
  }

  /**
   * Delete a category
   * Admin only
   * Cannot delete if category has events
   */
  async remove(id: string) {
    // Check if category exists
    const category = await this.findOne(id);

    // Check if category has events
    const eventsCount = await this.prisma.event.count({
      where: { categoryId: id },
    });

    if (eventsCount > 0) {
      throw new BadRequestException(
        `Cannot delete category with ${eventsCount} event(s). Please reassign or delete events first.`,
      );
    }

    await this.prisma.eventCategory.delete({
      where: { id },
    });

    // 🔥 Invalidate categories cache
    await this.cacheManager.invalidateByTags(CACHE_TAGS.CATEGORY);

    return { message: 'Category deleted successfully' };
  }

  /**
   * Get category statistics
   * Admin only
   */
  async getStatistics() {
    const categories = await this.prisma.eventCategory.findMany({
      include: {
        _count: {
          select: { events: true },
        },
      },
    });

    const totalCategories = categories.length;
    const totalEvents = categories.reduce((sum, c) => sum + c._count.events, 0);

    return {
      totalCategories,
      totalEvents,
      categories: categories.map((c) => ({
        id: c.id,
        name: c.name,
        nameAr: c.nameAr,
        slug: c.slug,
        eventsCount: c._count.events,
      })),
    };
  }
}
