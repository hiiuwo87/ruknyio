import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma/prisma.service';
import {
  CreateReviewDto,
  UpdateReviewDto,
  ReviewFiltersDto,
  ReviewSortBy,
} from './dto/review.dto';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class ReviewsService {
  constructor(private prisma: PrismaService) {}

  /**
   * Create a new review
   */
  async createReview(userId: string, createReviewDto: CreateReviewDto) {
    const { productId, rating, comment } = createReviewDto;

    // Check if product exists
    const product = await this.prisma.products.findUnique({
      where: { id: productId },
      include: {
        stores: {
          select: { userId: true },
        },
      },
    });

    if (!product) {
      throw new NotFoundException('المنتج غير موجود');
    }

    // Prevent store owner from reviewing their own product
    if (product.stores.userId === userId) {
      throw new ForbiddenException('لا يمكنك تقييم منتجاتك الخاصة');
    }

    // Check if user has purchased this product (optional - can be enforced)
    const hasPurchased = await this.prisma.order_items.findFirst({
      where: {
        productId,
        orders: {
          userId,
          status: 'DELIVERED',
        },
      },
    });

    // Uncomment this to require purchase before review
    // if (!hasPurchased) {
    //   throw new BadRequestException('يجب شراء المنتج قبل تقييمه');
    // }

    // Check if user already reviewed this product
    const existingReview = await this.prisma.reviews.findUnique({
      where: {
        userId_productId: { userId, productId },
      },
    });

    if (existingReview) {
      throw new ConflictException('لقد قمت بتقييم هذا المنتج من قبل');
    }

    // Create review
    const review = await this.prisma.reviews.create({
      data: {
        id: uuidv4(),
        userId,
        productId,
        rating,
        comment,
        updatedAt: new Date(),
      },
      include: {
        users: {
          select: {
            id: true,
            profile: {
              select: { name: true, avatar: true, username: true },
            },
          },
        },
        products: {
          select: { id: true, name: true, nameAr: true },
        },
      },
    });

    return {
      message: 'تم إضافة التقييم بنجاح',
      review: this.formatReview(review),
    };
  }

  /**
   * Update user's review
   */
  async updateReview(
    reviewId: string,
    userId: string,
    updateReviewDto: UpdateReviewDto,
  ) {
    const review = await this.prisma.reviews.findUnique({
      where: { id: reviewId },
    });

    if (!review) {
      throw new NotFoundException('التقييم غير موجود');
    }

    if (review.userId !== userId) {
      throw new ForbiddenException('غير مصرح لك بتعديل هذا التقييم');
    }

    const updatedReview = await this.prisma.reviews.update({
      where: { id: reviewId },
      data: {
        ...updateReviewDto,
        updatedAt: new Date(),
      },
      include: {
        users: {
          select: {
            id: true,
            profile: {
              select: { name: true, avatar: true, username: true },
            },
          },
        },
        products: {
          select: { id: true, name: true, nameAr: true },
        },
      },
    });

    return {
      message: 'تم تحديث التقييم بنجاح',
      review: this.formatReview(updatedReview),
    };
  }

  /**
   * Delete user's review
   */
  async deleteReview(reviewId: string, userId: string) {
    const review = await this.prisma.reviews.findUnique({
      where: { id: reviewId },
    });

    if (!review) {
      throw new NotFoundException('التقييم غير موجود');
    }

    if (review.userId !== userId) {
      throw new ForbiddenException('غير مصرح لك بحذف هذا التقييم');
    }

    await this.prisma.reviews.delete({
      where: { id: reviewId },
    });

    return { message: 'تم حذف التقييم بنجاح' };
  }

  /**
   * Get reviews for a product
   */
  async getProductReviews(productId: string, filters?: ReviewFiltersDto) {
    const product = await this.prisma.products.findUnique({
      where: { id: productId },
    });

    if (!product) {
      throw new NotFoundException('المنتج غير موجود');
    }

    const where: any = { productId };

    if (filters?.rating) {
      where.rating = filters.rating;
    }

    // Sorting
    let orderBy: any = { createdAt: 'desc' };
    if (filters?.sortBy) {
      switch (filters.sortBy) {
        case ReviewSortBy.OLDEST:
          orderBy = { createdAt: 'asc' };
          break;
        case ReviewSortBy.HIGHEST:
          orderBy = { rating: 'desc' };
          break;
        case ReviewSortBy.LOWEST:
          orderBy = { rating: 'asc' };
          break;
        default:
          orderBy = { createdAt: 'desc' };
      }
    }

    // Pagination
    const page = filters?.page || 1;
    const limit = filters?.limit || 10;
    const skip = (page - 1) * limit;

    const [reviews, total] = await Promise.all([
      this.prisma.reviews.findMany({
        where,
        include: {
          users: {
            select: {
              id: true,
              profile: {
                select: { name: true, avatar: true, username: true },
              },
            },
          },
        },
        orderBy,
        skip,
        take: limit,
      }),
      this.prisma.reviews.count({ where }),
    ]);

    return {
      reviews: reviews.map((r) => this.formatReview(r)),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get review statistics for a product
   */
  async getProductReviewStats(productId: string) {
    const product = await this.prisma.products.findUnique({
      where: { id: productId },
    });

    if (!product) {
      throw new NotFoundException('المنتج غير موجود');
    }

    const [stats, distribution] = await Promise.all([
      this.prisma.reviews.aggregate({
        where: { productId },
        _avg: { rating: true },
        _count: true,
      }),
      this.prisma.reviews.groupBy({
        by: ['rating'],
        where: { productId },
        _count: true,
      }),
    ]);

    const distributionMap = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    distribution.forEach((d) => {
      distributionMap[d.rating as keyof typeof distributionMap] = d._count;
    });

    return {
      averageRating: Math.round((stats._avg.rating || 0) * 10) / 10,
      totalReviews: stats._count,
      distribution: distributionMap,
    };
  }

  /**
   * Get store reviews (all products)
   */
  async getStoreReviews(storeId: string, filters?: ReviewFiltersDto) {
    const store = await this.prisma.store.findUnique({
      where: { id: storeId },
    });

    if (!store) {
      throw new NotFoundException('المتجر غير موجود');
    }

    const where: any = {
      products: {
        storeId,
      },
    };

    if (filters?.rating) {
      where.rating = filters.rating;
    }

    if (filters?.productId) {
      where.productId = filters.productId;
    }

    // Sorting
    let orderBy: any = { createdAt: 'desc' };
    if (filters?.sortBy) {
      switch (filters.sortBy) {
        case ReviewSortBy.OLDEST:
          orderBy = { createdAt: 'asc' };
          break;
        case ReviewSortBy.HIGHEST:
          orderBy = { rating: 'desc' };
          break;
        case ReviewSortBy.LOWEST:
          orderBy = { rating: 'asc' };
          break;
      }
    }

    // Pagination
    const page = filters?.page || 1;
    const limit = filters?.limit || 10;
    const skip = (page - 1) * limit;

    const [reviews, total] = await Promise.all([
      this.prisma.reviews.findMany({
        where,
        include: {
          users: {
            select: {
              id: true,
              profile: {
                select: { name: true, avatar: true, username: true },
              },
            },
          },
          products: {
            select: {
              id: true,
              name: true,
              nameAr: true,
              product_images: {
                where: { isPrimary: true },
                take: 1,
              },
            },
          },
        },
        orderBy,
        skip,
        take: limit,
      }),
      this.prisma.reviews.count({ where }),
    ]);

    return {
      reviews: reviews.map((r) => this.formatReview(r, true)),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get store review statistics
   */
  async getStoreReviewStats(storeId: string) {
    const store = await this.prisma.store.findUnique({
      where: { id: storeId },
    });

    if (!store) {
      throw new NotFoundException('المتجر غير موجود');
    }

    const [stats, distribution] = await Promise.all([
      this.prisma.reviews.aggregate({
        where: {
          products: { storeId },
        },
        _avg: { rating: true },
        _count: true,
      }),
      this.prisma.reviews.groupBy({
        by: ['rating'],
        where: {
          products: { storeId },
        },
        _count: true,
      }),
    ]);

    const distributionMap = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    distribution.forEach((d) => {
      distributionMap[d.rating as keyof typeof distributionMap] = d._count;
    });

    return {
      averageRating: Math.round((stats._avg.rating || 0) * 10) / 10,
      totalReviews: stats._count,
      distribution: distributionMap,
    };
  }

  /**
   * Get user's reviews
   */
  async getMyReviews(userId: string, filters?: ReviewFiltersDto) {
    const where: any = { userId };

    if (filters?.rating) {
      where.rating = filters.rating;
    }

    // Sorting
    let orderBy: any = { createdAt: 'desc' };
    if (filters?.sortBy) {
      switch (filters.sortBy) {
        case ReviewSortBy.OLDEST:
          orderBy = { createdAt: 'asc' };
          break;
        case ReviewSortBy.HIGHEST:
          orderBy = { rating: 'desc' };
          break;
        case ReviewSortBy.LOWEST:
          orderBy = { rating: 'asc' };
          break;
      }
    }

    // Pagination
    const page = filters?.page || 1;
    const limit = filters?.limit || 10;
    const skip = (page - 1) * limit;

    const [reviews, total] = await Promise.all([
      this.prisma.reviews.findMany({
        where,
        include: {
          products: {
            select: {
              id: true,
              name: true,
              nameAr: true,
              product_images: {
                where: { isPrimary: true },
                take: 1,
              },
              stores: {
                select: { id: true, name: true, slug: true },
              },
            },
          },
        },
        orderBy,
        skip,
        take: limit,
      }),
      this.prisma.reviews.count({ where }),
    ]);

    return {
      reviews: reviews.map((r) => this.formatReview(r, true)),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Check if user can review a product
   */
  async canReview(userId: string, productId: string) {
    // Check if product exists
    const product = await this.prisma.products.findUnique({
      where: { id: productId },
      include: {
        stores: {
          select: { userId: true },
        },
      },
    });

    if (!product) {
      return { canReview: false, reason: 'المنتج غير موجود' };
    }

    // Store owner can't review own products
    if (product.stores.userId === userId) {
      return { canReview: false, reason: 'لا يمكنك تقييم منتجاتك الخاصة' };
    }

    // Check existing review
    const existingReview = await this.prisma.reviews.findUnique({
      where: {
        userId_productId: { userId, productId },
      },
    });

    if (existingReview) {
      return {
        canReview: false,
        reason: 'لقد قمت بتقييم هذا المنتج من قبل',
        existingReviewId: existingReview.id,
      };
    }

    // Check if user has purchased the product
    const hasPurchased = await this.prisma.order_items.findFirst({
      where: {
        productId,
        orders: {
          userId,
          status: 'DELIVERED',
        },
      },
    });

    return {
      canReview: true,
      hasPurchased: !!hasPurchased,
    };
  }

  /**
   * Format review for response
   */
  private formatReview(review: any, includeProduct = false) {
    const formatted: any = {
      id: review.id,
      rating: review.rating,
      comment: review.comment,
      createdAt: review.createdAt,
      updatedAt: review.updatedAt,
      user: review.users
        ? {
            id: review.users.id,
            name: review.users.profile?.name,
            avatar: review.users.profile?.avatar,
            username: review.users.profile?.username,
          }
        : null,
    };

    if (includeProduct && review.products) {
      formatted.product = {
        id: review.products.id,
        name: review.products.name,
        nameAr: review.products.nameAr,
        image: review.products.product_images?.[0]?.imagePath || null,
        store: review.products.stores || null,
      };
    }

    return formatted;
  }
}
