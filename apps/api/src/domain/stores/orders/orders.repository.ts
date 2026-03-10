import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';

/**
 * Orders Repository - Data Access Layer
 */
@Injectable()
export class OrdersRepository {
  constructor(private readonly prisma: PrismaService) {}

  private readonly orderInclude = {
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
    addresses: true,
    stores: {
      select: {
        id: true,
        name: true,
        slug: true,
        logo: true,
      },
    },
    users: {
      select: {
        id: true,
        email: true,
        profile: {
          select: {
            name: true,
            // phone field removed to match actual schema
          },
        },
      },
    },
  } satisfies Prisma.ordersInclude;

  // ==================== CREATE ====================

  async create(data: Prisma.ordersCreateInput) {
    return this.prisma.orders.create({
      data,
      include: this.orderInclude,
    });
  }

  async createWithItems(orderData: any, items: any[]) {
    return this.prisma.$transaction(async (tx) => {
      const order = await tx.orders.create({
        data: orderData,
      });

      if (items.length > 0) {
        await tx.order_items.createMany({
          data: items.map((item) => ({
            id: uuidv4(),
            orderId: order.id,
            ...item,
          })),
        });
      }

      return this.findById(order.id);
    });
  }

  // ==================== READ ====================

  async findById(id: string) {
    return this.prisma.orders.findUnique({
      where: { id },
      include: this.orderInclude,
    });
  }

  async findByOrderNumber(orderNumber: string) {
    return this.prisma.orders.findUnique({
      where: { orderNumber },
      include: this.orderInclude,
    });
  }

  async findByUserId(
    userId: string,
    filters?: {
      status?: string;
      page?: number;
      limit?: number;
    },
  ) {
    const page = filters?.page || 1;
    const limit = filters?.limit || 10;
    const skip = (page - 1) * limit;

    const where: Prisma.ordersWhereInput = { userId };
    if (filters?.status) {
      where.status = filters.status as any;
    }

    const [orders, total] = await Promise.all([
      this.prisma.orders.findMany({
        where,
        include: this.orderInclude,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.orders.count({ where }),
    ]);

    return { orders, total, page, limit };
  }

  async findByStoreId(
    storeId: string,
    filters?: {
      status?: string;
      page?: number;
      limit?: number;
    },
  ) {
    const page = filters?.page || 1;
    const limit = filters?.limit || 10;
    const skip = (page - 1) * limit;

    const where: Prisma.ordersWhereInput = { storeId };
    if (filters?.status) {
      where.status = filters.status as any;
    }

    const [orders, total] = await Promise.all([
      this.prisma.orders.findMany({
        where,
        include: this.orderInclude,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.orders.count({ where }),
    ]);

    return { orders, total, page, limit };
  }

  // ==================== UPDATE ====================

  async update(id: string, data: Prisma.ordersUpdateInput) {
    return this.prisma.orders.update({
      where: { id },
      data,
      include: this.orderInclude,
    });
  }

  async updateStatus(id: string, status: string) {
    return this.prisma.orders.update({
      where: { id },
      data: { status: status as any, updatedAt: new Date() },
      include: this.orderInclude,
    });
  }

  // ==================== STATISTICS ====================

  async getStatsByStore(storeId: string) {
    return this.prisma.orders.aggregate({
      where: { storeId },
      _count: true,
      _sum: { total: true },
    });
  }

  async countByStatus(storeId: string) {
    return this.prisma.orders.groupBy({
      by: ['status'],
      where: { storeId },
      _count: true,
    });
  }
}
