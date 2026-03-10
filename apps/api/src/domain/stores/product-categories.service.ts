import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma/prisma.service';
import {
  CreateProductCategoryDto,
  UpdateProductCategoryDto,
} from './dto/product-category.dto';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class ProductCategoriesService {
  private readonly logger = new Logger(ProductCategoriesService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * الحصول على متجر المستخدم
   */
  private async getUserStore(userId: string) {
    const store = await this.prisma.store.findFirst({
      where: { userId },
      select: { id: true, userId: true },
    });

    if (!store) {
      throw new NotFoundException(
        'لم يتم العثور على متجر. يرجى إنشاء متجر أولاً',
      );
    }

    return store;
  }

  /**
   * التحقق من ملكية الفئة
   */
  private async verifyCategoryOwnership(categoryId: string, userId: string) {
    const category = await this.prisma.product_categories.findUnique({
      where: { id: categoryId },
      include: {
        stores: {
          select: { userId: true },
        },
      },
    });

    if (!category) {
      throw new NotFoundException('لم يتم العثور على الفئة');
    }

    if (category.stores.userId !== userId) {
      throw new ForbiddenException('ليس لديك صلاحية لتعديل هذه الفئة');
    }

    return category;
  }

  /**
   * توليد slug فريد
   */
  private async generateUniqueSlug(
    storeId: string,
    name: string,
  ): Promise<string> {
    // إنشاء slug أساسي من الاسم
    let baseSlug = name
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .slice(0, 40);

    // إذا كان فارغاً (مثلاً اسم عربي فقط)، استخدم معرف عشوائي
    if (!baseSlug) {
      baseSlug = `category-${uuidv4().slice(0, 8)}`;
    }

    let slug = baseSlug;
    let counter = 1;

    // التحقق من عدم وجود slug مكرر في نفس المتجر
    while (true) {
      const existing = await this.prisma.product_categories.findUnique({
        where: {
          storeId_slug: {
            storeId,
            slug,
          },
        },
      });

      if (!existing) break;

      slug = `${baseSlug}-${counter}`;
      counter++;
    }

    return slug;
  }

  /**
   * إنشاء فئة منتج جديدة
   */
  async create(userId: string, dto: CreateProductCategoryDto) {
    const store = await this.getUserStore(userId);

    // التحقق من وجود اسم على الأقل
    if (!dto.name && !dto.nameAr) {
      throw new BadRequestException(
        'يرجى إدخال اسم الفئة بالعربي أو الإنجليزي',
      );
    }

    // التحقق من عدم تجاوز الحد الأقصى للفئات (مثلاً 50 فئة)
    const categoriesCount = await this.prisma.product_categories.count({
      where: { storeId: store.id },
    });

    if (categoriesCount >= 50) {
      throw new BadRequestException('تم الوصول للحد الأقصى من الفئات (50 فئة)');
    }

    // استخدام الاسم المتاح لتوليد الـ slug
    const nameForSlug = dto.name || dto.nameAr || 'category';

    // توليد slug إذا لم يُحدد
    const slug =
      dto.slug || (await this.generateUniqueSlug(store.id, nameForSlug));

    // التحقق من عدم وجود slug مكرر
    if (dto.slug) {
      const existing = await this.prisma.product_categories.findUnique({
        where: {
          storeId_slug: {
            storeId: store.id,
            slug: dto.slug,
          },
        },
      });

      if (existing) {
        throw new BadRequestException('الرابط المختصر مستخدم بالفعل');
      }
    }

    // الحصول على أعلى ترتيب حالي
    const maxOrder = await this.prisma.product_categories.aggregate({
      where: { storeId: store.id },
      _max: { order: true },
    });

    const order = dto.order ?? (maxOrder._max.order ?? -1) + 1;

    const category = await this.prisma.product_categories.create({
      data: {
        id: uuidv4(),
        storeId: store.id,
        name: dto.name || dto.nameAr || 'Unnamed',
        nameAr: dto.nameAr,
        slug,
        description: dto.description,
        icon: dto.icon,
        color: dto.color || '#6366f1',
        order,
        isActive: dto.isActive ?? true,
        updatedAt: new Date(),
      },
      include: {
        _count: {
          select: { products: true },
        },
      },
    });

    this.logger.log(`Category created: ${category.id} for store ${store.id}`);

    return this.formatCategoryResponse(category);
  }

  /**
   * الحصول على جميع فئات المتجر
   */
  async findAll(userId: string, includeInactive: boolean = false) {
    const store = await this.getUserStore(userId);

    const where: any = { storeId: store.id };
    if (!includeInactive) {
      where.isActive = true;
    }

    const categories = await this.prisma.product_categories.findMany({
      where,
      orderBy: { order: 'asc' },
      include: {
        _count: {
          select: { products: true },
        },
      },
    });

    return categories.map(this.formatCategoryResponse);
  }

  /**
   * الحصول على فئة واحدة بالمعرف
   */
  async findOne(userId: string, categoryId: string) {
    const category = await this.verifyCategoryOwnership(categoryId, userId);

    const fullCategory = await this.prisma.product_categories.findUnique({
      where: { id: categoryId },
      include: {
        _count: {
          select: { products: true },
        },
      },
    });

    return this.formatCategoryResponse(fullCategory);
  }

  /**
   * تحديث فئة
   */
  async update(
    userId: string,
    categoryId: string,
    dto: UpdateProductCategoryDto,
  ) {
    await this.verifyCategoryOwnership(categoryId, userId);

    const store = await this.getUserStore(userId);

    // التحقق من slug إذا تم تغييره
    if (dto.slug) {
      const existing = await this.prisma.product_categories.findFirst({
        where: {
          storeId: store.id,
          slug: dto.slug,
          id: { not: categoryId },
        },
      });

      if (existing) {
        throw new BadRequestException('الرابط المختصر مستخدم بالفعل');
      }
    }

    const category = await this.prisma.product_categories.update({
      where: { id: categoryId },
      data: {
        ...dto,
        updatedAt: new Date(),
      },
      include: {
        _count: {
          select: { products: true },
        },
      },
    });

    this.logger.log(`Category updated: ${categoryId}`);

    return this.formatCategoryResponse(category);
  }

  /**
   * حذف فئة
   */
  async remove(userId: string, categoryId: string) {
    const category = await this.verifyCategoryOwnership(categoryId, userId);

    // التحقق من عدم وجود منتجات مرتبطة
    const productsCount = await this.prisma.products.count({
      where: { categoryId },
    });

    if (productsCount > 0) {
      throw new BadRequestException(
        `لا يمكن حذف الفئة لأنها تحتوي على ${productsCount} منتج. يرجى نقل المنتجات أولاً`,
      );
    }

    await this.prisma.product_categories.delete({
      where: { id: categoryId },
    });

    this.logger.log(`Category deleted: ${categoryId}`);

    return { success: true, message: 'تم حذف الفئة بنجاح' };
  }

  /**
   * إعادة ترتيب الفئات
   */
  async reorder(userId: string, categoryIds: string[]) {
    const store = await this.getUserStore(userId);

    // التحقق من أن جميع الفئات تنتمي للمتجر
    const categories = await this.prisma.product_categories.findMany({
      where: {
        id: { in: categoryIds },
        storeId: store.id,
      },
      select: { id: true },
    });

    if (categories.length !== categoryIds.length) {
      throw new BadRequestException('بعض الفئات غير موجودة أو لا تنتمي لمتجرك');
    }

    // تحديث الترتيب
    await this.prisma.$transaction(
      categoryIds.map((id, index) =>
        this.prisma.product_categories.update({
          where: { id },
          data: { order: index, updatedAt: new Date() },
        }),
      ),
    );

    this.logger.log(`Categories reordered for store ${store.id}`);

    return { success: true, message: 'تم إعادة ترتيب الفئات بنجاح' };
  }

  /**
   * تبديل حالة التفعيل
   */
  async toggleActive(userId: string, categoryId: string) {
    const category = await this.verifyCategoryOwnership(categoryId, userId);

    const updated = await this.prisma.product_categories.update({
      where: { id: categoryId },
      data: {
        isActive: !category.isActive,
        updatedAt: new Date(),
      },
      include: {
        _count: {
          select: { products: true },
        },
      },
    });

    this.logger.log(
      `Category ${categoryId} toggled to ${updated.isActive ? 'active' : 'inactive'}`,
    );

    return this.formatCategoryResponse(updated);
  }

  /**
   * الحصول على فئات متجر عام (للعرض العام)
   */
  async getPublicCategories(storeId: string) {
    const categories = await this.prisma.product_categories.findMany({
      where: {
        storeId,
        isActive: true,
      },
      orderBy: { order: 'asc' },
      select: {
        id: true,
        name: true,
        nameAr: true,
        slug: true,
        icon: true,
        color: true,
        _count: {
          select: { products: true },
        },
      },
    });

    return categories.map((cat) => ({
      ...cat,
      productsCount: cat._count.products,
      _count: undefined,
    }));
  }

  /**
   * تنسيق استجابة الفئة
   */
  private formatCategoryResponse(category: any) {
    if (!category) return null;

    return {
      id: category.id,
      storeId: category.storeId,
      name: category.name,
      nameAr: category.nameAr,
      slug: category.slug,
      description: category.description,
      icon: category.icon,
      color: category.color,
      order: category.order,
      isActive: category.isActive,
      productsCount: category._count?.products ?? 0,
      createdAt: category.createdAt,
      updatedAt: category.updatedAt,
    };
  }
}
