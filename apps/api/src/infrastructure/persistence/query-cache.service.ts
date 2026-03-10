import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { RedisService } from '../../core/cache/redis.service';
import { PrismaService } from '../../core/database/prisma/prisma.service';
import { createHash } from 'crypto';

/**
 * 🗄️ Query Caching Layer
 *
 * طبقة cache ذكية للاستعلامات:
 * - Cache تلقائي للاستعلامات المتكررة
 * - Invalidation ذكي عند التحديث
 * - دعم TTL مختلف حسب نوع البيانات
 */
@Injectable()
export class QueryCacheService implements OnModuleInit {
  private readonly logger = new Logger(QueryCacheService.name);

  // إعدادات TTL الافتراضية (بالثواني)
  private readonly TTL = {
    // بيانات ثابتة نسبياً
    user_profile: 300, // 5 دقائق
    store_info: 300, // 5 دقائق
    event_details: 120, // دقيقتان

    // بيانات ديناميكية
    event_list: 60, // دقيقة
    store_products: 60, // دقيقة
    search_results: 30, // 30 ثانية

    // إحصائيات
    analytics: 300, // 5 دقائق
    dashboard_stats: 60, // دقيقة

    // إعدادات
    settings: 600, // 10 دقائق
    subscription: 300, // 5 دقائق
  };

  // أنماط المفاتيح للـ Invalidation
  private readonly INVALIDATION_PATTERNS: Record<string, string[]> = {
    user: ['user_profile:*', 'dashboard_stats:*'],
    profile: ['user_profile:*'],
    store: ['store_info:*', 'store_products:*'],
    product: ['store_products:*', 'search_results:*'],
    event: ['event_details:*', 'event_list:*'],
    subscription: ['subscription:*', 'user_profile:*'],
  };

  constructor(
    private readonly redis: RedisService,
    private readonly prisma: PrismaService,
  ) {}

  onModuleInit() {
    this.logger.log('🗄️ Query Cache Service initialized');
  }

  // ==================== Core Methods ====================

  /**
   * الحصول على قيمة من الـ cache أو تنفيذ الاستعلام
   */
  async getOrSet<T>(
    key: string,
    fetcher: () => Promise<T>,
    ttl?: number,
  ): Promise<T> {
    // محاولة الحصول من الـ cache
    const cached = await this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    // تنفيذ الاستعلام
    const result = await fetcher();

    // حفظ في الـ cache
    await this.set(key, result, ttl);

    return result;
  }

  /**
   * الحصول على قيمة من الـ cache
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      const fullKey = this.buildKey(key);
      const cached = await this.redis.get<T>(fullKey);

      if (cached) {
        this.logger.debug(`Cache HIT: ${key}`);
        return cached;
      }

      this.logger.debug(`Cache MISS: ${key}`);
      return null;
    } catch (error) {
      this.logger.warn(`Cache get error: ${error.message}`);
      return null;
    }
  }

  /**
   * حفظ قيمة في الـ cache
   */
  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    try {
      const fullKey = this.buildKey(key);
      const cacheTtl = ttl || this.getTtlForKey(key);

      await this.redis.setex(fullKey, cacheTtl, JSON.stringify(value));
      this.logger.debug(`Cache SET: ${key} (TTL: ${cacheTtl}s)`);
    } catch (error) {
      this.logger.warn(`Cache set error: ${error.message}`);
    }
  }

  /**
   * حذف قيمة من الـ cache
   */
  async del(key: string): Promise<void> {
    try {
      const fullKey = this.buildKey(key);
      await this.redis.del(fullKey);
      this.logger.debug(`Cache DEL: ${key}`);
    } catch (error) {
      this.logger.warn(`Cache del error: ${error.message}`);
    }
  }

  /**
   * إلغاء صلاحية مجموعة من المفاتيح
   */
  async invalidate(entity: string, id?: string): Promise<number> {
    const patterns = this.INVALIDATION_PATTERNS[entity] || [];
    let deleted = 0;

    for (const pattern of patterns) {
      const fullPattern = id
        ? `cache:${pattern.replace('*', `*${id}*`)}`
        : `cache:${pattern}`;

      const keys = await this.redis.keys(fullPattern);
      if (keys.length > 0) {
        await Promise.all(keys.map((k) => this.redis.del(k)));
        deleted += keys.length;
      }
    }

    if (deleted > 0) {
      this.logger.log(`Invalidated ${deleted} cache keys for ${entity}`);
    }

    return deleted;
  }

  // ==================== Specialized Caching ====================

  /**
   * Cache لملف شخصي مستخدم
   */
  async cacheUserProfile(userId: string): Promise<any> {
    return this.getOrSet(`user_profile:${userId}`, async () => {
      return this.prisma.profile.findUnique({
        where: { userId },
        include: {
          user: {
            select: {
              email: true,
              role: true,
              createdAt: true,
            },
          },
        },
      });
    });
  }

  /**
   * Cache لمعلومات متجر
   */
  async cacheStoreInfo(storeId: string): Promise<any> {
    return this.getOrSet(`store_info:${storeId}`, async () => {
      return this.prisma.store.findUnique({
        where: { id: storeId },
        include: {
          _count: { select: { products: true } },
        },
      });
    });
  }

  /**
   * Cache لتفاصيل حدث
   */
  async cacheEventDetails(eventId: string): Promise<any> {
    return this.getOrSet(`event_details:${eventId}`, async () => {
      return this.prisma.event.findUnique({
        where: { id: eventId },
        include: {
          user: {
            select: {
              profile: { select: { name: true, avatar: true } },
            },
          },
          _count: { select: { registrations: true } },
        },
      });
    });
  }

  /**
   * Cache لقائمة الأحداث
   */
  async cacheEventList(
    filters: Record<string, any>,
    page: number = 1,
    limit: number = 20,
  ): Promise<any> {
    const filterHash = this.hashObject(filters);
    const key = `event_list:${filterHash}:${page}:${limit}`;

    return this.getOrSet(key, async () => {
      const where: any = {};

      if (filters.status) where.status = filters.status;
      if (filters.userId) where.userId = filters.userId;
      if (filters.isPublic !== undefined) where.isPublic = filters.isPublic;

      const [events, total] = await Promise.all([
        this.prisma.event.findMany({
          where,
          skip: (page - 1) * limit,
          take: limit,
          orderBy: { startDate: 'asc' },
        }),
        this.prisma.event.count({ where }),
      ]);

      return { events, total, page, totalPages: Math.ceil(total / limit) };
    });
  }

  /**
   * Cache لنتائج البحث
   */
  async cacheSearchResults(
    query: string,
    type: 'events' | 'stores' | 'products',
  ): Promise<any> {
    const key = `search_results:${type}:${this.hashString(query)}`;

    return this.getOrSet(key, async () => {
      switch (type) {
        case 'events':
          return this.prisma.event.findMany({
            where: {
              OR: [
                { title: { contains: query, mode: 'insensitive' } },
                { description: { contains: query, mode: 'insensitive' } },
              ],
              status: 'SCHEDULED',
            },
            take: 20,
          });

        case 'stores':
          return this.prisma.store.findMany({
            where: {
              OR: [
                { name: { contains: query, mode: 'insensitive' } },
                { description: { contains: query, mode: 'insensitive' } },
              ],
            },
            take: 20,
          });

        case 'products':
          return this.prisma.products.findMany({
            where: {
              OR: [
                { name: { contains: query, mode: 'insensitive' } },
                { description: { contains: query, mode: 'insensitive' } },
              ],
            },
            take: 20,
          });

        default:
          return [];
      }
    });
  }

  // ==================== Helper Methods ====================

  private buildKey(key: string): string {
    return `cache:${key}`;
  }

  private getTtlForKey(key: string): number {
    // استخراج نوع البيانات من المفتاح
    const prefix = key.split(':')[0];
    return this.TTL[prefix] || 60; // افتراضي: دقيقة
  }

  private hashString(str: string): string {
    return createHash('md5').update(str).digest('hex').substring(0, 16);
  }

  private hashObject(obj: Record<string, any>): string {
    const sorted = JSON.stringify(obj, Object.keys(obj).sort());
    return this.hashString(sorted);
  }

  // ==================== Statistics ====================

  /**
   * الحصول على إحصائيات الـ cache
   */
  async getStats(): Promise<{
    totalKeys: number;
    memoryUsage: string;
    hitRate: number;
  }> {
    const keys = await this.redis.keys('cache:*');

    return {
      totalKeys: keys.length,
      memoryUsage: 'unknown',
      hitRate: 0, // يحتاج تتبع إضافي
    };
  }

  /**
   * تنظيف الـ cache بالكامل
   */
  async flush(): Promise<number> {
    const keys = await this.redis.keys('cache:*');
    if (keys.length > 0) {
      await Promise.all(keys.map((k) => this.redis.del(k)));
    }
    this.logger.log(`Flushed ${keys.length} cache keys`);
    return keys.length;
  }
}
