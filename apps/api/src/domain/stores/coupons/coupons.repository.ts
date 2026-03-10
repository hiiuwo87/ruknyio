import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';

/**
 * Coupons Repository - Data Access Layer
 */
@Injectable()
export class CouponsRepository {
  constructor(private readonly prisma: PrismaService) {}

  private readonly couponInclude = {
    stores: {
      select: {
        id: true,
        name: true,
        slug: true,
      },
    },
  } satisfies Prisma.couponsInclude;

  // ==================== CREATE ====================

  async create(data: Prisma.couponsCreateInput) {
    return this.prisma.coupons.create({
      data: {
        id: uuidv4(),
        ...data,
        updatedAt: new Date(),
      },
      include: this.couponInclude,
    });
  }

  // ==================== READ ====================

  async findById(id: string) {
    return this.prisma.coupons.findUnique({
      where: { id },
      include: this.couponInclude,
    });
  }

  async findByCode(code: string) {
    return this.prisma.coupons.findUnique({
      where: { code },
      include: this.couponInclude,
    });
  }

  async findActiveByCode(code: string) {
    return this.prisma.coupons.findFirst({
      where: {
        code: code.toUpperCase(),
        isActive: true,
        OR: [{ endDate: null }, { endDate: { gte: new Date() } }],
      },
      include: this.couponInclude,
    });
  }

  async findByStoreId(
    storeId: string,
    filters?: { isActive?: boolean; page?: number; limit?: number },
  ) {
    const page = filters?.page || 1;
    const limit = filters?.limit || 10;
    const skip = (page - 1) * limit;

    const where: Prisma.couponsWhereInput = { storeId };
    if (filters?.isActive !== undefined) {
      where.isActive = filters.isActive;
    }

    const [coupons, total] = await Promise.all([
      this.prisma.coupons.findMany({
        where,
        include: this.couponInclude,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.coupons.count({ where }),
    ]);

    return { coupons, total, page, limit };
  }

  // ==================== UPDATE ====================

  async update(id: string, data: Prisma.couponsUpdateInput) {
    return this.prisma.coupons.update({
      where: { id },
      data: { ...data, updatedAt: new Date() },
      include: this.couponInclude,
    });
  }

  async incrementUsage(id: string) {
    return this.prisma.coupons.update({
      where: { id },
      data: {
        usageCount: { increment: 1 },
        updatedAt: new Date(),
      },
    });
  }

  // ==================== DELETE ====================

  async delete(id: string) {
    return this.prisma.coupons.delete({
      where: { id },
    });
  }

  // ==================== VALIDATION ====================

  async existsByCode(code: string): Promise<boolean> {
    const coupon = await this.prisma.coupons.findUnique({
      where: { code },
      select: { id: true },
    });
    return !!coupon;
  }
}
