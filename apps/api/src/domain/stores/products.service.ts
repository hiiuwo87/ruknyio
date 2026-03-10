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
import { RedisService } from '../../core/cache/redis.service';
import { CreateProductDto, ProductStatus } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { v4 as uuidv4 } from 'uuid';
import { nanoid } from 'nanoid';
import { CacheManager } from '../../core/cache/cache.manager';
import S3Service from '../../services/s3.service';

@Injectable()
export class ProductsService {
  private readonly logger = new Logger(ProductsService.name);
  private readonly bucket = process.env.S3_BUCKET || 'rukny-storage';

  constructor(
    private prisma: PrismaService,
    private readonly redisService: RedisService,
    private readonly cacheManager: CacheManager,
    @Inject(forwardRef(() => S3Service))
    private readonly s3Service: S3Service,
  ) {}

  /**
   * Create a new product with optional variants and attributes
   */
  async create(userId: string, createProductDto: CreateProductDto) {
    // Get user's store
    const store = await this.prisma.store.findFirst({
      where: { userId },
      include: { store_categories: true },
    });

    if (!store) {
      throw new BadRequestException(
        'You need to create a store first before adding products',
      );
    }

    // Generate slug if not provided
    let slug = createProductDto.slug;
    if (!slug) {
      slug = await this.generateUniqueSlug(createProductDto.name);
    } else {
      const existing = await this.prisma.products.findUnique({
        where: { slug },
      });
      if (existing) {
        throw new BadRequestException('Product slug already exists');
      }
    }

    const {
      images,
      categoryId,
      status,
      variants,
      productAttributes,
      hasVariants: hasVariantsInput,
      trackInventory: trackInventoryInput,
      ...productData
    } = createProductDto;

    // حساب قيم hasVariants و trackInventory
    const hasVariantsValue =
      hasVariantsInput || (variants && variants.length > 0) || false;
    const trackInventoryValue = trackInventoryInput ?? true;

    // إنشاء المنتج مع المتغيرات والخصائص في transaction واحد
    const product = await this.prisma.$transaction(async (tx) => {
      // إنشاء المنتج الأساسي
      const newProduct = await tx.products.create({
        data: {
          id: uuidv4(),
          ...productData,
          slug,
          storeId: store.id,
          // @ts-ignore - حقول جديدة قد لا يعرفها الـ Prisma Client حتى يتم إعادة التوليد
          hasVariants: hasVariantsValue,
          // @ts-ignore
          trackInventory: trackInventoryValue,
          updatedAt: new Date(),
          ...(status && { status: status as any }),
          ...(categoryId && { categoryId }),
        },
      });

      // إضافة الصور
      if (images && images.length > 0) {
        await tx.product_images.createMany({
          data: images.map((url, index) => ({
            id: uuidv4(),
            productId: newProduct.id,
            imagePath: url,
            displayOrder: index,
            isPrimary: index === 0,
          })),
        });
      }

      // إضافة المتغيرات (المقاسات، الألوان)
      if (variants && variants.length > 0) {
        // @ts-ignore - جدول جديد
        await tx.product_variants.createMany({
          data: variants.map((v) => ({
            id: `var_${nanoid(12)}`,
            productId: newProduct.id,
            sku:
              v.sku ||
              `${newProduct.sku || newProduct.id.substring(0, 8)}-${nanoid(6)}`,
            price: v.price,
            compareAtPrice: v.compareAtPrice,
            stock: v.stock,
            attributes: v.attributes,
            imageUrl: v.imageUrl,
            isActive: v.isActive ?? true,
          })),
        });

        this.logger.log(
          `Created ${variants.length} variants for product ${newProduct.id}`,
        );
      }

      // إضافة الخصائص الديناميكية (المؤلف، الضمان، طريقة التوصيل، إلخ)
      if (productAttributes && productAttributes.length > 0) {
        // @ts-ignore - جدول جديد
        await tx.product_attributes.createMany({
          data: productAttributes.map((attr) => ({
            id: `attr_${nanoid(12)}`,
            productId: newProduct.id,
            key: attr.key,
            value: attr.value,
            valueAr: attr.valueAr,
          })),
        });

        this.logger.log(
          `Created ${productAttributes.length} attributes for product ${newProduct.id}`,
        );
      }

      return newProduct;
    });

    // Invalidate dashboard cache for store owner
    try {
      if (store && store.userId) {
        await this.redisService.del(`dashboard:stats:${store.userId}`);
      }
    } catch (err) {
      this.logger.warn(
        'Redis del error (product create): ' + (err?.message || err),
      );
    }

    return this.findOne(product.id, userId);
  }

  /**
   * Get all products for user's store
   */
  async getMyProducts(
    userId: string,
    filters?: {
      status?: ProductStatus;
      categoryId?: string;
      search?: string;
      isFeatured?: boolean;
    },
  ) {
    const store = await this.prisma.store.findFirst({
      where: { userId },
    });

    if (!store) {
      return [];
    }

    const where: any = { storeId: store.id };

    if (filters?.status) {
      where.status = filters.status;
    }

    if (filters?.categoryId) {
      where.categoryId = filters.categoryId;
    }

    if (filters?.isFeatured !== undefined) {
      where.isFeatured = filters.isFeatured;
    }

    if (filters?.search) {
      where.OR = [
        { name: { contains: filters.search, mode: 'insensitive' } },
        { nameAr: { contains: filters.search, mode: 'insensitive' } },
        { description: { contains: filters.search, mode: 'insensitive' } },
        { sku: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    const cacheKey = `products:my:${userId}:${JSON.stringify(filters || {})}`;
    const products = await this.cacheManager.wrap(cacheKey, 30, async () => {
      return this.prisma.products.findMany({
        where,
        include: {
          product_images: {
            orderBy: { displayOrder: 'asc' },
          },
          product_categories: true,
          _count: {
            select: {
              order_items: true,
              reviews: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });
    });

    // تحويل imagePath إلى presigned URLs للصور
    const productsWithUrls = await Promise.all(
      products.map(async (product) => {
        const imagesWithUrls = await Promise.all(
          product.product_images.map(async (img) => {
            let url = img.imagePath;
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
                url = `https://${this.bucket}.s3.${process.env.AWS_REGION || 'eu-north-1'}.amazonaws.com/${img.imagePath}`;
              }
            }
            return { ...img, imagePath: url };
          }),
        );
        return { ...product, product_images: imagesWithUrls };
      }),
    );

    return productsWithUrls;
  }

  /**
   * Get single product by ID with variants and attributes
   */
  async findOne(id: string, userId?: string) {
    const product = await this.prisma.products.findUnique({
      where: { id },
      include: {
        product_images: {
          orderBy: { displayOrder: 'asc' },
        },
        product_categories: true,
        // @ts-ignore - تضمين المتغيرات والخصائص الديناميكية
        variants: {
          where: { isActive: true },
          orderBy: { createdAt: 'asc' },
        },
        // @ts-ignore
        productAttributes: {
          orderBy: { key: 'asc' },
        },
        stores: {
          select: {
            id: true,
            name: true,
            slug: true,
            userId: true,
            categoryId: true,
            store_categories: {
              select: {
                id: true,
                name: true,
                nameAr: true,
                templateFields: true,
              },
            },
          },
        },
        reviews: {
          take: 10,
          orderBy: { createdAt: 'desc' },
          include: {
            users: {
              select: {
                profile: {
                  select: {
                    name: true,
                    avatar: true,
                  },
                },
              },
            },
          },
        },
        _count: {
          select: {
            order_items: true,
            reviews: true,
            // @ts-ignore
            variants: true,
          },
        },
      },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    return product;
  }

  /**
   * Get product by slug
   */
  async findBySlug(slug: string) {
    const product = await this.prisma.products.findUnique({
      where: { slug },
      include: {
        product_images: {
          orderBy: { displayOrder: 'asc' },
        },
        product_categories: true,
        stores: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
        reviews: {
          take: 10,
          orderBy: { createdAt: 'desc' },
        },
        _count: {
          select: {
            reviews: true,
          },
        },
      },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    return product;
  }

  /**
   * Update product
   */
  async update(id: string, userId: string, updateProductDto: UpdateProductDto) {
    const product = await this.prisma.products.findUnique({
      where: { id },
      include: {
        stores: true,
      },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    if (product.stores.userId !== userId) {
      throw new ForbiddenException('You can only update your own products');
    }

    // Check slug uniqueness if updating
    if (updateProductDto.slug && updateProductDto.slug !== product.slug) {
      const existing = await this.prisma.products.findUnique({
        where: { slug: updateProductDto.slug },
      });
      if (existing) {
        throw new BadRequestException('Product slug already exists');
      }
    }

    const {
      images,
      categoryId,
      status,
      variants,
      productAttributes,
      hasVariants,
      trackInventory,
      ...productData
    } = updateProductDto;

    const updatedProduct = await this.prisma.products.update({
      where: { id },
      data: {
        ...productData,
        updatedAt: new Date(),
        ...(status && { status: status as any }),
        ...(categoryId !== undefined && { categoryId: categoryId || null }),
      },
      include: {
        product_images: {
          orderBy: { displayOrder: 'asc' },
        },
        product_categories: true,
        stores: {
          select: {
            id: true,
            name: true,
            slug: true,
            userId: true,
          },
        },
      },
    });

    // Update images if provided
    if (images !== undefined) {
      // Delete existing images
      await this.prisma.product_images.deleteMany({
        where: { productId: id },
      });

      // Add new images
      if (images.length > 0) {
        await this.prisma.product_images.createMany({
          data: images.map((url, index) => ({
            id: uuidv4(),
            productId: id,
            imagePath: url,
            displayOrder: index,
            isPrimary: index === 0,
          })),
        });
      }
    }

    // Invalidate dashboard cache for store owner
    try {
      const ownerId = updatedProduct.stores?.userId;
      if (ownerId) {
        await this.redisService.del(`dashboard:stats:${ownerId}`);
      }
    } catch (err) {
      this.logger.warn(
        'Redis del error (product update): ' + (err?.message || err),
      );
    }

    return this.findOne(id, userId);
  }

  /**
   * Delete product
   */
  async remove(id: string, userId: string) {
    const product = await this.prisma.products.findUnique({
      where: { id },
      include: {
        stores: true,
        product_images: true,
      },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    if (product.stores.userId !== userId) {
      throw new ForbiddenException('You can only delete your own products');
    }

    // حذف الصور من S3
    if (product.product_images && product.product_images.length > 0) {
      for (const image of product.product_images) {
        try {
          // تحقق مما إذا كان المسار هو مفتاح S3 (لا يبدأ بـ http)
          if (!image.imagePath.startsWith('http')) {
            await this.s3Service.deleteObject(this.bucket, image.imagePath);
            this.logger.debug(`تم حذف الصورة من S3: ${image.imagePath}`);
          }
        } catch (error) {
          this.logger.warn(
            `فشل حذف الصورة من S3: ${image.imagePath} - ${error.message}`,
          );
        }
      }
    }

    await this.prisma.products.delete({ where: { id } });

    // Invalidate dashboard cache for store owner
    try {
      const ownerId = product.stores?.userId;
      if (ownerId) {
        await this.redisService.del(`dashboard:stats:${ownerId}`);
      }
    } catch (err) {
      this.logger.warn(
        'Redis del error (product delete): ' + (err?.message || err),
      );
    }

    return { message: 'Product deleted successfully' };
  }

  /**
   * Get product statistics
   */
  async getProductStats(userId: string) {
    const store = await this.prisma.store.findFirst({
      where: { userId },
    });

    if (!store) {
      return {
        totalProducts: 0,
        activeProducts: 0,
        outOfStock: 0,
        featuredProducts: 0,
        lowStock: 0,
      };
    }

    const [statusCounts, featuredCount, lowStockCount] = await Promise.all([
      this.prisma.products.groupBy({
        by: ['status'],
        where: { storeId: store.id },
        _count: true,
      }),
      this.prisma.products.count({
        where: { storeId: store.id, isFeatured: true },
      }),
      this.prisma.products.count({
        where: { storeId: store.id, quantity: { lte: 5, gt: 0 } },
      }),
    ]);

    const totalProducts = statusCounts.reduce((sum, s) => sum + s._count, 0);
    const activeProducts =
      statusCounts.find((s) => s.status === 'ACTIVE')?._count || 0;
    const outOfStock =
      statusCounts.find((s) => s.status === 'OUT_OF_STOCK')?._count || 0;

    return {
      totalProducts,
      activeProducts,
      outOfStock,
      featuredProducts: featuredCount,
      lowStock: lowStockCount,
    };
  }

  /**
   * Get top products for store dashboard (sorted by order count)
   */
  async getTopProducts(userId: string, limit: number = 5) {
    const store = await this.prisma.store.findFirst({
      where: { userId },
    });

    if (!store) {
      return { data: [] };
    }

    const cacheKey = `products:top:${store.id}:${limit}`;
    const products = await this.cacheManager.wrap(cacheKey, 60, async () => {
      return this.prisma.products.findMany({
        where: {
          storeId: store.id,
          status: 'ACTIVE',
        },
        include: {
          product_images: {
            where: { isPrimary: true },
            take: 1,
          },
          _count: {
            select: {
              order_items: true,
              reviews: true,
            },
          },
        },
        orderBy: {
          order_items: {
            _count: 'desc',
          },
        },
        take: limit,
      });
    });

    // Generate presigned URLs for images
    const productsWithUrls = await Promise.all(
      products.map(async (product) => {
        let imageUrl = product.product_images[0]?.imagePath || null;
        if (imageUrl && !imageUrl.startsWith('http')) {
          try {
            imageUrl = await this.s3Service.getPresignedGetUrl(
              this.bucket,
              imageUrl,
              3600,
            );
          } catch (error) {
            this.logger.warn(
              `Failed to generate presigned URL for ${imageUrl}`,
            );
            imageUrl = `https://${this.bucket}.s3.${process.env.AWS_REGION || 'eu-north-1'}.amazonaws.com/${imageUrl}`;
          }
        }

        return {
          id: product.id,
          name: product.name,
          nameAr: product.nameAr,
          price: product.price,
          image: imageUrl,
          ordersCount: product._count.order_items,
          reviewsCount: product._count.reviews,
          status: product.status,
        };
      }),
    );

    return { data: productsWithUrls };
  }

  /**
   * Generate unique slug
   */
  private async generateUniqueSlug(name: string): Promise<string> {
    let baseSlug = name
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .slice(0, 80);

    if (!baseSlug) {
      baseSlug = `product-${uuidv4().slice(0, 8)}`;
    }

    let slug = baseSlug;
    let counter = 1;

    while (true) {
      const existing = await this.prisma.products.findUnique({
        where: { slug },
      });
      if (!existing) break;
      slug = `${baseSlug}-${counter}`;
      counter++;
    }

    return slug;
  }
}
