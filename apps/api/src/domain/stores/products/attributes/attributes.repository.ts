import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../core/database/prisma/prisma.service';
import { nanoid } from 'nanoid';

/**
 * Attributes Repository - Data Access Layer
 */
@Injectable()
export class AttributesRepository {
  constructor(private readonly prisma: PrismaService) {}

  // ==================== CREATE ====================

  async create(
    productId: string,
    data: { key: string; value: string; valueAr?: string },
  ) {
    return this.prisma.product_attributes.create({
      data: {
        id: `attr_${nanoid(12)}`,
        productId,
        ...data,
      },
    });
  }

  async createMany(
    productId: string,
    attributes: { key: string; value: string; valueAr?: string }[],
  ) {
    return this.prisma.product_attributes.createMany({
      data: attributes.map((a) => ({
        id: `attr_${nanoid(12)}`,
        productId,
        ...a,
      })),
    });
  }

  // ==================== READ ====================

  async findById(id: string) {
    return this.prisma.product_attributes.findUnique({
      where: { id },
    });
  }

  async findByProductId(productId: string) {
    return this.prisma.product_attributes.findMany({
      where: { productId },
      orderBy: { key: 'asc' },
    });
  }

  async findByProductAndKey(productId: string, key: string) {
    return this.prisma.product_attributes.findFirst({
      where: { productId, key },
    });
  }

  // ==================== UPDATE ====================

  async update(id: string, data: { value?: string; valueAr?: string }) {
    return this.prisma.product_attributes.update({
      where: { id },
      data,
    });
  }

  async upsert(
    productId: string,
    key: string,
    value: string,
    valueAr?: string,
  ) {
    const existing = await this.findByProductAndKey(productId, key);

    if (existing) {
      return this.update(existing.id, { value, valueAr });
    }

    return this.create(productId, { key, value, valueAr });
  }

  // ==================== DELETE ====================

  async delete(id: string) {
    return this.prisma.product_attributes.delete({
      where: { id },
    });
  }

  async deleteByProductId(productId: string) {
    return this.prisma.product_attributes.deleteMany({
      where: { productId },
    });
  }

  async deleteByProductAndKey(productId: string, key: string) {
    return this.prisma.product_attributes.deleteMany({
      where: { productId, key },
    });
  }
}
