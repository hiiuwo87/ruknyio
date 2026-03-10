import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma/prisma.service';
import {
  CreateCouponDto,
  UpdateCouponDto,
  ValidateCouponDto,
  CouponFiltersDto,
  DiscountType,
} from './dto/coupon.dto';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class CouponsService {
  constructor(private prisma: PrismaService) {}

  /**
   * Create a new coupon (store owner)
   */
  async createCoupon(userId: string, createCouponDto: CreateCouponDto) {
    // Get user's store
    const store = await this.prisma.store.findFirst({
      where: { userId },
    });

    if (!store) {
      throw new NotFoundException('لا يوجد لديك متجر');
    }

    // Check for duplicate code
    const existingCoupon = await this.prisma.coupons.findUnique({
      where: { code: createCouponDto.code },
    });

    if (existingCoupon) {
      throw new ConflictException('كود الخصم مستخدم مسبقاً');
    }

    // Validate percentage discount
    if (
      createCouponDto.discountType === DiscountType.PERCENTAGE &&
      createCouponDto.discountValue > 100
    ) {
      throw new BadRequestException('نسبة الخصم لا يمكن أن تتجاوز 100%');
    }

    // Create coupon
    const coupon = await this.prisma.coupons.create({
      data: {
        id: uuidv4(),
        storeId: store.id,
        code: createCouponDto.code,
        description: createCouponDto.description,
        descriptionAr: createCouponDto.descriptionAr,
        discountType: createCouponDto.discountType,
        discountValue: createCouponDto.discountValue,
        minOrderAmount: createCouponDto.minOrderAmount,
        maxDiscount: createCouponDto.maxDiscount,
        usageLimit: createCouponDto.usageLimit,
        perUserLimit: createCouponDto.perUserLimit ?? 1,
        startDate: createCouponDto.startDate
          ? new Date(createCouponDto.startDate)
          : new Date(),
        endDate: createCouponDto.endDate
          ? new Date(createCouponDto.endDate)
          : null,
        isActive: createCouponDto.isActive ?? true,
        updatedAt: new Date(),
      },
    });

    return {
      message: 'تم إنشاء كود الخصم بنجاح',
      coupon: this.formatCoupon(coupon),
    };
  }

  /**
   * Update coupon (store owner)
   */
  async updateCoupon(
    couponId: string,
    userId: string,
    updateCouponDto: UpdateCouponDto,
  ) {
    const coupon = await this.prisma.coupons.findUnique({
      where: { id: couponId },
      include: {
        stores: {
          select: { userId: true },
        },
      },
    });

    if (!coupon) {
      throw new NotFoundException('كود الخصم غير موجود');
    }

    if (coupon.stores?.userId !== userId) {
      throw new ForbiddenException('غير مصرح لك بتعديل هذا الكوبون');
    }

    // Validate percentage discount
    if (
      updateCouponDto.discountType === DiscountType.PERCENTAGE &&
      updateCouponDto.discountValue &&
      updateCouponDto.discountValue > 100
    ) {
      throw new BadRequestException('نسبة الخصم لا يمكن أن تتجاوز 100%');
    }

    const updatedCoupon = await this.prisma.coupons.update({
      where: { id: couponId },
      data: {
        ...updateCouponDto,
        startDate: updateCouponDto.startDate
          ? new Date(updateCouponDto.startDate)
          : undefined,
        endDate: updateCouponDto.endDate
          ? new Date(updateCouponDto.endDate)
          : undefined,
        updatedAt: new Date(),
      },
    });

    return {
      message: 'تم تحديث كود الخصم بنجاح',
      coupon: this.formatCoupon(updatedCoupon),
    };
  }

  /**
   * Delete coupon (store owner)
   */
  async deleteCoupon(couponId: string, userId: string) {
    const coupon = await this.prisma.coupons.findUnique({
      where: { id: couponId },
      include: {
        stores: {
          select: { userId: true },
        },
        _count: {
          select: { orders: true },
        },
      },
    });

    if (!coupon) {
      throw new NotFoundException('كود الخصم غير موجود');
    }

    if (coupon.stores?.userId !== userId) {
      throw new ForbiddenException('غير مصرح لك بحذف هذا الكوبون');
    }

    // Check if coupon has been used
    if (coupon._count.orders > 0) {
      // Soft delete by deactivating
      await this.prisma.coupons.update({
        where: { id: couponId },
        data: { isActive: false, updatedAt: new Date() },
      });
      return {
        message: 'تم إلغاء تفعيل الكوبون (لا يمكن حذفه لأنه مستخدم في طلبات)',
      };
    }

    await this.prisma.coupons.delete({
      where: { id: couponId },
    });

    return { message: 'تم حذف كود الخصم بنجاح' };
  }

  /**
   * Get store coupons (store owner)
   */
  async getStoreCoupons(userId: string, filters?: CouponFiltersDto) {
    const store = await this.prisma.store.findFirst({
      where: { userId },
    });

    if (!store) {
      throw new NotFoundException('لا يوجد لديك متجر');
    }

    const where: any = { storeId: store.id };

    if (filters?.search) {
      where.code = {
        contains: filters.search.toUpperCase(),
        mode: 'insensitive',
      };
    }

    if (filters?.isActive !== undefined) {
      where.isActive = filters.isActive;
    }

    if (filters?.validOnly) {
      where.isActive = true;
      where.OR = [{ endDate: null }, { endDate: { gte: new Date() } }];
      where.AND = [
        {
          OR: [
            { usageLimit: null },
            { usageCount: { lt: { $col: 'usageLimit' } } },
          ],
        },
      ];
    }

    // Pagination
    const page = filters?.page || 1;
    const limit = filters?.limit || 10;
    const skip = (page - 1) * limit;

    const [coupons, total] = await Promise.all([
      this.prisma.coupons.findMany({
        where,
        include: {
          _count: {
            select: { orders: true, coupon_usages: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.coupons.count({ where }),
    ]);

    return {
      coupons: coupons.map((c) => this.formatCoupon(c, true)),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get single coupon details (store owner)
   */
  async getCoupon(couponId: string, userId: string) {
    const coupon = await this.prisma.coupons.findUnique({
      where: { id: couponId },
      include: {
        stores: {
          select: { id: true, userId: true, name: true },
        },
        _count: {
          select: { orders: true, coupon_usages: true },
        },
        coupon_usages: {
          take: 10,
          orderBy: { usedAt: 'desc' },
          include: {
            users: {
              select: {
                id: true,
                email: true,
                profile: {
                  select: { name: true },
                },
              },
            },
          },
        },
      },
    });

    if (!coupon) {
      throw new NotFoundException('كود الخصم غير موجود');
    }

    if (coupon.stores?.userId !== userId) {
      throw new ForbiddenException('غير مصرح لك بعرض هذا الكوبون');
    }

    return this.formatCoupon(coupon, true);
  }

  /**
   * Validate coupon code (public - for checkout)
   */
  async validateCoupon(userId: string, validateDto: ValidateCouponDto) {
    const { code, storeId, orderAmount } = validateDto;

    const coupon = await this.prisma.coupons.findUnique({
      where: { code: code.toUpperCase() },
      include: {
        stores: {
          select: { id: true, name: true },
        },
      },
    });

    if (!coupon) {
      return {
        isValid: false,
        error: 'كود الخصم غير موجود',
      };
    }

    // Check if active
    if (!coupon.isActive) {
      return {
        isValid: false,
        error: 'كود الخصم غير مفعل',
      };
    }

    // Check store restriction
    if (coupon.storeId && storeId && coupon.storeId !== storeId) {
      return {
        isValid: false,
        error: 'كود الخصم غير صالح لهذا المتجر',
      };
    }

    // Check date validity
    const now = new Date();
    if (coupon.startDate && coupon.startDate > now) {
      return {
        isValid: false,
        error: 'كود الخصم لم يبدأ بعد',
      };
    }

    if (coupon.endDate && coupon.endDate < now) {
      return {
        isValid: false,
        error: 'كود الخصم منتهي الصلاحية',
      };
    }

    // Check usage limit
    if (coupon.usageLimit && coupon.usageCount >= coupon.usageLimit) {
      return {
        isValid: false,
        error: 'تم استنفاد كود الخصم',
      };
    }

    // Check per-user limit
    if (coupon.perUserLimit) {
      const userUsageCount = await this.prisma.coupon_usages.count({
        where: { couponId: coupon.id, userId },
      });
      if (userUsageCount >= coupon.perUserLimit) {
        return {
          isValid: false,
          error: 'لقد استخدمت هذا الكود الحد الأقصى المسموح',
        };
      }
    }

    // Check minimum order amount
    if (
      coupon.minOrderAmount &&
      orderAmount &&
      orderAmount < Number(coupon.minOrderAmount)
    ) {
      return {
        isValid: false,
        error: `الحد الأدنى للطلب هو ${Number(coupon.minOrderAmount)} ر.س`,
        minOrderAmount: Number(coupon.minOrderAmount),
      };
    }

    // Calculate discount
    let discount = 0;
    if (orderAmount) {
      if (coupon.discountType === 'PERCENTAGE') {
        discount = (orderAmount * Number(coupon.discountValue)) / 100;
        if (coupon.maxDiscount) {
          discount = Math.min(discount, Number(coupon.maxDiscount));
        }
      } else if (coupon.discountType === 'FIXED_AMOUNT') {
        discount = Number(coupon.discountValue);
      }
      // FREE_SHIPPING handled separately
    }

    return {
      isValid: true,
      coupon: {
        id: coupon.id,
        code: coupon.code,
        description: coupon.description,
        descriptionAr: coupon.descriptionAr,
        discountType: coupon.discountType,
        discountValue: Number(coupon.discountValue),
        minOrderAmount: coupon.minOrderAmount
          ? Number(coupon.minOrderAmount)
          : null,
        maxDiscount: coupon.maxDiscount ? Number(coupon.maxDiscount) : null,
        store: coupon.stores,
      },
      calculatedDiscount: discount,
    };
  }

  /**
   * Get coupon statistics (store owner)
   */
  async getCouponStats(userId: string) {
    const store = await this.prisma.store.findFirst({
      where: { userId },
    });

    if (!store) {
      return {
        totalCoupons: 0,
        activeCoupons: 0,
        expiredCoupons: 0,
        totalUsage: 0,
        totalDiscountGiven: 0,
      };
    }

    const now = new Date();

    const [totalCoupons, activeCoupons, expiredCoupons, usageStats] =
      await Promise.all([
        this.prisma.coupons.count({ where: { storeId: store.id } }),
        this.prisma.coupons.count({
          where: {
            storeId: store.id,
            isActive: true,
            OR: [{ endDate: null }, { endDate: { gte: now } }],
          },
        }),
        this.prisma.coupons.count({
          where: {
            storeId: store.id,
            endDate: { lt: now },
          },
        }),
        this.prisma.coupons.aggregate({
          where: { storeId: store.id },
          _sum: { usageCount: true },
        }),
      ]);

    // Calculate total discount given from orders
    const ordersWithDiscount = await this.prisma.orders.aggregate({
      where: {
        storeId: store.id,
        couponId: { not: null },
        status: { not: 'CANCELLED' },
      },
      _sum: { discount: true },
    });

    return {
      totalCoupons,
      activeCoupons,
      expiredCoupons,
      totalUsage: usageStats._sum?.usageCount || 0,
      totalDiscountGiven: Number(ordersWithDiscount._sum?.discount || 0),
    };
  }

  /**
   * Toggle coupon status
   */
  async toggleCouponStatus(couponId: string, userId: string) {
    const coupon = await this.prisma.coupons.findUnique({
      where: { id: couponId },
      include: {
        stores: {
          select: { userId: true },
        },
      },
    });

    if (!coupon) {
      throw new NotFoundException('كود الخصم غير موجود');
    }

    if (coupon.stores?.userId !== userId) {
      throw new ForbiddenException('غير مصرح لك بتعديل هذا الكوبون');
    }

    const updatedCoupon = await this.prisma.coupons.update({
      where: { id: couponId },
      data: {
        isActive: !coupon.isActive,
        updatedAt: new Date(),
      },
    });

    return {
      message: updatedCoupon.isActive
        ? 'تم تفعيل الكوبون'
        : 'تم إلغاء تفعيل الكوبون',
      isActive: updatedCoupon.isActive,
    };
  }

  /**
   * Format coupon for response
   */
  private formatCoupon(coupon: any, includeStats = false) {
    const now = new Date();
    const isExpired = coupon.endDate && new Date(coupon.endDate) < now;
    const isExhausted =
      coupon.usageLimit && coupon.usageCount >= coupon.usageLimit;

    const formatted: any = {
      id: coupon.id,
      code: coupon.code,
      description: coupon.description,
      descriptionAr: coupon.descriptionAr,
      discountType: coupon.discountType,
      discountValue: Number(coupon.discountValue),
      minOrderAmount: coupon.minOrderAmount
        ? Number(coupon.minOrderAmount)
        : null,
      maxDiscount: coupon.maxDiscount ? Number(coupon.maxDiscount) : null,
      usageLimit: coupon.usageLimit,
      usageCount: coupon.usageCount,
      perUserLimit: coupon.perUserLimit,
      startDate: coupon.startDate,
      endDate: coupon.endDate,
      isActive: coupon.isActive,
      isExpired,
      isExhausted,
      isValid: coupon.isActive && !isExpired && !isExhausted,
      createdAt: coupon.createdAt,
    };

    if (includeStats && coupon._count) {
      formatted.stats = {
        ordersCount: coupon._count.orders || 0,
        usagesCount: coupon._count.coupon_usages || 0,
      };
    }

    if (coupon.coupon_usages) {
      formatted.recentUsages = coupon.coupon_usages.map((usage: any) => ({
        usedAt: usage.usedAt,
        user: {
          id: usage.users?.id,
          email: usage.users?.email,
          name: usage.users?.profile?.name,
        },
      }));
    }

    return formatted;
  }
}
