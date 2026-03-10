import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma/prisma.service';
import {
  CreateProductAttributeDto,
  UpdateProductAttributeDto,
  BulkCreateAttributesDto,
  CategoryTemplateFields,
  TemplateField,
} from './dto/product-attribute.dto';
import { nanoid } from 'nanoid';

@Injectable()
export class ProductAttributesService {
  private readonly logger = new Logger(ProductAttributesService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * إنشاء خاصية منتج جديدة
   */
  async create(
    productId: string,
    dto: CreateProductAttributeDto,
    userId: string,
  ) {
    const product = await this.validateProductOwnership(productId, userId);

    // التحقق من صحة الخاصية
    await this.validateAttribute(product.stores.categoryId, dto);

    // تنظيف القيم من XSS
    const sanitizedValue = this.sanitizeValue(dto.value);
    const sanitizedValueAr = dto.valueAr
      ? this.sanitizeValue(dto.valueAr)
      : null;

    const attribute = await this.prisma.product_attributes.upsert({
      where: {
        productId_key: { productId, key: dto.key },
      },
      update: {
        value: sanitizedValue,
        valueAr: sanitizedValueAr,
      },
      create: {
        id: `attr_${nanoid(12)}`,
        productId,
        key: dto.key,
        value: sanitizedValue,
        valueAr: sanitizedValueAr,
      },
    });

    this.logger.log(
      `Created/Updated attribute ${dto.key} for product ${productId}`,
    );
    return attribute;
  }

  /**
   * إنشاء عدة خصائص دفعة واحدة
   */
  async bulkCreate(
    productId: string,
    dto: BulkCreateAttributesDto,
    userId: string,
  ) {
    const product = await this.validateProductOwnership(productId, userId);

    const attributes = await this.prisma.$transaction(async (tx) => {
      const created = [];
      for (const attrDto of dto.attributes) {
        await this.validateAttribute(product.stores.categoryId, attrDto);

        const sanitizedValue = this.sanitizeValue(attrDto.value);
        const sanitizedValueAr = attrDto.valueAr
          ? this.sanitizeValue(attrDto.valueAr)
          : null;

        const attr = await tx.product_attributes.upsert({
          where: {
            productId_key: { productId, key: attrDto.key },
          },
          update: {
            value: sanitizedValue,
            valueAr: sanitizedValueAr,
          },
          create: {
            id: `attr_${nanoid(12)}`,
            productId,
            key: attrDto.key,
            value: sanitizedValue,
            valueAr: sanitizedValueAr,
          },
        });
        created.push(attr);
      }
      return created;
    });

    this.logger.log(
      `Created ${attributes.length} attributes for product ${productId}`,
    );
    return attributes;
  }

  /**
   * الحصول على جميع خصائص منتج
   */
  async findByProduct(productId: string) {
    return this.prisma.product_attributes.findMany({
      where: { productId },
      orderBy: { key: 'asc' },
    });
  }

  /**
   * الحصول على خصائص منتج مع قالب الفئة
   */
  async findByProductWithTemplate(productId: string) {
    const product = await this.prisma.products.findUnique({
      where: { id: productId },
      include: {
        stores: {
          include: {
            store_categories: true,
          },
        },
        productAttributes: true,
      },
    });

    if (!product) {
      throw new NotFoundException('المنتج غير موجود');
    }

    const template = product.stores.store_categories
      ?.templateFields as unknown as CategoryTemplateFields | null;
    const attributes = product.productAttributes;

    // دمج القالب مع القيم الفعلية
    const result: Array<{
      key: string;
      label: string;
      labelAr: string;
      type: string;
      options?: string[];
      required: boolean;
      value?: string;
      valueAr?: string;
    }> = [];

    if (template?.productAttributes) {
      for (const field of template.productAttributes) {
        const existingAttr = attributes.find((a) => a.key === field.key);
        result.push({
          ...field,
          value: existingAttr?.value,
          valueAr: existingAttr?.valueAr || undefined,
        });
      }
    }

    return {
      template,
      attributes: result,
      rawAttributes: attributes,
    };
  }

  /**
   * الحصول على خاصية بالـ ID
   */
  async findOne(id: string) {
    const attribute = await this.prisma.product_attributes.findUnique({
      where: { id },
      include: { product: true },
    });

    if (!attribute) {
      throw new NotFoundException('الخاصية غير موجودة');
    }

    return attribute;
  }

  /**
   * تحديث خاصية
   */
  async update(id: string, dto: UpdateProductAttributeDto, userId: string) {
    const attribute = await this.findOne(id);
    await this.validateProductOwnership(attribute.productId, userId);

    const sanitizedValue = dto.value
      ? this.sanitizeValue(dto.value)
      : undefined;
    const sanitizedValueAr = dto.valueAr
      ? this.sanitizeValue(dto.valueAr)
      : undefined;

    return this.prisma.product_attributes.update({
      where: { id },
      data: {
        key: dto.key,
        value: sanitizedValue,
        valueAr: sanitizedValueAr,
      },
    });
  }

  /**
   * حذف خاصية
   */
  async remove(id: string, userId: string) {
    const attribute = await this.findOne(id);
    await this.validateProductOwnership(attribute.productId, userId);

    await this.prisma.product_attributes.delete({ where: { id } });
    return { deleted: true };
  }

  /**
   * حذف جميع خصائص منتج
   */
  async removeAllByProduct(productId: string, userId: string) {
    await this.validateProductOwnership(productId, userId);

    const result = await this.prisma.product_attributes.deleteMany({
      where: { productId },
    });

    return { deleted: result.count };
  }

  /**
   * الحصول على قالب فئة متجر
   */
  async getCategoryTemplate(
    categoryId: string,
  ): Promise<CategoryTemplateFields | null> {
    const category = await this.prisma.store_categories.findUnique({
      where: { id: categoryId },
    });

    if (!category?.templateFields) return null;
    return category.templateFields as unknown as CategoryTemplateFields;
  }

  /**
   * الحصول على قالب فئة متجر بناءً على المتجر
   */
  async getTemplateByStoreId(
    storeId: string,
  ): Promise<CategoryTemplateFields | null> {
    const store = await this.prisma.store.findUnique({
      where: { id: storeId },
      include: { store_categories: true },
    });

    if (!store?.store_categories?.templateFields) return null;
    return store.store_categories
      .templateFields as unknown as CategoryTemplateFields;
  }

  /**
   * التحقق من اكتمال جميع الخصائص المطلوبة
   */
  async validateRequiredAttributes(
    productId: string,
    categoryId: string,
  ): Promise<{ valid: boolean; missing: string[] }> {
    const template = await this.getCategoryTemplate(categoryId);
    if (!template) return { valid: true, missing: [] };

    const attributes = await this.prisma.product_attributes.findMany({
      where: { productId },
    });

    const existingKeys = new Set(attributes.map((a) => a.key));
    const requiredFields = template.productAttributes.filter((f) => f.required);
    const missing = requiredFields
      .filter((f) => !existingKeys.has(f.key))
      .map((f) => f.labelAr || f.label);

    return {
      valid: missing.length === 0,
      missing,
    };
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
   * التحقق من صحة الخاصية بناءً على القالب
   */
  private async validateAttribute(
    categoryId: string | null,
    dto: CreateProductAttributeDto,
  ) {
    if (!categoryId) return; // لا يوجد قالب للتحقق

    const template = await this.getCategoryTemplate(categoryId);
    if (!template) return;

    const fieldDef = template.productAttributes.find((f) => f.key === dto.key);

    // إذا المفتاح غير موجود في القالب، نسمح به كحقل مخصص
    if (!fieldDef) {
      this.logger.warn(
        `Custom attribute "${dto.key}" not in template for category ${categoryId}`,
      );
      return;
    }

    // التحقق من نوع القيمة
    this.validateFieldValue(fieldDef, dto.value);
  }

  /**
   * التحقق من قيمة الحقل
   */
  private validateFieldValue(field: TemplateField, value: string) {
    switch (field.type) {
      case 'select':
        if (field.options && !field.options.includes(value)) {
          throw new BadRequestException(
            `القيمة "${value}" غير مسموح بها للحقل "${field.labelAr}". القيم المسموحة: ${field.options.join(', ')}`,
          );
        }
        break;

      case 'multiselect':
        // القيمة تكون قائمة مفصولة بفواصل
        const values = value.split(',').map((v) => v.trim());
        if (field.options) {
          for (const v of values) {
            if (!field.options.includes(v)) {
              throw new BadRequestException(
                `القيمة "${v}" غير مسموح بها للحقل "${field.labelAr}"`,
              );
            }
          }
        }
        break;

      case 'number':
        if (isNaN(Number(value))) {
          throw new BadRequestException(
            `الحقل "${field.labelAr}" يجب أن يكون رقماً`,
          );
        }
        break;

      case 'date':
        if (isNaN(Date.parse(value))) {
          throw new BadRequestException(
            `الحقل "${field.labelAr}" يجب أن يكون تاريخاً صحيحاً`,
          );
        }
        break;

      case 'boolean':
        if (
          !['true', 'false', '1', '0', 'نعم', 'لا'].includes(
            value.toLowerCase(),
          )
        ) {
          throw new BadRequestException(
            `الحقل "${field.labelAr}" يجب أن يكون نعم/لا`,
          );
        }
        break;
    }
  }

  /**
   * تنظيف القيمة من XSS
   */
  private sanitizeValue(value: string): string {
    // إزالة جميع العلامات HTML
    return value
      .replace(/<[^>]*>/g, '')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#039;/g, "'")
      .trim();
  }
}
