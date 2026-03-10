import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';

/**
 * Wishlists Repository - Data Access Layer
 */
@Injectable()
export class WishlistsRepository {
  constructor(private readonly prisma: PrismaService) {}

  private readonly wishlistInclude = {
    products: {
      include: {
        product_images: {
          where: { isPrimary: true },
          take: 1,
        },
        stores: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
      },
    },
  } satisfies Prisma.wishlistsInclude;

  // ==================== CREATE ====================

  async create(userId: string, productId: string) {
    return this.prisma.wishlists.create({
      data: {
        id: uuidv4(),
        userId,
        productId,
      },
      include: this.wishlistInclude,
    });
  }

  // ==================== READ ====================

  async findByUserAndProduct(userId: string, productId: string) {
    return this.prisma.wishlists.findUnique({
      where: {
        userId_productId: { userId, productId },
      },
    });
  }

  async findByUserId(
    userId: string,
    filters?: { page?: number; limit?: number },
  ) {
    const page = filters?.page || 1;
    const limit = filters?.limit || 12;
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      this.prisma.wishlists.findMany({
        where: { userId },
        include: this.wishlistInclude,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.wishlists.count({ where: { userId } }),
    ]);

    return { items, total, page, limit };
  }

  async getProductIds(userId: string) {
    const items = await this.prisma.wishlists.findMany({
      where: { userId },
      select: { productId: true },
    });
    return items.map((item) => item.productId);
  }

  // ==================== DELETE ====================

  async delete(id: string) {
    return this.prisma.wishlists.delete({
      where: { id },
    });
  }

  async deleteByUserAndProduct(userId: string, productId: string) {
    return this.prisma.wishlists.delete({
      where: {
        userId_productId: { userId, productId },
      },
    });
  }

  // ==================== COUNT ====================

  async count(userId: string) {
    return this.prisma.wishlists.count({
      where: { userId },
    });
  }

  async isInWishlist(userId: string, productId: string): Promise<boolean> {
    const item = await this.findByUserAndProduct(userId, productId);
    return !!item;
  }
}
