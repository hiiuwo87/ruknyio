import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma/prisma.service';
import { RedisService } from '../../core/cache/redis.service';
import { CacheManager } from '../../core/cache/cache.manager';

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);
  private readonly startTime = Date.now();

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly cache: CacheManager,
  ) {}

  async getStats() {
    return this.cache.wrap('admin:platform-stats', 120, async () => {
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const weekStart = new Date(todayStart);
      weekStart.setDate(weekStart.getDate() - weekStart.getDay());
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

      const rows = await this.prisma.$queryRawUnsafe<any[]>(`
        SELECT
          (SELECT COUNT(*)::int FROM users) AS total_users,
          (SELECT COUNT(*)::int FROM users WHERE "createdAt" >= $1) AS new_today,
          (SELECT COUNT(*)::int FROM users WHERE "createdAt" >= $2) AS new_this_week,
          (SELECT COUNT(*)::int FROM users WHERE "createdAt" >= $3) AS new_this_month,
          (SELECT COUNT(*)::int FROM stores) AS total_stores,
          (SELECT COUNT(*)::int FROM stores WHERE status = 'ACTIVE') AS active_stores,
          (SELECT COUNT(*)::int FROM forms) AS total_forms,
          (SELECT COUNT(*)::int FROM forms WHERE status = 'PUBLISHED') AS active_forms,
          (SELECT COUNT(*)::int FROM events) AS total_events,
          (SELECT COUNT(*)::int FROM events WHERE status IN ('SCHEDULED', 'ONGOING')) AS active_events,
          (SELECT COUNT(*)::int FROM orders) AS total_orders
      `, todayStart, weekStart, monthStart);

      const r = rows[0];
      return {
        users: { total: r.total_users, newToday: r.new_today, newThisWeek: r.new_this_week, newThisMonth: r.new_this_month },
        stores: { total: r.total_stores, active: r.active_stores },
        forms: { total: r.total_forms, active: r.active_forms },
        events: { total: r.total_events, active: r.active_events },
        orders: { total: r.total_orders },
      };
    });
  }

  async getRecentActivity(limit = 10) {
    const [recentUsers, recentStores, recentForms, recentEvents] =
      await Promise.all([
        this.prisma.user.findMany({
          take: limit,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            email: true,
            createdAt: true,
            profile: { select: { name: true, avatar: true } },
          },
        }),
        this.prisma.store.findMany({
          take: limit,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            name: true,
            createdAt: true,
            user: {
              select: { profile: { select: { name: true, avatar: true } } },
            },
          },
        }),
        this.prisma.form.findMany({
          take: limit,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            title: true,
            createdAt: true,
            user: {
              select: { profile: { select: { name: true, avatar: true } } },
            },
          },
        }),
        this.prisma.event.findMany({
          take: limit,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            title: true,
            createdAt: true,
            user: {
              select: { profile: { select: { name: true, avatar: true } } },
            },
          },
        }),
      ]);

    const activities = [
      ...recentUsers.map((u) => ({
        id: u.id,
        type: 'user_signup' as const,
        title: u.profile?.name || u.email,
        subtitle: 'مستخدم جديد',
        avatar: u.profile?.avatar || undefined,
        createdAt: u.createdAt.toISOString(),
      })),
      ...recentStores.map((s) => ({
        id: s.id,
        type: 'store_created' as const,
        title: s.name,
        subtitle: s.user?.profile?.name || 'متجر جديد',
        avatar: s.user?.profile?.avatar || undefined,
        createdAt: s.createdAt.toISOString(),
      })),
      ...recentForms.map((f) => ({
        id: f.id,
        type: 'form_created' as const,
        title: f.title,
        subtitle: f.user?.profile?.name || 'نموذج جديد',
        avatar: f.user?.profile?.avatar || undefined,
        createdAt: f.createdAt.toISOString(),
      })),
      ...recentEvents.map((e) => ({
        id: e.id,
        type: 'event_created' as const,
        title: e.title,
        subtitle: e.user?.profile?.name || 'فعالية جديدة',
        avatar: e.user?.profile?.avatar || undefined,
        createdAt: e.createdAt.toISOString(),
      })),
    ];

    activities.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );

    return activities.slice(0, limit);
  }

  async getHealth() {
    const uptime = Date.now() - this.startTime;

    // Check database
    let dbStatus = 'healthy';
    let dbResponseTime = 0;
    try {
      const dbStart = Date.now();
      await this.prisma.$queryRawUnsafe('SELECT 1');
      dbResponseTime = Date.now() - dbStart;
    } catch {
      dbStatus = 'unhealthy';
    }

    // Check Redis
    let redisStatus = 'healthy';
    let redisResponseTime = 0;
    try {
      const redisStart = Date.now();
      const pong = await this.redis.ping();
      redisResponseTime = Date.now() - redisStart;
      if (!pong) redisStatus = 'unhealthy';
    } catch {
      redisStatus = 'unhealthy';
    }

    // Memory
    const mem = process.memoryUsage();

    // Overall status
    const allHealthy = dbStatus === 'healthy' && redisStatus === 'healthy';
    const allUnhealthy = dbStatus === 'unhealthy' && redisStatus === 'unhealthy';

    const status = allHealthy
      ? 'healthy'
      : allUnhealthy
        ? 'unhealthy'
        : 'degraded';

    return {
      status,
      uptime,
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
      services: {
        database: { status: dbStatus, responseTime: dbResponseTime },
        redis: { status: redisStatus, responseTime: redisResponseTime },
      },
      memory: {
        used: mem.heapUsed,
        total: mem.heapTotal,
        rss: mem.rss,
      },
      latency: Math.max(dbResponseTime, redisResponseTime),
    };
  }
}
