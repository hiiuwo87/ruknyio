import { Prisma } from '@prisma/client';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma/prisma.service';
import { CacheManager } from '../../core/cache/cache.manager';

type AdminProductsQuery = {
  page: number;
  limit: number;
  search?: string;
  status?: string;
  isFeatured?: string;
  startDate?: string;
  endDate?: string;
};

@Injectable()
export class AdminProductsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheManager,
  ) {}

  private buildProductsWhereClause(query: AdminProductsQuery) {
    const conditions: Prisma.Sql[] = [];

    if (query.search) {
      const term = `%${query.search}%`;
      conditions.push(
        Prisma.sql`(
          p.name ILIKE ${term}
          OR COALESCE(p."nameAr", '') ILIKE ${term}
          OR COALESCE(p.sku, '') ILIKE ${term}
        )`,
      );
    }

    if (query.status) {
      conditions.push(Prisma.sql`p.status = CAST(${query.status} AS "ProductStatus")`);
    }

    if (query.isFeatured !== undefined) {
      conditions.push(Prisma.sql`p."isFeatured" = ${query.isFeatured === 'true'}`);
    }

    if (query.startDate) {
      conditions.push(Prisma.sql`p."createdAt" >= ${new Date(query.startDate)}`);
    }

    if (query.endDate) {
      conditions.push(Prisma.sql`p."createdAt" <= ${new Date(query.endDate)}`);
    }

    return conditions.length > 0
      ? Prisma.sql`WHERE ${Prisma.join(conditions, ' AND ')}`
      : Prisma.empty;
  }

  async getStats() {
    return this.cache.wrap('admin:products-stats', 120, async () => {
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const weekStart = new Date(todayStart);
      weekStart.setDate(weekStart.getDate() - weekStart.getDay());
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

      const [productRows, extraRows] = await Promise.all([
        this.prisma.$queryRawUnsafe<any[]>(`
          SELECT
            COUNT(*)::int AS total,
            COUNT(*) FILTER (WHERE "createdAt" >= $1)::int AS today,
            COUNT(*) FILTER (WHERE "createdAt" >= $2)::int AS this_week,
            COUNT(*) FILTER (WHERE "createdAt" >= $3)::int AS this_month,
            COUNT(*) FILTER (WHERE status = 'ACTIVE')::int AS active,
            COUNT(*) FILTER (WHERE status = 'INACTIVE')::int AS inactive,
            COUNT(*) FILTER (WHERE status = 'OUT_OF_STOCK')::int AS out_of_stock,
            COUNT(*) FILTER (WHERE "isFeatured" = true)::int AS featured,
            COUNT(*) FILTER (WHERE "trackInventory" = true AND quantity <= 5 AND quantity > 0)::int AS low_stock,
            COALESCE(AVG(price), 0)::float AS avg_price
          FROM products
        `, todayStart, weekStart, monthStart),
        this.prisma.$queryRaw<any[]>(Prisma.sql`
          SELECT
            (
              SELECT COUNT(*)::int
              FROM stores s
              WHERE EXISTS (
                SELECT 1
                FROM products p
                WHERE p."storeId" = s.id
                LIMIT 1
              )
            ) AS total_stores,
            (SELECT COUNT(*)::int FROM product_categories WHERE "isActive" = true) AS total_categories
        `),
      ]);

      const p = productRows[0];
      const e = extraRows[0];

      return {
        total: p.total,
        today: p.today,
        thisWeek: p.this_week,
        thisMonth: p.this_month,
        byStatus: { active: p.active, inactive: p.inactive, outOfStock: p.out_of_stock },
        featured: p.featured,
        lowStock: p.low_stock,
        averagePrice: p.avg_price,
        totalStores: e.total_stores,
        totalCategories: e.total_categories,
      };
    });
  }

  async getProducts(query: AdminProductsQuery) {
    const { page, limit, search, status, isFeatured, startDate, endDate } = query;
    const skip = (page - 1) * limit;

    const whereSql = this.buildProductsWhereClause(query);

    const [products, totalRows] = await Promise.all([
      this.prisma.$queryRaw<any[]>(Prisma.sql`
        SELECT
          p.id,
          p.name,
          p."nameAr",
          p.slug,
          p.price,
          p."salePrice",
          p.quantity,
          p.status,
          p.currency,
          p.sku,
          p."isFeatured",
          p."hasVariants",
          p."trackInventory",
          p."createdAt",
          img."imagePath" AS image,
          s.id AS "storeId",
          s.name AS "storeName",
          s.slug AS "storeSlug",
          s.logo AS "storeLogo",
          c.id AS "categoryId",
          c.name AS "categoryName",
          c."nameAr" AS "categoryNameAr",
          COALESCE(oi.order_count, 0)::int AS "ordersCount",
          COALESCE(rv.review_count, 0)::int AS "reviewsCount",
          COALESCE(v.variant_count, 0)::int AS "variantsCount"
        FROM products p
        LEFT JOIN stores s ON s.id = p."storeId"
        LEFT JOIN product_categories c ON c.id = p."categoryId"
        LEFT JOIN LATERAL (
          SELECT pi."imagePath"
          FROM product_images pi
          WHERE pi."productId" = p.id AND pi."isPrimary" = true
          ORDER BY pi."displayOrder" ASC
          LIMIT 1
        ) img ON true
        LEFT JOIN LATERAL (
          SELECT COUNT(*)::int AS order_count
          FROM order_items oi
          WHERE oi."productId" = p.id
        ) oi ON true
        LEFT JOIN LATERAL (
          SELECT COUNT(*)::int AS review_count
          FROM reviews r
          WHERE r."productId" = p.id
        ) rv ON true
        LEFT JOIN LATERAL (
          SELECT COUNT(*)::int AS variant_count
          FROM product_variants pv
          WHERE pv."productId" = p.id
        ) v ON true
        ${whereSql}
        ORDER BY p."createdAt" DESC
        LIMIT ${limit}
        OFFSET ${skip}
      `),
      this.prisma.$queryRaw<any[]>(Prisma.sql`
        SELECT COUNT(*)::int AS total
        FROM products p
        ${whereSql}
      `),
    ]);

    const total = totalRows[0]?.total ?? 0;

    return {
      data: products.map((p) => ({
        id: p.id,
        name: p.name,
        nameAr: p.nameAr,
        slug: p.slug,
        price: Number(p.price),
        salePrice: p.salePrice ? Number(p.salePrice) : null,
        quantity: p.quantity,
        status: p.status,
        currency: p.currency,
        sku: p.sku,
        isFeatured: p.isFeatured,
        hasVariants: p.hasVariants,
        trackInventory: p.trackInventory,
        createdAt: p.createdAt.toISOString(),
        image: p.image ?? null,
        store: p.storeId
          ? { id: p.storeId, name: p.storeName, slug: p.storeSlug, logo: p.storeLogo }
          : null,
        category: p.categoryId
          ? { id: p.categoryId, name: p.categoryName, nameAr: p.categoryNameAr }
          : null,
        ordersCount: p.ordersCount,
        reviewsCount: p.reviewsCount,
        variantsCount: p.variantsCount,
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getProductById(id: string) {
    return this.prisma.products.findUniqueOrThrow({
      where: { id },
      include: {
        stores: { select: { id: true, name: true, slug: true, logo: true } },
        product_categories: true,
        product_images: { orderBy: { displayOrder: 'asc' } },
        variants: true,
        productAttributes: true,
        _count: { select: { order_items: true, reviews: true, variants: true } },
      },
    });
  }

  async updateProductStatus(id: string, status: string) {
    return this.prisma.products.update({
      where: { id },
      data: { status: status as any },
    });
  }

  async updateProductFeatured(id: string, isFeatured: boolean) {
    return this.prisma.products.update({
      where: { id },
      data: { isFeatured },
    });
  }

  async deleteProduct(id: string) {
    return this.prisma.products.delete({ where: { id } });
  }

  async exportProducts(query: {
    status?: string;
    startDate?: string;
    endDate?: string;
  }) {
    const where: any = {};
    if (query.status) where.status = query.status;
    if (query.startDate) where.createdAt = { ...where.createdAt, gte: new Date(query.startDate) };
    if (query.endDate) where.createdAt = { ...where.createdAt, lte: new Date(query.endDate) };

    const products = await this.prisma.products.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        stores: { select: { name: true } },
        product_categories: { select: { name: true } },
      },
    });

    return {
      data: products.map((p) => ({
        id: p.id,
        name: p.name,
        slug: p.slug,
        price: Number(p.price),
        salePrice: p.salePrice ? Number(p.salePrice) : null,
        quantity: p.quantity,
        status: p.status,
        currency: p.currency,
        sku: p.sku ?? '',
        store: p.stores?.name ?? '',
        category: p.product_categories?.name ?? '',
        createdAt: p.createdAt.toISOString(),
      })),
      total: products.length,
    };
  }
}
