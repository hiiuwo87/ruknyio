import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../core/database/prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { nanoid } from 'nanoid';

/**
 * Variants Repository - Data Access Layer
 */
@Injectable()
export class VariantsRepository {
  constructor(private readonly prisma: PrismaService) {}

  // ==================== CREATE ====================

  async create(productId: string, data: any) {
    return this.prisma.product_variants.create({
      data: {
        id: `var_${nanoid(12)}`,
        productId,
        ...data,
      },
    });
  }

  async createMany(productId: string, variants: any[]) {
    return this.prisma.product_variants.createMany({
      data: variants.map((v) => ({
        id: `var_${nanoid(12)}`,
        productId,
        ...v,
      })),
    });
  }

  // ==================== READ ====================

  async findById(id: string) {
    return this.prisma.product_variants.findUnique({
      where: { id },
    });
  }

  async findByProductId(productId: string) {
    return this.prisma.product_variants.findMany({
      where: { productId },
      orderBy: { createdAt: 'asc' },
    });
  }

  async findBySku(sku: string) {
    return this.prisma.product_variants.findFirst({
      where: { sku },
    });
  }

  // ==================== UPDATE ====================

  async update(id: string, data: any) {
    return this.prisma.product_variants.update({
      where: { id },
      data: { ...data, updatedAt: new Date() },
    });
  }

  async updateStock(id: string, stock: number) {
    return this.prisma.product_variants.update({
      where: { id },
      data: { stock, updatedAt: new Date() },
    });
  }

  // ==================== DELETE ====================

  async delete(id: string) {
    return this.prisma.product_variants.delete({
      where: { id },
    });
  }

  async deleteByProductId(productId: string) {
    return this.prisma.product_variants.deleteMany({
      where: { productId },
    });
  }
}
