import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma/prisma.service';
import { CacheManager } from '../../core/cache/cache.manager';
import { CacheKeys, CACHE_TTL, CACHE_TAGS } from '../../core/cache/cache.constants';
import { CreateStoreDto, StoreStatus } from './dto/create-store.dto';
import { UpdateStoreDto } from './dto/update-store.dto';
import { v4 as uuidv4 } from 'uuid';
import S3Service from '../../services/s3.service';

@Injectable()
export class StoresService {
  private readonly logger = new Logger(StoresService.name);
  private readonly bucket = process.env.S3_BUCKET || 'rukny-storage';

  constructor(
    private prisma: PrismaService,
    private readonly cacheManager: CacheManager,
    @Inject(forwardRef(() => S3Service))
    private readonly s3Service: S3Service,
  ) {}

  /**
   * Create a new store
   */
  async create(userId: string, createStoreDto: CreateStoreDto) {
    // Generate slug if not provided
    let slug = createStoreDto.slug;

    if (!slug) {
      slug = await this.generateUniqueSlug(createStoreDto.name);
    } else {
      // Check if slug exists
      const existing = await this.prisma.store.findUnique({ where: { slug } });
      if (existing) {
        throw new BadRequestException('Store slug already exists');
      }
    }

    // Check if user already has a store
    const existingStore = await this.prisma.store.findFirst({
      where: { userId },
    });

    if (existingStore) {
      throw new BadRequestException(
        'You already have a store. Each user can only have one store.',
      );
    }

    // Prepare data for creation
    const { categoryId, status, ...restDto } = createStoreDto;

    const store = await this.prisma.store.create({
      data: {
        ...restDto,
        slug,
        userId,
        country: createStoreDto.country || 'Iraq',
        ...(status && { status: status as any }),
        ...(categoryId && { categoryId }),
      },
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
        store_categories: true,
        _count: {
          select: {
            products: true,
            orders: true,
          },
        },
      },
    });

    return store;
  }

  /**
   * Get user's store
   * ⚡ Performance: Cached for 5 minutes
   * 🏪 Auto-creates store if user doesn't have one (e.g., OAuth registration)
   */
  async getMyStore(userId: string) {
    const cacheKey = CacheKeys.storeByUserId(userId);

    return this.cacheManager.wrap(cacheKey, CACHE_TTL.STORE, async () => {
      let store = await this.prisma.store.findFirst({
        where: { userId },
        include: {
          store_categories: true,
          _count: {
            select: {
              products: true,
              orders: true,
            },
          },
        },
      });

      // Auto-create store if none exists (handles OAuth registrations)
      if (!store) {
        this.logger.log(`Auto-creating store for user ${userId}`);

        const user = await this.prisma.user.findUnique({
          where: { id: userId },
          include: { profile: true },
        });

        if (!user) return null;

        const storeName = user.profile?.name || 'متجري';
        const slug = await this.generateUniqueSlug(
          user.profile?.username || storeName,
        );

        store = await this.prisma.store.create({
          data: {
            slug,
            userId,
            name: storeName,
            contactEmail: user.email || undefined,
            country: 'Iraq',
          },
          include: {
            store_categories: true,
            _count: {
              select: {
                products: true,
                orders: true,
              },
            },
          },
        });
      }

      return store;
    });
  }

  /**
   * Get store by ID
   */
  async findOne(id: string) {
    const store = await this.prisma.store.findUnique({
      where: { id },
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
        store_categories: true,
        products: {
          where: { status: 'ACTIVE' },
          take: 10,
          orderBy: { createdAt: 'desc' },
          include: {
            product_images: true,
          },
        },
        _count: {
          select: {
            products: true,
            orders: true,
          },
        },
      },
    });

    if (!store) {
      throw new NotFoundException('Store not found');
    }

    return store;
  }

  /**
   * Get store by slug
   * ⚡ Performance: Cached for 5 minutes
   */
  async findBySlug(slug: string) {
    const cacheKey = CacheKeys.storeBySlug(slug);

    return this.cacheManager.wrap(cacheKey, CACHE_TTL.STORE, async () => {
      const store = await this.prisma.store.findUnique({
        where: { slug },
        include: {
          user: {
            select: {
              id: true,
              profile: {
                select: {
                  name: true,
                  avatar: true,
                },
              },
            },
          },
          store_categories: true,
          products: {
            where: { status: 'ACTIVE' },
            take: 20,
            orderBy: { createdAt: 'desc' },
            include: {
              product_images: true,
            },
          },
          _count: {
            select: {
              products: true,
            },
          },
        },
      });

      if (!store) {
        throw new NotFoundException('Store not found');
      }

      return store;
    });
  }

  /**
   * Update store
   */
  async update(id: string, userId: string, updateStoreDto: UpdateStoreDto) {
    const store = await this.prisma.store.findUnique({ where: { id } });

    if (!store) {
      throw new NotFoundException('Store not found');
    }

    if (store.userId !== userId) {
      throw new ForbiddenException('You can only update your own store');
    }

    // Check slug uniqueness if updating
    if (updateStoreDto.slug && updateStoreDto.slug !== store.slug) {
      const existing = await this.prisma.store.findUnique({
        where: { slug: updateStoreDto.slug },
      });
      if (existing) {
        throw new BadRequestException('Store slug already exists');
      }
    }

    // Prepare data for update
    const { categoryId, status, ...restDto } = updateStoreDto;

    const updatedStore = await this.prisma.store.update({
      where: { id },
      data: {
        ...restDto,
        ...(status && { status: status as any }),
        ...(categoryId !== undefined && { categoryId: categoryId || null }),
      },
      include: {
        store_categories: true,
        _count: {
          select: {
            products: true,
            orders: true,
          },
        },
      },
    });

    // ⚡ Invalidate cache
    const keysToInvalidate = [
      CacheKeys.storeByUserId(userId),
      CacheKeys.storeBySlug(store.slug),
      CacheKeys.dashboardStats(userId),
    ];
    if (updateStoreDto.slug && store.slug !== updateStoreDto.slug) {
      keysToInvalidate.push(CacheKeys.storeBySlug(updateStoreDto.slug));
    }
    await this.cacheManager.invalidate(...keysToInvalidate);

    return updatedStore;
  }

  /**
   * Get store analytics settings (Google Analytics)
   */
  async getAnalyticsSettings(userId: string) {
    const store = await this.prisma.store.findFirst({ where: { userId } });
    if (!store) throw new NotFoundException('Store not found');

    const metadata = (store.metadata as Record<string, unknown>) || {};
    return {
      googleAnalyticsId: (metadata.googleAnalyticsId as string) || '',
      isConnected: !!metadata.googleAnalyticsId,
    };
  }

  /**
   * Update store analytics settings (Google Analytics)
   */
  async updateAnalyticsSettings(
    userId: string,
    googleAnalyticsId: string | undefined,
  ) {
    const store = await this.prisma.store.findFirst({ where: { userId } });
    if (!store) throw new NotFoundException('Store not found');

    const currentMetadata = (store.metadata as Record<string, unknown>) || {};
    const updatedMetadata = {
      ...currentMetadata,
      googleAnalyticsId: googleAnalyticsId || null,
      googleAnalyticsConnectedAt: googleAnalyticsId ? new Date().toISOString() : null,
    };

    const updatedStore = await this.prisma.store.update({
      where: { id: store.id },
      data: { metadata: updatedMetadata },
    });

    // Invalidate cache
    await this.cacheManager.invalidate(
      CacheKeys.storeByUserId(userId),
      CacheKeys.storeBySlug(store.slug),
    );

    return {
      googleAnalyticsId: googleAnalyticsId || '',
      isConnected: !!googleAnalyticsId,
    };
  }

  /**
   * Delete store
   */
  async remove(id: string, userId: string) {
    const store = await this.prisma.store.findUnique({ where: { id } });

    if (!store) {
      throw new NotFoundException('Store not found');
    }

    if (store.userId !== userId) {
      throw new ForbiddenException('You can only delete your own store');
    }

    await this.prisma.store.delete({ where: { id } });

    // ⚡ Invalidate cache
    await this.cacheManager.invalidate(
      CacheKeys.storeByUserId(userId),
      CacheKeys.storeBySlug(store.slug),
      CacheKeys.storeById(id),
      CacheKeys.dashboardStats(userId),
    );

    return { message: 'Store deleted successfully' };
  }

  /**
   * Get store statistics
   */
  async getStoreStats(userId: string) {
    const store = await this.prisma.store.findFirst({
      where: { userId },
    });

    if (!store) {
      return {
        hasStore: false,
        totalProducts: 0,
        activeProducts: 0,
        outOfStock: 0,
        totalOrders: 0,
        totalRevenue: 0,
      };
    }

    const [productStats, orderStats] = await Promise.all([
      this.prisma.products.groupBy({
        by: ['status'],
        where: { storeId: store.id },
        _count: true,
      }),
      this.prisma.orders.aggregate({
        where: { storeId: store.id },
        _count: true,
        _sum: { total: true },
      }),
    ]);

    const totalProducts = productStats.reduce((sum, s) => sum + s._count, 0);
    const activeProducts =
      productStats.find((s) => s.status === 'ACTIVE')?._count || 0;
    const outOfStock =
      productStats.find((s) => s.status === 'OUT_OF_STOCK')?._count || 0;

    return {
      hasStore: true,
      storeId: store.id,
      storeName: store.name,
      storeStatus: store.status,
      totalProducts,
      activeProducts,
      outOfStock,
      totalOrders: orderStats._count || 0,
      totalRevenue: Number(orderStats._sum?.total || 0),
    };
  }

  /**
   * Check if slug is available
   */
  async checkSlugAvailability(slug: string) {
    const existing = await this.prisma.store.findUnique({
      where: { slug },
      select: { id: true },
    });

    if (existing) {
      return { available: false, message: 'هذا الرابط مستخدم بالفعل' };
    }

    throw new NotFoundException('Slug is available');
  }

  /**
   * Get store categories
   * ⚡ Performance: Cached for 1 hour (categories rarely change)
   */
  async getStoreCategories() {
    const cacheKey = CacheKeys.storeCategories();

    return this.cacheManager.wrap(
      cacheKey,
      CACHE_TTL.CATEGORIES,
      async () => {
        const categories = await this.prisma.store_categories.findMany({
          where: { isActive: true },
          orderBy: { order: 'asc' },
          select: {
            id: true,
            name: true,
            nameAr: true,
            slug: true,
            icon: true,
            color: true,
          },
        });

        return { categories };
      },
      { tags: [CACHE_TAGS.CATEGORY] },
    );
  }

  /**
   * 🛍️ الحصول على منتجات المستخدم حسب username
   */
  async getProductsByUsername(
    username: string,
    options: {
      limit?: number;
      page?: number;
      categoryId?: string;
      search?: string;
    } = {},
  ) {
    const { limit = 12, page = 1, categoryId, search } = options;

    // البحث عن المستخدم بالـ username
    const user = await this.prisma.user.findFirst({
      where: {
        profile: { username },
      },
      select: { id: true },
    });

    if (!user) {
      throw new NotFoundException('المستخدم غير موجود');
    }

    // البحث عن متجر المستخدم
    const store = await this.prisma.store.findFirst({
      where: { userId: user.id },
      select: { id: true },
    });

    if (!store) {
      return { products: [], total: 0, storeId: null };
    }

    // بناء شروط البحث
    const where: any = {
      storeId: store.id,
      status: 'ACTIVE',
    };

    if (categoryId) {
      where.categoryId = categoryId;
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    // جلب المنتجات
    const [products, total] = await Promise.all([
      this.prisma.products.findMany({
        where,
        take: limit,
        skip: (page - 1) * limit,
        orderBy: { createdAt: 'desc' },
        include: {
          product_images: {
            select: { imagePath: true },
            orderBy: { displayOrder: 'asc' },
          },
          product_categories: {
            select: { id: true, name: true },
          },
        },
      }),
      this.prisma.products.count({ where }),
    ]);

    // تحويل الصور إلى presigned URLs
    const formattedProducts = await Promise.all(
      products.map(async (product) => {
        const images = await Promise.all(
          product.product_images.map(async (img) => {
            let url = img.imagePath;
            // إذا لم يكن رابط كامل، نحوله إلى presigned URL
            if (!img.imagePath.startsWith('http')) {
              try {
                url = await this.s3Service.getPresignedGetUrl(
                  this.bucket,
                  img.imagePath,
                  3600,
                );
              } catch (error) {
                this.logger.warn(
                  `Failed to generate presigned URL for ${img.imagePath}`,
                );
                // Fallback to public S3 URL
                url = `https://${this.bucket}.s3.${process.env.AWS_REGION || 'eu-north-1'}.amazonaws.com/${img.imagePath}`;
              }
            }
            return url;
          }),
        );

        return {
          id: product.id,
          name: product.name,
          description: product.description,
          price: Number(product.price),
          salePrice: product.salePrice ? Number(product.salePrice) : null,
          currency: product.currency,
          quantity: product.quantity,
          stock: product.quantity,
          sku: product.sku,
          images,
          category: product.product_categories,
        };
      }),
    );

    return {
      products: formattedProducts,
      total,
      storeId: store.id,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * 📂 الحصول على فئات منتجات المستخدم حسب username
   */
  async getCategoriesByUsername(username: string) {
    // البحث عن المستخدم
    const user = await this.prisma.user.findFirst({
      where: {
        profile: { username },
      },
      select: { id: true },
    });

    if (!user) {
      throw new NotFoundException('المستخدم غير موجود');
    }

    // البحث عن متجر المستخدم
    const store = await this.prisma.store.findFirst({
      where: { userId: user.id },
      select: { id: true },
    });

    if (!store) {
      return [];
    }

    // جلب الفئات التي لديها منتجات
    const categories = await this.prisma.product_categories.findMany({
      where: {
        storeId: store.id,
        products: {
          some: { status: 'ACTIVE' },
        },
      },
      select: {
        id: true,
        name: true,
        _count: {
          select: {
            products: {
              where: { status: 'ACTIVE' },
            },
          },
        },
      },
      orderBy: { name: 'asc' },
    });

    return categories;
  }

  /**
   * Generate unique slug from name
   */
  private async generateUniqueSlug(name: string): Promise<string> {
    // Create base slug from name
    let baseSlug = name
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .slice(0, 40);

    // If empty (e.g., Arabic only name), generate random
    if (!baseSlug) {
      baseSlug = `store-${uuidv4().slice(0, 8)}`;
    }

    let slug = baseSlug;
    let counter = 1;

    while (true) {
      const existing = await this.prisma.store.findUnique({ where: { slug } });
      if (!existing) break;
      slug = `${baseSlug}-${counter}`;
      counter++;
    }

    return slug;
  }
}
