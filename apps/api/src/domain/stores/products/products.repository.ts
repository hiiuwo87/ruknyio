import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma/prisma.service';
import { Prisma } from '@prisma/client';

/**
 * Products Repository - Data Access Layer
 * Handles all database operations for products
 */
@Injectable()
export class ProductsRepository {
  constructor(private readonly prisma: PrismaService) {}

  // ==================== INCLUDES ====================

  private readonly productInclude = {
    product_images: {
      orderBy: { displayOrder: 'asc' as const },
    },
    stores: {
      select: {
        id: true,
        name: true,
        slug: true,
        logo: true,
        userId: true,
      },
    },
    product_categories: {
      select: {
        id: true,
        name: true,
        nameAr: true,
        slug: true,
      },
    },
  } satisfies Prisma.productsInclude;

  private readonly productWithVariantsInclude = {
    ...this.productInclude,
    product_variants: true,
    product_attributes: true,
  };

  // ==================== CREATE ====================

  async create(data: Prisma.productsCreateInput) {
    return this.prisma.products.create({
      data,
      include: this.productInclude,
    });
  }

  async createWithTransaction(
    productData: any,
    images: { url: string; displayOrder: number; isPrimary: boolean }[],
    variants: any[],
    attributes: any[],
  ) {
    return this.prisma.$transaction(async (tx) => {
      const product = await tx.products.create({
        data: productData,
      });

      if (images.length > 0) {
        await tx.product_images.createMany({
          data: images.map((img, index) => ({
            id: `img_${Date.now()}_${index}`,
            productId: product.id,
            imagePath: img.url,
            displayOrder: img.displayOrder,
            isPrimary: img.isPrimary,
          })),
        });
      }

      if (variants.length > 0) {
        await tx.product_variants.createMany({
          data: variants.map((v) => ({
            ...v,
            productId: product.id,
          })),
        });
      }

      if (attributes.length > 0) {
        await tx.product_attributes.createMany({
          data: attributes.map((a) => ({
            ...a,
            productId: product.id,
          })),
        });
      }

      return product;
    });
  }

  // ==================== READ ====================

  async findById(id: string) {
    return this.prisma.products.findUnique({
      where: { id },
      include: this.productWithVariantsInclude,
    });
  }

  async findBySlug(slug: string) {
    return this.prisma.products.findUnique({
      where: { slug },
      include: this.productWithVariantsInclude,
    });
  }

  async findBySlugSimple(slug: string) {
    return this.prisma.products.findUnique({
      where: { slug },
      select: { id: true },
    });
  }

  async findByStoreId(
    storeId: string,
    filters?: {
      status?: string;
      categoryId?: string;
      search?: string;
      isFeatured?: boolean;
    },
  ) {
    const where: Prisma.productsWhereInput = { storeId };

    if (filters?.status) {
      where.status = filters.status as any;
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
        { sku: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    return this.prisma.products.findMany({
      where,
      include: this.productInclude,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findByIds(ids: string[]) {
    return this.prisma.products.findMany({
      where: { id: { in: ids } },
      include: this.productInclude,
    });
  }

  // ==================== UPDATE ====================

  async update(id: string, data: Prisma.productsUpdateInput) {
    return this.prisma.products.update({
      where: { id },
      data,
      include: this.productWithVariantsInclude,
    });
  }

  async updateStock(id: string, quantity: number) {
    return this.prisma.products.update({
      where: { id },
      data: { quantity },
    });
  }

  // ==================== DELETE ====================

  async delete(id: string) {
    return this.prisma.products.delete({
      where: { id },
    });
  }

  // ==================== IMAGES ====================

  async createImages(
    productId: string,
    images: { url: string; displayOrder: number; isPrimary: boolean }[],
  ) {
    return this.prisma.product_images.createMany({
      data: images.map((img, index) => ({
        id: `img_${Date.now()}_${index}`,
        productId,
        imagePath: img.url,
        displayOrder: img.displayOrder,
        isPrimary: img.isPrimary,
      })),
    });
  }

  async deleteImages(productId: string) {
    return this.prisma.product_images.deleteMany({
      where: { productId },
    });
  }

  async findImages(productId: string) {
    return this.prisma.product_images.findMany({
      where: { productId },
      orderBy: { displayOrder: 'asc' },
    });
  }

  // ==================== STATISTICS ====================

  async countByStore(storeId: string) {
    return this.prisma.products.count({
      where: { storeId },
    });
  }

  async getStatsByStore(storeId: string) {
    return this.prisma.products.groupBy({
      by: ['status'],
      where: { storeId },
      _count: true,
    });
  }
}
