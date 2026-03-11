import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma/prisma.service';
import { CacheManager } from '../../core/cache/cache.manager';

@Injectable()
export class AdminOrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheManager,
  ) {}

  async getStats() {
    return this.cache.wrap('admin:orders-stats', 120, async () => {
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const weekStart = new Date(todayStart);
      weekStart.setDate(weekStart.getDate() - weekStart.getDay());
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

      const rows = await this.prisma.$queryRawUnsafe<any[]>(`
        SELECT
          COUNT(*)::int AS total,
          COUNT(*) FILTER (WHERE "createdAt" >= $1)::int AS today,
          COUNT(*) FILTER (WHERE "createdAt" >= $2)::int AS this_week,
          COUNT(*) FILTER (WHERE "createdAt" >= $3)::int AS this_month,
          COUNT(*) FILTER (WHERE status = 'PENDING')::int AS pending,
          COUNT(*) FILTER (WHERE status = 'CONFIRMED')::int AS confirmed,
          COUNT(*) FILTER (WHERE status = 'PROCESSING')::int AS processing,
          COUNT(*) FILTER (WHERE status = 'SHIPPED')::int AS shipped,
          COUNT(*) FILTER (WHERE status = 'OUT_FOR_DELIVERY')::int AS out_for_delivery,
          COUNT(*) FILTER (WHERE status = 'DELIVERED')::int AS delivered,
          COUNT(*) FILTER (WHERE status = 'CANCELLED')::int AS cancelled,
          COUNT(*) FILTER (WHERE status = 'REFUNDED')::int AS refunded,
          COALESCE(SUM(total), 0)::float AS revenue_total,
          COALESCE(SUM(total) FILTER (WHERE "createdAt" >= $3), 0)::float AS revenue_month,
          COALESCE(SUM(total) FILTER (WHERE "createdAt" >= $1), 0)::float AS revenue_today,
          COALESCE(AVG(total), 0)::float AS avg_order
        FROM orders
      `, todayStart, weekStart, monthStart);

      const r = rows[0];
      const total = r.total;
      const cancelled = r.cancelled;
      const refunded = r.refunded;

      return {
        total,
        today: r.today,
        thisWeek: r.this_week,
        thisMonth: r.this_month,
        byStatus: {
          pending: r.pending,
          confirmed: r.confirmed,
          processing: r.processing,
          shipped: r.shipped,
          outForDelivery: r.out_for_delivery,
          delivered: r.delivered,
          cancelled,
          refunded,
        },
        revenue: {
          total: r.revenue_total,
          thisMonth: r.revenue_month,
          today: r.revenue_today,
        },
        averageOrderValue: r.avg_order,
        cancellationRate:
          total > 0 ? Math.round(((cancelled + refunded) / total) * 100) : 0,
      };
    });
  }

  async getOrders(query: {
    page: number;
    limit: number;
    search?: string;
    status?: string;
    startDate?: string;
    endDate?: string;
  }) {
    const { page, limit, search, status, startDate, endDate } = query;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (search) {
      where.OR = [
        { orderNumber: { contains: search, mode: 'insensitive' } },
        { phoneNumber: { contains: search } },
      ];
    }
    if (status) where.status = status;
    if (startDate) where.createdAt = { ...where.createdAt, gte: new Date(startDate) };
    if (endDate) where.createdAt = { ...where.createdAt, lte: new Date(endDate) };

    const [orders, total] = await Promise.all([
      this.prisma.orders.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          users: {
            select: {
              id: true,
              email: true,
              profile: { select: { name: true, avatar: true } },
            },
          },
          stores: { select: { id: true, name: true, slug: true, logo: true } },
          _count: { select: { order_items: true } },
        },
      }),
      this.prisma.orders.count({ where }),
    ]);

    return {
      data: orders.map((o) => ({
        id: o.id,
        orderNumber: o.orderNumber,
        status: o.status,
        subtotal: Number(o.subtotal),
        shippingFee: Number(o.shippingFee),
        discount: Number(o.discount),
        total: Number(o.total),
        currency: o.currency,
        phoneNumber: o.phoneNumber,
        createdAt: o.createdAt.toISOString(),
        itemsCount: o._count.order_items,
        customer: o.users
          ? {
              id: o.users.id,
              email: o.users.email,
              name: o.users.profile?.name,
              avatar: o.users.profile?.avatar,
            }
          : null,
        store: o.stores
          ? { id: o.stores.id, name: o.stores.name, slug: o.stores.slug, logo: o.stores.logo }
          : null,
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getOrderById(id: string) {
    return this.prisma.orders.findUniqueOrThrow({
      where: { id },
      include: {
        users: {
          select: {
            id: true,
            email: true,
            profile: { select: { name: true, username: true, avatar: true } },
          },
        },
        stores: { select: { id: true, name: true, slug: true, logo: true } },
        addresses: true,
        order_items: {
          include: {
            products: {
              select: {
                id: true,
                name: true,
                slug: true,
                product_images: { where: { isPrimary: true }, take: 1 },
              },
            },
          },
        },
        coupons: true,
      },
    });
  }

  async updateOrderStatus(id: string, status: string) {
    const data: any = { status: status as any };
    if (status === 'DELIVERED') data.deliveredAt = new Date();
    if (status === 'CANCELLED') data.cancelledAt = new Date();
    return this.prisma.orders.update({ where: { id }, data });
  }

  async deleteOrder(id: string) {
    return this.prisma.orders.delete({ where: { id } });
  }

  async exportOrders(query: {
    status?: string;
    startDate?: string;
    endDate?: string;
  }) {
    const where: any = {};
    if (query.status) where.status = query.status;
    if (query.startDate) where.createdAt = { ...where.createdAt, gte: new Date(query.startDate) };
    if (query.endDate) where.createdAt = { ...where.createdAt, lte: new Date(query.endDate) };

    const orders = await this.prisma.orders.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        users: { select: { email: true } },
        stores: { select: { name: true } },
        _count: { select: { order_items: true } },
      },
    });

    return {
      data: orders.map((o) => ({
        id: o.id,
        orderNumber: o.orderNumber,
        status: o.status,
        total: Number(o.total),
        currency: o.currency,
        phoneNumber: o.phoneNumber,
        customerEmail: o.users?.email ?? '',
        store: o.stores?.name ?? '',
        itemsCount: o._count.order_items,
        createdAt: o.createdAt.toISOString(),
      })),
      total: orders.length,
    };
  }
}
