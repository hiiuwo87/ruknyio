import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';

/**
 * Reviews Repository - Data Access Layer
 */
@Injectable()
export class ReviewsRepository {
  constructor(private readonly prisma: PrismaService) {}

  private readonly reviewInclude = {
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
  } satisfies Prisma.reviewsInclude;

  // ==================== CREATE ====================

  async create(data: {
    userId: string;
    productId: string;
    rating: number;
    comment?: string;
  }) {
    return this.prisma.reviews.create({
      data: {
        id: uuidv4(),
        ...data,
        updatedAt: new Date(),
      },
      include: this.reviewInclude,
    });
  }

  // ==================== READ ====================

  async findById(id: string) {
    return this.prisma.reviews.findUnique({
      where: { id },
      include: this.reviewInclude,
    });
  }

  async findByUserAndProduct(userId: string, productId: string) {
    return this.prisma.reviews.findUnique({
      where: {
        userId_productId: { userId, productId },
      },
    });
  }

  async findByProductId(
    productId: string,
    filters?: { page?: number; limit?: number },
  ) {
    const page = filters?.page || 1;
    const limit = filters?.limit || 10;
    const skip = (page - 1) * limit;

    const [reviews, total] = await Promise.all([
      this.prisma.reviews.findMany({
        where: { productId },
        include: this.reviewInclude,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.reviews.count({ where: { productId } }),
    ]);

    return { reviews, total, page, limit };
  }

  async findByUserId(userId: string) {
    return this.prisma.reviews.findMany({
      where: { userId },
      include: this.reviewInclude,
      orderBy: { createdAt: 'desc' },
    });
  }

  // ==================== UPDATE ====================

  async update(id: string, data: { rating?: number; comment?: string }) {
    return this.prisma.reviews.update({
      where: { id },
      data: { ...data, updatedAt: new Date() },
      include: this.reviewInclude,
    });
  }

  // ==================== DELETE ====================

  async delete(id: string) {
    return this.prisma.reviews.delete({
      where: { id },
    });
  }

  // ==================== STATISTICS ====================

  async getAverageRating(productId: string) {
    const result = await this.prisma.reviews.aggregate({
      where: { productId },
      _avg: { rating: true },
      _count: true,
    });
    return {
      average: result._avg.rating || 0,
      count: result._count,
    };
  }

  async getRatingDistribution(productId: string) {
    return this.prisma.reviews.groupBy({
      by: ['rating'],
      where: { productId },
      _count: true,
    });
  }
}
