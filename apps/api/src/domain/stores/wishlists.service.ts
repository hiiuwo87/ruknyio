import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma/prisma.service';
import { WishlistFiltersDto, WishlistSortBy } from './dto/wishlist.dto';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class WishlistsService {
  constructor(private prisma: PrismaService) {}

  /**
   * Add product to wishlist
   */
  async addToWishlist(userId: string, productId: string) {
    // Check if product exists
    const product = await this.prisma.products.findUnique({
      where: { id: productId },
      select: { id: true, name: true, nameAr: true, status: true },
    });

    if (!product) {
      throw new NotFoundException('المنتج غير موجود');
    }

    if (product.status !== 'ACTIVE') {
      throw new BadRequestException('المنتج غير متاح حالياً');
    }

    // Check if already in wishlist
    const existing = await this.prisma.wishlists.findUnique({
      where: {
        userId_productId: { userId, productId },
      },
    });

    if (existing) {
      throw new ConflictException('المنتج موجود في قائمة الرغبات مسبقاً');
    }

    // Add to wishlist
    await this.prisma.wishlists.create({
      data: {
        id: uuidv4(),
        userId,
        productId,
      },
    });

    return {
      message: 'تمت الإضافة إلى قائمة الرغبات',
      product: {
        id: product.id,
        name: product.name,
        nameAr: product.nameAr,
      },
    };
  }

  /**
   * Remove product from wishlist
   */
  async removeFromWishlist(userId: string, productId: string) {
    const wishlistItem = await this.prisma.wishlists.findUnique({
      where: {
        userId_productId: { userId, productId },
      },
    });

    if (!wishlistItem) {
      throw new NotFoundException('المنتج غير موجود في قائمة الرغبات');
    }

    await this.prisma.wishlists.delete({
      where: { id: wishlistItem.id },
    });

    return { message: 'تمت الإزالة من قائمة الرغبات' };
  }

  /**
   * Get user's wishlist
   */
  async getWishlist(userId: string, filters?: WishlistFiltersDto) {
    // Pagination
    const page = filters?.page || 1;
    const limit = filters?.limit || 12;
    const skip = (page - 1) * limit;

    // Build order by
    let orderBy: any = { createdAt: 'desc' };
    if (filters?.sortBy) {
      switch (filters.sortBy) {
        case WishlistSortBy.OLDEST:
          orderBy = { createdAt: 'asc' };
          break;
        case WishlistSortBy.PRICE_LOW:
          orderBy = { products: { price: 'asc' } };
          break;
        case WishlistSortBy.PRICE_HIGH:
          orderBy = { products: { price: 'desc' } };
          break;
        default:
          orderBy = { createdAt: 'desc' };
      }
    }

    const [items, total] = await Promise.all([
      this.prisma.wishlists.findMany({
        where: { userId },
        include: {
          products: {
            include: {
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
      this.prisma.wishlists.count({ where: { userId } }),
    ]);

    return {
      items: items.map((item) => this.formatWishlistItem(item)),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Check if product is in wishlist
   */
  async isInWishlist(userId: string, productId: string) {
    const exists = await this.prisma.wishlists.findUnique({
      where: {
        userId_productId: { userId, productId },
      },
    });

    return { isInWishlist: !!exists };
  }

  /**
   * Check multiple products in wishlist
   */
  async checkMultiple(userId: string, productIds: string[]) {
    const items = await this.prisma.wishlists.findMany({
      where: {
        userId,
        productId: { in: productIds },
      },
      select: { productId: true },
    });

    const wishlistedIds = items.map((item) => item.productId);

    return {
      wishlistedIds,
      results: productIds.reduce(
        (acc, id) => {
          acc[id] = wishlistedIds.includes(id);
          return acc;
        },
        {} as Record<string, boolean>,
      ),
    };
  }

  /**
   * Get wishlist count
   */
  async getWishlistCount(userId: string) {
    const count = await this.prisma.wishlists.count({
      where: { userId },
    });

    return { count };
  }

  /**
   * Move item from wishlist to cart
   */
  async moveToCart(userId: string, productId: string) {
    // Check if in wishlist
    const wishlistItem = await this.prisma.wishlists.findUnique({
      where: {
        userId_productId: { userId, productId },
      },
    });

    if (!wishlistItem) {
      throw new NotFoundException('المنتج غير موجود في قائمة الرغبات');
    }

    // Check product availability
    const product = await this.prisma.products.findUnique({
      where: { id: productId },
      select: { id: true, status: true, quantity: true },
    });

    if (!product || product.status !== 'ACTIVE') {
      throw new BadRequestException('المنتج غير متاح حالياً');
    }

    if (product.quantity < 1) {
      throw new BadRequestException('المنتج غير متوفر في المخزون');
    }

    // Check if already in cart
    const existingCartItem = await this.prisma.cart_items.findFirst({
      where: {
        productId,
        carts: { userId },
      },
    });

    if (existingCartItem) {
      // Remove from wishlist only
      await this.prisma.wishlists.delete({
        where: { id: wishlistItem.id },
      });

      return {
        message: 'المنتج موجود في السلة مسبقاً، تمت إزالته من قائمة الرغبات',
        alreadyInCart: true,
      };
    }

    // Get or create cart
    let cart = await this.prisma.carts.findUnique({
      where: { userId },
    });

    if (!cart) {
      cart = await this.prisma.carts.create({
        data: {
          id: uuidv4(),
          userId,
          updatedAt: new Date(),
        },
      });
    }

    // Add to cart
    await this.prisma.cart_items.create({
      data: {
        id: uuidv4(),
        cartId: cart.id,
        productId,
        quantity: 1,
        updatedAt: new Date(),
      },
    });

    // Remove from wishlist
    await this.prisma.wishlists.delete({
      where: { id: wishlistItem.id },
    });

    // Update cart timestamp
    await this.prisma.carts.update({
      where: { id: cart.id },
      data: { updatedAt: new Date() },
    });

    return {
      message: 'تم نقل المنتج إلى السلة',
      alreadyInCart: false,
    };
  }

  /**
   * Clear entire wishlist
   */
  async clearWishlist(userId: string) {
    await this.prisma.wishlists.deleteMany({
      where: { userId },
    });

    return { message: 'تم مسح قائمة الرغبات' };
  }

  /**
   * Format wishlist item for response
   */
  private formatWishlistItem(item: any) {
    const product = item.products;
    const price = Number(product.price);
    const salePrice = product.salePrice ? Number(product.salePrice) : null;

    return {
      id: item.id,
      addedAt: item.createdAt,
      product: {
        id: product.id,
        name: product.name,
        nameAr: product.nameAr,
        slug: product.slug,
        price,
        salePrice,
        discount: salePrice
          ? Math.round(((price - salePrice) / price) * 100)
          : 0,
        image: product.product_images?.[0]?.imagePath || null,
        status: product.status,
        quantity: product.quantity,
        isAvailable: product.status === 'ACTIVE' && product.quantity > 0,
        store: product.stores,
      },
    };
  }
}
