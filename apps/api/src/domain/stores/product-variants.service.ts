import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma/prisma.service';
import {
  CreateProductVariantDto,
  UpdateProductVariantDto,
  BulkCreateVariantsDto,
  GenerateVariantsDto,
  BulkUpdateStockDto,
} from './dto/product-variant.dto';
import { nanoid } from 'nanoid';

@Injectable()
export class ProductVariantsService {
  private readonly logger = new Logger(ProductVariantsService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * إنشاء متغير منتج جديد
   */
  async create(
    productId: string,
    dto: CreateProductVariantDto,
    userId: string,
  ) {
    // التحقق من المنتج وملكيته
    const product = await this.validateProductOwnership(productId, userId);

    // التحقق من عدم تكرار الـ SKU
    if (dto.sku) {
      const existingSku = await this.prisma.product_variants.findFirst({
        where: { productId, sku: dto.sku },
      });
      if (existingSku) {
        throw new BadRequestException(
          'رمز المخزون (SKU) مستخدم مسبقاً لهذا المنتج',
        );
      }
    }

    // التحقق من صحة الخصائص بناءً على قالب الفئة
    await this.validateVariantAttributes(
      product.stores.categoryId,
      dto.attributes,
    );

    const variant = await this.prisma.product_variants.create({
      data: {
        id: `var_${nanoid(12)}`,
        productId,
        sku: dto.sku || `${product.sku || product.id}-${nanoid(6)}`,
        price: dto.price,
        compareAtPrice: dto.compareAtPrice,
        stock: dto.stock,
        attributes: dto.attributes,
        imageUrl: dto.imageUrl,
        isActive: dto.isActive ?? true,
      },
    });

    // تحديث المنتج ليكون له متغيرات
    if (!product.hasVariants) {
      await this.prisma.products.update({
        where: { id: productId },
        data: { hasVariants: true },
      });
    }

    this.logger.log(`Created variant ${variant.id} for product ${productId}`);
    return variant;
  }

  /**
   * إنشاء عدة متغيرات دفعة واحدة
   */
  async bulkCreate(
    productId: string,
    dto: BulkCreateVariantsDto,
    userId: string,
  ) {
    const product = await this.validateProductOwnership(productId, userId);

    const variants = await this.prisma.$transaction(async (tx) => {
      const created = [];
      for (const variantDto of dto.variants) {
        await this.validateVariantAttributes(
          product.stores.categoryId,
          variantDto.attributes,
        );

        const variant = await tx.product_variants.create({
          data: {
            id: `var_${nanoid(12)}`,
            productId,
            sku: variantDto.sku || `${product.sku || product.id}-${nanoid(6)}`,
            price: variantDto.price,
            compareAtPrice: variantDto.compareAtPrice,
            stock: variantDto.stock,
            attributes: variantDto.attributes,
            imageUrl: variantDto.imageUrl,
            isActive: variantDto.isActive ?? true,
          },
        });
        created.push(variant);
      }

      // تحديث المنتج
      await tx.products.update({
        where: { id: productId },
        data: { hasVariants: true },
      });

      return created;
    });

    this.logger.log(
      `Created ${variants.length} variants for product ${productId}`,
    );
    return variants;
  }

  /**
   * توليد كل التركيبات الممكنة للمتغيرات
   * مثال: 4 مقاسات × 3 ألوان = 12 متغير
   */
  async generateVariants(
    productId: string,
    dto: GenerateVariantsDto,
    userId: string,
  ) {
    const product = await this.validateProductOwnership(productId, userId);

    // توليد كل التركيبات
    const combinations = this.generateCombinations(dto.options);

    if (combinations.length > 100) {
      throw new BadRequestException(
        'عدد التركيبات كبير جداً (أكثر من 100). قلل من الخيارات.',
      );
    }

    const variants = await this.prisma.$transaction(async (tx) => {
      const created = [];
      for (const combo of combinations) {
        // إنشاء SKU من التركيبة
        const skuParts = Object.values(combo).map((v) =>
          String(v).substring(0, 3).toUpperCase(),
        );
        const sku = `${product.sku || product.id.substring(0, 6)}-${skuParts.join('-')}`;

        const variant = await tx.product_variants.create({
          data: {
            id: `var_${nanoid(12)}`,
            productId,
            sku,
            price: dto.basePrice,
            stock: dto.defaultStock,
            attributes: combo,
            isActive: true,
          },
        });
        created.push(variant);
      }

      await tx.products.update({
        where: { id: productId },
        data: { hasVariants: true },
      });

      return created;
    });

    this.logger.log(
      `Generated ${variants.length} variants for product ${productId}`,
    );
    return { generated: variants.length, variants };
  }

  /**
   * الحصول على جميع متغيرات منتج
   */
  async findByProduct(productId: string) {
    return this.prisma.product_variants.findMany({
      where: { productId },
      orderBy: { createdAt: 'asc' },
    });
  }

  /**
   * الحصول على متغير بالـ ID
   */
  async findOne(id: string) {
    const variant = await this.prisma.product_variants.findUnique({
      where: { id },
      include: { product: true },
    });

    if (!variant) {
      throw new NotFoundException('المتغير غير موجود');
    }

    return variant;
  }

  /**
   * تحديث متغير
   */
  async update(id: string, dto: UpdateProductVariantDto, userId: string) {
    const variant = await this.findOne(id);
    await this.validateProductOwnership(variant.productId, userId);

    return this.prisma.product_variants.update({
      where: { id },
      data: {
        sku: dto.sku,
        price: dto.price,
        compareAtPrice: dto.compareAtPrice,
        stock: dto.stock,
        attributes: dto.attributes,
        imageUrl: dto.imageUrl,
        isActive: dto.isActive,
      },
    });
  }

  /**
   * تحديث مخزون متغير
   */
  async updateStock(id: string, stock: number, userId: string) {
    const variant = await this.findOne(id);
    await this.validateProductOwnership(variant.productId, userId);

    return this.prisma.product_variants.update({
      where: { id },
      data: { stock },
    });
  }

  /**
   * تحديث مخزون عدة متغيرات
   */
  async bulkUpdateStock(dto: BulkUpdateStockDto, userId: string) {
    const results = await this.prisma.$transaction(async (tx) => {
      const updated = [];
      for (const update of dto.updates) {
        const variant = await tx.product_variants.findUnique({
          where: { id: update.variantId },
          include: { product: { include: { stores: true } } },
        });

        if (!variant) continue;
        if (variant.product.stores.userId !== userId) {
          throw new ForbiddenException('غير مصرح لك بتعديل هذا المتغير');
        }

        const updated_variant = await tx.product_variants.update({
          where: { id: update.variantId },
          data: { stock: update.stock },
        });
        updated.push(updated_variant);
      }
      return updated;
    });

    return { updated: results.length, variants: results };
  }

  /**
   * حذف متغير
   */
  async remove(id: string, userId: string) {
    const variant = await this.findOne(id);
    await this.validateProductOwnership(variant.productId, userId);

    await this.prisma.product_variants.delete({ where: { id } });

    // التحقق إذا لم يعد هناك متغيرات
    const remainingCount = await this.prisma.product_variants.count({
      where: { productId: variant.productId },
    });

    if (remainingCount === 0) {
      await this.prisma.products.update({
        where: { id: variant.productId },
        data: { hasVariants: false },
      });
    }

    return { deleted: true };
  }

  /**
   * حذف جميع متغيرات منتج
   */
  async removeAllByProduct(productId: string, userId: string) {
    await this.validateProductOwnership(productId, userId);

    const result = await this.prisma.product_variants.deleteMany({
      where: { productId },
    });

    await this.prisma.products.update({
      where: { id: productId },
      data: { hasVariants: false },
    });

    return { deleted: result.count };
  }

  // ========== Helper Methods ==========

  /**
   * التحقق من ملكية المنتج
   */
  private async validateProductOwnership(productId: string, userId: string) {
    const product = await this.prisma.products.findUnique({
      where: { id: productId },
      include: { stores: true },
    });

    if (!product) {
      throw new NotFoundException('المنتج غير موجود');
    }

    if (product.stores.userId !== userId) {
      throw new ForbiddenException('غير مصرح لك بتعديل هذا المنتج');
    }

    return product;
  }

  /**
   * التحقق من صحة خصائص المتغير
   */
  private async validateVariantAttributes(
    categoryId: string | null,
    attributes: Record<string, string>,
  ) {
    if (!categoryId) return; // لا يوجد قالب للتحقق

    const category = await this.prisma.store_categories.findUnique({
      where: { id: categoryId },
    });

    if (!category?.templateFields) return;

    const template = category.templateFields as {
      hasVariants?: boolean;
      variantAttributes?: Array<{ key: string; options: string[] }>;
    };

    if (!template.hasVariants || !template.variantAttributes) return;

    // التحقق من أن المفاتيح صحيحة
    const validKeys = template.variantAttributes.map((attr) => attr.key);
    for (const key of Object.keys(attributes)) {
      if (!validKeys.includes(key)) {
        throw new BadRequestException(
          `الخاصية "${key}" غير مسموح بها لهذه الفئة`,
        );
      }
    }

    // التحقق من أن القيم من الخيارات المسموحة
    for (const attr of template.variantAttributes) {
      const value = attributes[attr.key];
      if (value && !attr.options.includes(value)) {
        throw new BadRequestException(
          `القيمة "${value}" غير مسموح بها للخاصية "${attr.key}". القيم المسموحة: ${attr.options.join(', ')}`,
        );
      }
    }
  }

  /**
   * توليد كل التركيبات من مجموعة خيارات
   */
  private generateCombinations(
    options: Record<string, string[]>,
  ): Record<string, string>[] {
    const keys = Object.keys(options);
    if (keys.length === 0) return [];

    const result: Record<string, string>[] = [];

    const generate = (index: number, current: Record<string, string>) => {
      if (index === keys.length) {
        result.push({ ...current });
        return;
      }

      const key = keys[index];
      for (const value of options[key]) {
        current[key] = value;
        generate(index + 1, current);
      }
    };

    generate(0, {});
    return result;
  }
}
