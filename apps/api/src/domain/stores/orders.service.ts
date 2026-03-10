import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma/prisma.service';
import { RedisService } from '../../core/cache/redis.service';
import { CartService } from './cart.service';
import {
  CreateOrderFromCartDto,
  CreateDirectOrderDto,
  UpdateOrderStatusDto,
  CancelOrderDto,
  OrderStatus,
  OrderFiltersDto,
} from './dto/order.dto';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class OrdersService {
  constructor(
    private prisma: PrismaService,
    private cartService: CartService,
    private readonly redisService: RedisService,
  ) {}

  /**
   * Generate unique order number
   */
  private generateOrderNumber(): string {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `ORD-${timestamp}-${random}`;
  }

  /**
   * Create order from cart
   */
  async createFromCart(userId: string, createOrderDto: CreateOrderFromCartDto) {
    const { addressId, couponCode, customerNote } = createOrderDto;

    // Validate address
    const address = await this.prisma.addresses.findFirst({
      where: { id: addressId, userId },
    });

    if (!address) {
      throw new NotFoundException('العنوان غير موجود');
    }

    // Validate cart
    const cartValidation = await this.cartService.validateCart(userId);

    if (!cartValidation.isValid) {
      throw new BadRequestException({
        message: 'بعض المنتجات في السلة غير متاحة',
        errors: cartValidation.errors,
      });
    }

    if (cartValidation.validItems.length === 0) {
      throw new BadRequestException('السلة فارغة');
    }

    // Group items by store
    const itemsByStore = cartValidation.validItems.reduce(
      (acc, item) => {
        const storeId = item.product.store.id;
        if (!acc[storeId]) {
          acc[storeId] = {
            store: item.product.store,
            items: [],
            subtotal: 0,
          };
        }
        acc[storeId].items.push(item);
        acc[storeId].subtotal += item.subtotal;
        return acc;
      },
      {} as Record<string, any>,
    );

    // Handle coupon if provided
    let coupon = null;
    const discount = 0;

    if (couponCode) {
      coupon = await this.prisma.coupons.findFirst({
        where: {
          code: couponCode.toUpperCase(),
          isActive: true,
          OR: [{ endDate: null }, { endDate: { gte: new Date() } }],
        },
      });

      if (!coupon) {
        throw new BadRequestException('كود الخصم غير صالح');
      }

      // Check usage limit
      if (coupon.usageLimit && coupon.usageCount >= coupon.usageLimit) {
        throw new BadRequestException('تم استنفاد كود الخصم');
      }

      // Check per-user limit
      if (coupon.perUserLimit) {
        const userUsageCount = await this.prisma.coupon_usages.count({
          where: { couponId: coupon.id, userId },
        });
        if (userUsageCount >= coupon.perUserLimit) {
          throw new BadRequestException('لقد استخدمت هذا الكود من قبل');
        }
      }
    }

    // Create orders (one per store)
    const orders = [];

    for (const storeId of Object.keys(itemsByStore)) {
      const storeData = itemsByStore[storeId];
      let orderDiscount = 0;

      // Apply coupon if it's for this store or global
      if (coupon && (!coupon.storeId || coupon.storeId === storeId)) {
        if (coupon.discountType === 'PERCENTAGE') {
          orderDiscount =
            (storeData.subtotal * Number(coupon.discountValue)) / 100;
          if (coupon.maxDiscount) {
            orderDiscount = Math.min(orderDiscount, Number(coupon.maxDiscount));
          }
        } else {
          orderDiscount = Number(coupon.discountValue);
        }

        // Check minimum order amount
        if (
          coupon.minOrderAmount &&
          storeData.subtotal < Number(coupon.minOrderAmount)
        ) {
          orderDiscount = 0;
        }
      }

      const total = Math.max(0, storeData.subtotal - orderDiscount);

      // Create order
      const order = await this.prisma.orders.create({
        data: {
          id: uuidv4(),
          orderNumber: this.generateOrderNumber(),
          userId,
          storeId,
          addressId,
          phoneNumber: address.phoneNumber, // 🆕 ربط برقم الهاتف
          subtotal: storeData.subtotal,
          discount: orderDiscount,
          total,
          customerNote,
          couponId: coupon?.id,
        },
        include: {
          stores: {
            select: { id: true, name: true, slug: true },
          },
          addresses: true,
        },
      });

      // Invalidate dashboard cache for store owner
      try {
        const storeRec = await this.prisma.store.findUnique({
          where: { id: storeId },
          select: { userId: true },
        });
        if (storeRec?.userId) {
          await this.redisService.del(`dashboard:stats:${storeRec.userId}`);
        }
      } catch (err) {
        console.warn(
          'Redis del error (order createFromCart):',
          err?.message || err,
        );
      }

      // Create order items
      for (const item of storeData.items) {
        await this.prisma.order_items.create({
          data: {
            id: uuidv4(),
            orderId: order.id,
            productId: item.productId,
            productName: item.product.name,
            productNameAr: item.product.nameAr,
            price: item.product.salePrice || item.product.price,
            quantity: item.quantity,
            subtotal: item.subtotal,
          },
        });

        // Update product stock
        await this.prisma.products.update({
          where: { id: item.productId },
          data: {
            quantity: { decrement: item.quantity },
          },
        });
      }

      // Record coupon usage
      if (coupon && orderDiscount > 0) {
        await this.prisma.coupon_usages.create({
          data: {
            id: uuidv4(),
            couponId: coupon.id,
            userId,
            orderId: order.id,
          },
        });

        // Increment coupon usage count
        await this.prisma.coupons.update({
          where: { id: coupon.id },
          data: { usageCount: { increment: 1 } },
        });
      }

      orders.push(order);
    }

    // Clear the cart
    await this.cartService.clearCart(userId);

    return {
      message: 'تم إنشاء الطلب بنجاح',
      orders: orders.map((o) => ({
        id: o.id,
        orderNumber: o.orderNumber,
        store: o.stores,
        total: Number(o.total),
        status: o.status,
      })),
    };
  }

  /**
   * Create direct order (buy now)
   */
  async createDirect(userId: string, createOrderDto: CreateDirectOrderDto) {
    const { addressId, productId, quantity, couponCode, customerNote } =
      createOrderDto;

    // Validate address
    const address = await this.prisma.addresses.findFirst({
      where: { id: addressId, userId },
    });

    if (!address) {
      throw new NotFoundException('العنوان غير موجود');
    }

    // Get product
    const product = await this.prisma.products.findUnique({
      where: { id: productId },
      include: {
        stores: {
          select: { id: true, name: true, slug: true },
        },
      },
    });

    if (!product) {
      throw new NotFoundException('المنتج غير موجود');
    }

    if (product.status !== 'ACTIVE') {
      throw new BadRequestException('المنتج غير متاح حالياً');
    }

    if (product.quantity < quantity) {
      throw new BadRequestException(
        `الكمية المتاحة هي ${product.quantity} فقط`,
      );
    }

    const price = Number(product.salePrice || product.price);
    const subtotal = price * quantity;
    let discount = 0;
    let coupon = null;

    // Handle coupon
    if (couponCode) {
      coupon = await this.prisma.coupons.findFirst({
        where: {
          code: couponCode.toUpperCase(),
          isActive: true,
          OR: [{ storeId: null }, { storeId: product.storeId }],
        },
      });

      if (coupon) {
        if (coupon.discountType === 'PERCENTAGE') {
          discount = (subtotal * Number(coupon.discountValue)) / 100;
          if (coupon.maxDiscount) {
            discount = Math.min(discount, Number(coupon.maxDiscount));
          }
        } else {
          discount = Number(coupon.discountValue);
        }

        if (coupon.minOrderAmount && subtotal < Number(coupon.minOrderAmount)) {
          discount = 0;
        }
      }
    }

    const total = Math.max(0, subtotal - discount);

    // Create order
    const order = await this.prisma.orders.create({
      data: {
        id: uuidv4(),
        orderNumber: this.generateOrderNumber(),
        userId,
        storeId: product.storeId,
        addressId,
        phoneNumber: address.phoneNumber, // 🆕 ربط برقم الهاتف
        subtotal,
        discount,
        total,
        customerNote,
        couponId: coupon?.id,
      },
    });

    // Invalidate dashboard cache for store owner
    try {
      const storeRec = await this.prisma.store.findUnique({
        where: { id: product.storeId },
        select: { userId: true },
      });
      if (storeRec?.userId) {
        await this.redisService.del(`dashboard:stats:${storeRec.userId}`);
      }
    } catch (err) {
      console.warn(
        'Redis del error (order createDirect):',
        err?.message || err,
      );
    }

    // Create order item
    await this.prisma.order_items.create({
      data: {
        id: uuidv4(),
        orderId: order.id,
        productId,
        productName: product.name,
        productNameAr: product.nameAr,
        price,
        quantity,
        subtotal,
      },
    });

    // Update product stock
    await this.prisma.products.update({
      where: { id: productId },
      data: {
        quantity: { decrement: quantity },
      },
    });

    // Record coupon usage
    if (coupon && discount > 0) {
      await this.prisma.coupon_usages.create({
        data: {
          id: uuidv4(),
          couponId: coupon.id,
          userId,
          orderId: order.id,
        },
      });

      await this.prisma.coupons.update({
        where: { id: coupon.id },
        data: { usageCount: { increment: 1 } },
      });
    }

    return this.getOrder(order.id, userId);
  }

  /**
   * Get user's orders (as customer)
   */
  async getMyOrders(userId: string, filters?: OrderFiltersDto) {
    const where: any = { userId };

    if (filters?.status) {
      where.status = filters.status;
    }

    if (filters?.storeId) {
      where.storeId = filters.storeId;
    }

    if (filters?.startDate || filters?.endDate) {
      where.createdAt = {};
      if (filters.startDate) where.createdAt.gte = filters.startDate;
      if (filters.endDate) where.createdAt.lte = filters.endDate;
    }

    const orders = await this.prisma.orders.findMany({
      where,
      include: {
        stores: {
          select: { id: true, name: true, slug: true, logo: true },
        },
        addresses: true,
        order_items: {
          include: {
            products: {
              include: {
                product_images: {
                  where: { isPrimary: true },
                  take: 1,
                },
              },
            },
          },
        },
        _count: {
          select: { order_items: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return orders.map((order) => this.formatOrder(order));
  }

  /**
   * Get store's orders (as seller)
   */
  async getStoreOrders(userId: string, filters?: OrderFiltersDto) {
    // Get user's store
    const store = await this.prisma.store.findFirst({
      where: { userId },
    });

    if (!store) {
      throw new NotFoundException('لا يوجد لديك متجر');
    }

    const where: any = { storeId: store.id };

    if (filters?.status) {
      where.status = filters.status;
    }

    if (filters?.startDate || filters?.endDate) {
      where.createdAt = {};
      if (filters.startDate) where.createdAt.gte = filters.startDate;
      if (filters.endDate) where.createdAt.lte = filters.endDate;
    }

    const orders = await this.prisma.orders.findMany({
      where,
      include: {
        users: {
          select: {
            id: true,
            email: true,
            profile: {
              select: { name: true, avatar: true },
            },
          },
        },
        addresses: true,
        order_items: {
          include: {
            products: {
              include: {
                product_images: {
                  where: { isPrimary: true },
                  take: 1,
                },
              },
            },
          },
        },
        _count: {
          select: { order_items: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return orders.map((order) => this.formatOrder(order, true));
  }

  /**
   * Get single order
   */
  async getOrder(orderId: string, userId: string) {
    const order = await this.prisma.orders.findUnique({
      where: { id: orderId },
      include: {
        stores: {
          select: {
            id: true,
            name: true,
            slug: true,
            logo: true,
            userId: true,
          },
        },
        users: {
          select: {
            id: true,
            email: true,
            profile: {
              select: { name: true, avatar: true },
            },
          },
        },
        addresses: true,
        order_items: {
          include: {
            products: {
              include: {
                product_images: {
                  where: { isPrimary: true },
                  take: 1,
                },
              },
            },
          },
        },
        coupons: {
          select: { code: true, discountType: true, discountValue: true },
        },
      },
    });

    if (!order) {
      throw new NotFoundException('الطلب غير موجود');
    }

    // Check authorization (customer or store owner)
    const isCustomer = order.userId === userId;
    const isStoreOwner = order.stores?.userId === userId;

    if (!isCustomer && !isStoreOwner) {
      throw new ForbiddenException('غير مصرح لك بعرض هذا الطلب');
    }

    return this.formatOrder(order, isStoreOwner);
  }

  /**
   * Update order status (store owner only)
   */
  async updateOrderStatus(
    orderId: string,
    userId: string,
    updateDto: UpdateOrderStatusDto,
  ) {
    const order = await this.prisma.orders.findUnique({
      where: { id: orderId },
      include: {
        stores: true,
      },
    });

    if (!order) {
      throw new NotFoundException('الطلب غير موجود');
    }

    if (order.stores.userId !== userId) {
      throw new ForbiddenException('غير مصرح لك بتحديث هذا الطلب');
    }

    // Validate status transition
    const validTransitions: Record<string, string[]> = {
      PENDING: ['CONFIRMED', 'CANCELLED'],
      CONFIRMED: ['PROCESSING', 'CANCELLED'],
      PROCESSING: ['SHIPPED', 'CANCELLED'],
      SHIPPED: ['OUT_FOR_DELIVERY', 'DELIVERED'],
      OUT_FOR_DELIVERY: ['DELIVERED'],
      DELIVERED: ['REFUNDED'],
      CANCELLED: [],
      REFUNDED: [],
    };

    if (!validTransitions[order.status]?.includes(updateDto.status)) {
      throw new BadRequestException(
        `لا يمكن تغيير الحالة من ${order.status} إلى ${updateDto.status}`,
      );
    }

    const updateData: any = {
      status: updateDto.status,
      updatedAt: new Date(),
    };

    if (updateDto.storeNote) {
      updateData.storeNote = updateDto.storeNote;
    }

    if (updateDto.estimatedDelivery) {
      updateData.estimatedDelivery = updateDto.estimatedDelivery;
    }

    if (updateDto.status === 'DELIVERED') {
      updateData.deliveredAt = new Date();
    }

    const updatedOrder = await this.prisma.orders.update({
      where: { id: orderId },
      data: updateData,
    });

    return this.getOrder(orderId, userId);
  }

  /**
   * Cancel order (customer only, if pending/confirmed)
   */
  async cancelOrder(
    orderId: string,
    userId: string,
    cancelDto: CancelOrderDto,
  ) {
    const order = await this.prisma.orders.findUnique({
      where: { id: orderId },
      include: {
        order_items: true,
      },
    });

    if (!order) {
      throw new NotFoundException('الطلب غير موجود');
    }

    if (order.userId !== userId) {
      throw new ForbiddenException('غير مصرح لك بإلغاء هذا الطلب');
    }

    if (!['PENDING', 'CONFIRMED'].includes(order.status)) {
      throw new BadRequestException('لا يمكن إلغاء الطلب في هذه المرحلة');
    }

    // Restore product stock
    for (const item of order.order_items) {
      await this.prisma.products.update({
        where: { id: item.productId },
        data: {
          quantity: { increment: item.quantity },
        },
      });
    }

    // Update order
    await this.prisma.orders.update({
      where: { id: orderId },
      data: {
        status: 'CANCELLED',
        cancelledAt: new Date(),
        cancellationReason: cancelDto.cancellationReason,
        updatedAt: new Date(),
      },
    });

    return { message: 'تم إلغاء الطلب بنجاح' };
  }

  /**
   * Get order statistics for store
   */
  async getStoreOrderStats(userId: string) {
    const store = await this.prisma.store.findFirst({
      where: { userId },
    });

    if (!store) {
      return {
        totalOrders: 0,
        pendingOrders: 0,
        processingOrders: 0,
        completedOrders: 0,
        cancelledOrders: 0,
        totalRevenue: 0,
      };
    }

    const [statusCounts, revenueData] = await Promise.all([
      this.prisma.orders.groupBy({
        by: ['status'],
        where: { storeId: store.id },
        _count: true,
      }),
      this.prisma.orders.aggregate({
        where: {
          storeId: store.id,
          status: 'DELIVERED',
        },
        _sum: { total: true },
      }),
    ]);

    const totalOrders = statusCounts.reduce((sum, s) => sum + s._count, 0);
    const getCount = (status: string) =>
      statusCounts.find((s) => s.status === status)?._count || 0;

    return {
      totalOrders,
      pendingOrders: getCount('PENDING'),
      processingOrders:
        getCount('CONFIRMED') + getCount('PROCESSING') + getCount('SHIPPED'),
      completedOrders: getCount('DELIVERED'),
      cancelledOrders: getCount('CANCELLED') + getCount('REFUNDED'),
      totalRevenue: Number(revenueData._sum?.total || 0),
    };
  }

  /**
   * 🔐 تتبع الطلب بشكل آمن (عام)
   * يتطلب رقم الطلب + آخر 4 أرقام من الهاتف للتحقق
   */
  async trackOrderSecure(orderNumber: string, phoneLast4: string) {
    // 1. البحث عن الطلب برقم الطلب
    const order = await this.prisma.orders.findUnique({
      where: { orderNumber },
      include: {
        stores: {
          select: { name: true },
        },
        addresses: {
          select: {
            city: true,
            district: true,
            phoneNumber: true,
          },
        },
        _count: {
          select: { order_items: true },
        },
      },
    });

    // 2. الطلب غير موجود
    if (!order) {
      throw new NotFoundException({
        message: 'الطلب غير موجود',
        code: 'ORDER_NOT_FOUND',
      });
    }

    // 3. 🔒 التحقق من آخر 4 أرقام من رقم الهاتف
    const orderPhone = order.addresses?.phoneNumber || '';
    const actualLast4 = orderPhone.slice(-4);

    if (actualLast4 !== phoneLast4) {
      throw new BadRequestException({
        message: 'رقم الهاتف غير متطابق مع بيانات الطلب',
        code: 'PHONE_VERIFICATION_FAILED',
      });
    }

    // 4. إرجاع بيانات التتبع المحدودة (بدون تفاصيل حساسة)
    return {
      orderNumber: order.orderNumber,
      status: order.status,
      statusLabel: this.getStatusLabel(order.status),
      deliveryAddress: {
        city: order.addresses?.city,
        district: order.addresses?.district,
      },
      estimatedDelivery: order.estimatedDelivery,
      lastUpdate: order.updatedAt,
      storeName: order.stores?.name,
      itemsCount: order._count?.order_items || 0,
      total: Number(order.total),
      currency: order.currency,
      createdAt: order.createdAt,
      // لا نُظهر العنوان الكامل أو معلومات أخرى حساسة
    };
  }

  /**
   * الحصول على وصف الحالة بالعربية
   */
  private getStatusLabel(status: string): string {
    const labels: Record<string, string> = {
      PENDING: 'قيد الانتظار',
      CONFIRMED: 'تم التأكيد',
      PROCESSING: 'قيد التحضير',
      SHIPPED: 'تم الشحن',
      OUT_FOR_DELIVERY: 'في الطريق',
      DELIVERED: 'تم التسليم',
      CANCELLED: 'ملغي',
      REFUNDED: 'مسترد',
    };
    return labels[status] || status;
  }

  /**
   * Format order for response
   */
  private formatOrder(order: any, includeCustomer = false) {
    const formatted: any = {
      id: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      subtotal: Number(order.subtotal),
      shippingFee: Number(order.shippingFee),
      discount: Number(order.discount),
      total: Number(order.total),
      currency: order.currency,
      customerNote: order.customerNote,
      storeNote: order.storeNote,
      estimatedDelivery: order.estimatedDelivery,
      deliveredAt: order.deliveredAt,
      cancelledAt: order.cancelledAt,
      cancellationReason: order.cancellationReason,
      createdAt: order.createdAt,
      itemsCount: order._count?.order_items || order.order_items?.length || 0,
      store: order.stores,
      address: order.addresses,
      items: order.order_items?.map((item: any) => ({
        id: item.id,
        productId: item.productId,
        productName: item.productName,
        productNameAr: item.productNameAr,
        price: Number(item.price),
        quantity: item.quantity,
        subtotal: Number(item.subtotal),
        image: item.products?.product_images?.[0]?.imagePath || null,
      })),
    };

    if (includeCustomer && order.users) {
      formatted.customer = {
        id: order.users.id,
        email: order.users.email,
        name: order.users.profile?.name,
        avatar: order.users.profile?.avatar,
      };
    }

    if (order.coupons) {
      formatted.coupon = order.coupons;
    }

    return formatted;
  }
}
