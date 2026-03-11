import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma/prisma.service';
import { CacheManager } from '../../core/cache/cache.manager';

@Injectable()
export class AdminStoresService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheManager,
  ) {}

  async getStats() {
    return this.cache.wrap('admin:stores-stats', 120, async () => {
      const now = new Date();
      const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      weekStart.setDate(weekStart.getDate() - weekStart.getDay());
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

      const [storeRows, countRows, byCategory, byCityRaw] = await Promise.all([
        this.prisma.$queryRawUnsafe<any[]>(`
          SELECT
            COUNT(*)::int AS total,
            COUNT(*) FILTER (WHERE status = 'ACTIVE')::int AS active,
            COUNT(*) FILTER (WHERE status = 'INACTIVE')::int AS inactive,
            COUNT(*) FILTER (WHERE "createdAt" >= $1)::int AS new_this_month,
            COUNT(*) FILTER (WHERE "createdAt" >= $2)::int AS new_this_week
          FROM stores
        `, monthStart, weekStart),
        this.prisma.$queryRawUnsafe<any[]>(`
          SELECT
            (SELECT COUNT(*)::int FROM products) AS total_products,
            (SELECT COUNT(*)::int FROM orders) AS total_orders
        `),
        this.prisma.store_categories.findMany({
          where: { isActive: true },
          select: {
            id: true, name: true, nameAr: true, color: true,
            _count: { select: { stores: true } },
          },
          orderBy: { order: 'asc' },
        }),
        this.prisma.store.groupBy({
          by: ['city'],
          _count: { id: true },
          where: { city: { not: null } },
          orderBy: { _count: { id: 'desc' } },
          take: 10,
        }),
      ]);

      const s = storeRows[0];
      const c = countRows[0];

      return {
        total: s.total,
        active: s.active,
        inactive: s.inactive,
        newThisMonth: s.new_this_month,
        newThisWeek: s.new_this_week,
        totalProducts: c.total_products,
        totalOrders: c.total_orders,
        byCategory: byCategory.map((cat) => ({
          id: cat.id, name: cat.name, nameAr: cat.nameAr,
          color: cat.color, count: cat._count.stores,
        })),
        byCity: byCityRaw.map((ct) => ({
          city: ct.city || 'غير محدد',
          count: ct._count.id,
        })),
      };
    });
  }

  async getStores(query: {
    page: number;
    limit: number;
    search?: string;
    status?: string;
    categoryId?: string;
    city?: string;
  }) {
    const { page, limit, search, status, categoryId, city } = query;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { slug: { contains: search, mode: 'insensitive' } },
        { contactEmail: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (status) where.status = status;
    if (categoryId) where.categoryId = categoryId;
    if (city) where.city = city;

    const [stores, total] = await Promise.all([
      this.prisma.store.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              profile: { select: { name: true, username: true, avatar: true } },
            },
          },
          store_categories: {
            select: { id: true, name: true, nameAr: true, icon: true, color: true },
          },
          _count: { select: { products: true, orders: true, coupons: true } },
        },
      }),
      this.prisma.store.count({ where }),
    ]);

    return {
      data: stores.map((s) => ({
        id: s.id,
        name: s.name,
        slug: s.slug,
        description: s.description,
        logo: s.logo,
        status: s.status,
        city: s.city,
        country: s.country,
        contactEmail: s.contactEmail,
        createdAt: s.createdAt.toISOString(),
        user: s.user,
        store_categories: s.store_categories,
        _count: s._count,
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getStoreById(id: string) {
    return this.prisma.store.findUniqueOrThrow({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            profile: { select: { name: true, username: true, avatar: true } },
          },
        },
        store_categories: true,
        products: { take: 10, orderBy: { createdAt: 'desc' } },
        orders: { take: 10, orderBy: { createdAt: 'desc' } },
        _count: { select: { products: true, orders: true, coupons: true } },
      },
    });
  }

  async updateStoreStatus(id: string, status: string) {
    return this.prisma.store.update({
      where: { id },
      data: { status: status as any },
    });
  }

  async deleteStore(id: string) {
    return this.prisma.store.delete({ where: { id } });
  }

  // Store Categories
  async getStoreCategories() {
    return this.prisma.store_categories.findMany({
      orderBy: { order: 'asc' },
      include: { _count: { select: { stores: true } } },
    });
  }

  async createStoreCategory(data: any) {
    const id = crypto.randomUUID();
    return this.prisma.store_categories.create({
      data: {
        id,
        name: data.name,
        nameAr: data.nameAr,
        slug: data.slug,
        description: data.description,
        descriptionAr: data.descriptionAr,
        icon: data.icon,
        color: data.color || '#6366f1',
        templateFields: data.templateFields,
        order: data.order ?? 0,
        isActive: data.isActive ?? true,
        updatedAt: new Date(),
      },
    });
  }

  async updateStoreCategory(id: string, data: any) {
    return this.prisma.store_categories.update({
      where: { id },
      data: {
        name: data.name,
        nameAr: data.nameAr,
        slug: data.slug,
        description: data.description,
        descriptionAr: data.descriptionAr,
        icon: data.icon,
        color: data.color,
        templateFields: data.templateFields,
        order: data.order,
        isActive: data.isActive,
        updatedAt: new Date(),
      },
    });
  }

  async deleteStoreCategory(id: string) {
    return this.prisma.store_categories.delete({ where: { id } });
  }
}
