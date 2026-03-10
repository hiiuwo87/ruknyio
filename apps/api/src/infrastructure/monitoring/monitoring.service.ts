import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma/prisma.service';
import { RedisService } from '../../core/cache/redis.service';

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  uptime: number;
  services: {
    database: ServiceHealth;
    redis: ServiceHealth;
    s3: ServiceHealth;
  };
  memory: {
    used: number;
    total: number;
    percentage: number;
  };
}

export interface ServiceHealth {
  status: 'up' | 'down' | 'degraded';
  latency?: number;
  message?: string;
}

/**
 * 📊 Monitoring Service
 *
 * خدمة مراقبة صحة التطبيق
 */
@Injectable()
export class MonitoringService implements OnModuleInit {
  private readonly logger = new Logger(MonitoringService.name);
  private startTime: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  onModuleInit() {
    this.startTime = Date.now();
    this.logger.log('📊 Monitoring service initialized');
  }

  /**
   * الحصول على حالة الصحة الكاملة
   */
  async getHealthStatus(): Promise<HealthStatus> {
    const [database, redis, s3] = await Promise.all([
      this.checkDatabase(),
      this.checkRedis(),
      this.checkS3(),
    ]);

    const memory = this.getMemoryUsage();

    // تحديد الحالة العامة
    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

    if (
      database.status === 'down' ||
      redis.status === 'down' ||
      s3.status === 'down'
    ) {
      status = 'unhealthy';
    } else if (
      database.status === 'degraded' ||
      redis.status === 'degraded' ||
      s3.status === 'degraded' ||
      memory.percentage > 90
    ) {
      status = 'degraded';
    }

    return {
      status,
      timestamp: new Date().toISOString(),
      uptime: Math.floor((Date.now() - this.startTime) / 1000),
      services: { database, redis, s3 },
      memory,
    };
  }

  /**
   * فحص سريع (للـ load balancer)
   */
  async quickCheck(): Promise<{ status: 'ok' | 'error' }> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { status: 'ok' };
    } catch {
      return { status: 'error' };
    }
  }

  /**
   * فحص قاعدة البيانات
   */
  private async checkDatabase(): Promise<ServiceHealth> {
    try {
      const start = Date.now();
      await this.prisma.$queryRaw`SELECT 1`;
      const latency = Date.now() - start;

      if (latency > 1000) {
        return {
          status: 'degraded',
          latency,
          message: 'High latency detected',
        };
      }

      return { status: 'up', latency };
    } catch (error) {
      return {
        status: 'down',
        message: error.message,
      };
    }
  }

  /**
   * فحص Redis
   */
  private async checkRedis(): Promise<ServiceHealth> {
    try {
      const start = Date.now();
      await this.redis.ping();
      const latency = Date.now() - start;

      if (latency > 100) {
        return {
          status: 'degraded',
          latency,
          message: 'High latency detected',
        };
      }

      return { status: 'up', latency };
    } catch (error) {
      return {
        status: 'down',
        message: error.message,
      };
    }
  }

  /**
   * فحص S3
   */
  private async checkS3(): Promise<ServiceHealth> {
    try {
      // فحص بسيط - التحقق من وجود bucket
      const bucket = process.env.S3_BUCKET;
      if (!bucket) {
        return { status: 'down', message: 'S3_BUCKET not configured' };
      }

      return { status: 'up' };
    } catch (error) {
      return {
        status: 'down',
        message: error.message,
      };
    }
  }

  /**
   * الحصول على استخدام الذاكرة
   */
  private getMemoryUsage(): {
    used: number;
    total: number;
    percentage: number;
  } {
    const used = process.memoryUsage();
    const heapUsed = Math.round(used.heapUsed / 1024 / 1024);
    const heapTotal = Math.round(used.heapTotal / 1024 / 1024);

    return {
      used: heapUsed,
      total: heapTotal,
      percentage: Math.round((heapUsed / heapTotal) * 100),
    };
  }

  /**
   * الحصول على إحصائيات قاعدة البيانات
   */
  async getDatabaseStats(): Promise<{
    connections: number;
    activeQueries: number;
    tableStats: any[];
  }> {
    try {
      // عدد الاتصالات (PostgreSQL)
      const connections = await this.prisma.$queryRaw<any[]>`
        SELECT count(*) as count FROM pg_stat_activity 
        WHERE datname = current_database()
      `;

      // استعلامات نشطة
      const activeQueries = await this.prisma.$queryRaw<any[]>`
        SELECT count(*) as count FROM pg_stat_activity 
        WHERE datname = current_database() AND state = 'active'
      `;

      // إحصائيات الجداول
      const tableStats = await this.prisma.$queryRaw<any[]>`
        SELECT 
          relname as table_name,
          n_tup_ins as inserts,
          n_tup_upd as updates,
          n_tup_del as deletes,
          seq_scan as sequential_scans,
          idx_scan as index_scans
        FROM pg_stat_user_tables
        ORDER BY n_tup_ins + n_tup_upd + n_tup_del DESC
        LIMIT 10
      `;

      return {
        connections: parseInt(connections[0]?.count || '0'),
        activeQueries: parseInt(activeQueries[0]?.count || '0'),
        tableStats,
      };
    } catch (error) {
      this.logger.warn(`Failed to get database stats: ${error.message}`);
      return { connections: 0, activeQueries: 0, tableStats: [] };
    }
  }

  /**
   * الحصول على الاستعلامات البطيئة
   */
  async getSlowQueries(minDuration: number = 1000): Promise<any[]> {
    try {
      return await this.prisma.$queryRaw`
        SELECT 
          query,
          calls,
          total_exec_time,
          mean_exec_time,
          rows
        FROM pg_stat_statements
        WHERE mean_exec_time > ${minDuration}
        ORDER BY mean_exec_time DESC
        LIMIT 10
      `;
    } catch {
      // pg_stat_statements قد لا يكون مفعلاً
      return [];
    }
  }
}
