import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma/prisma.service';
import { Cron, CronExpression } from '@nestjs/schedule';

export interface DatabaseHealthStatus {
  status: 'healthy' | 'warning' | 'critical';
  connections: {
    active: number;
    idle: number;
    total: number;
    max: number;
  };
  performance: {
    avgQueryTime: number;
    slowQueries: number;
    deadlocks: number;
  };
  storage: {
    databaseSize: string;
    tablesSize: { name: string; size: string }[];
  };
  replication?: {
    lag: number;
    status: string;
  };
  issues: string[];
  recommendations: string[];
}

/**
 * 🏥 Database Health Monitor
 *
 * مراقبة صحة قاعدة البيانات
 */
@Injectable()
export class DatabaseHealthService implements OnModuleInit {
  private readonly logger = new Logger(DatabaseHealthService.name);
  private lastHealthCheck: DatabaseHealthStatus | null = null;

  constructor(private readonly prisma: PrismaService) {}

  onModuleInit() {
    this.logger.log('🏥 Database health monitor initialized');
  }

  /**
   * فحص صحة قاعدة البيانات الشامل
   */
  async getHealthStatus(): Promise<DatabaseHealthStatus> {
    const issues: string[] = [];
    const recommendations: string[] = [];

    // فحص الاتصالات
    const connections = await this.checkConnections();
    if (connections.active > connections.max * 0.8) {
      issues.push('High connection usage');
      recommendations.push('Consider increasing max connections or using connection pooling');
    }

    // فحص الأداء
    const performance = await this.checkPerformance();
    if (performance.avgQueryTime > 100) {
      issues.push('High average query time');
      recommendations.push('Review slow queries and add appropriate indexes');
    }
    if (performance.slowQueries > 10) {
      issues.push(`${performance.slowQueries} slow queries detected`);
    }

    // فحص التخزين
    const storage = await this.checkStorage();

    // فحص الـ Replication (إن وجد)
    const replication = await this.checkReplication();

    // تحديد الحالة العامة
    let status: 'healthy' | 'warning' | 'critical' = 'healthy';
    if (issues.length > 0) status = 'warning';
    if (
      connections.active > connections.max * 0.95 ||
      performance.avgQueryTime > 500 ||
      performance.deadlocks > 0
    ) {
      status = 'critical';
    }

    this.lastHealthCheck = {
      status,
      connections,
      performance,
      storage,
      replication,
      issues,
      recommendations,
    };

    return this.lastHealthCheck;
  }

  /**
   * فحص الاتصالات
   */
  private async checkConnections(): Promise<{
    active: number;
    idle: number;
    total: number;
    max: number;
  }> {
    try {
      const result = await this.prisma.$queryRaw<any[]>`
        SELECT 
          count(*) FILTER (WHERE state = 'active') as active,
          count(*) FILTER (WHERE state = 'idle') as idle,
          count(*) as total,
          current_setting('max_connections')::int as max
        FROM pg_stat_activity
        WHERE datname = current_database()
      `;

      return {
        active: parseInt(result[0]?.active || '0'),
        idle: parseInt(result[0]?.idle || '0'),
        total: parseInt(result[0]?.total || '0'),
        max: parseInt(result[0]?.max || '100'),
      };
    } catch {
      return { active: 0, idle: 0, total: 0, max: 100 };
    }
  }

  /**
   * فحص الأداء
   */
  private async checkPerformance(): Promise<{
    avgQueryTime: number;
    slowQueries: number;
    deadlocks: number;
  }> {
    try {
      // متوسط وقت الاستعلام
      const avgTime = await this.prisma.$queryRaw<any[]>`
        SELECT 
          COALESCE(AVG(mean_exec_time), 0) as avg_time
        FROM pg_stat_statements
        WHERE calls > 0
      `;

      // الاستعلامات البطيئة
      const slowQueries = await this.prisma.$queryRaw<any[]>`
        SELECT count(*) as count
        FROM pg_stat_statements
        WHERE mean_exec_time > 1000
      `;

      // الـ Deadlocks
      const deadlocks = await this.prisma.$queryRaw<any[]>`
        SELECT deadlocks FROM pg_stat_database
        WHERE datname = current_database()
      `;

      return {
        avgQueryTime: parseFloat(avgTime[0]?.avg_time || '0'),
        slowQueries: parseInt(slowQueries[0]?.count || '0'),
        deadlocks: parseInt(deadlocks[0]?.deadlocks || '0'),
      };
    } catch {
      // pg_stat_statements قد لا يكون مفعلاً
      return { avgQueryTime: 0, slowQueries: 0, deadlocks: 0 };
    }
  }

  /**
   * فحص التخزين
   */
  private async checkStorage(): Promise<{
    databaseSize: string;
    tablesSize: { name: string; size: string }[];
  }> {
    try {
      // حجم قاعدة البيانات
      const dbSize = await this.prisma.$queryRaw<any[]>`
        SELECT pg_size_pretty(pg_database_size(current_database())) as size
      `;

      // أكبر الجداول
      const tablesSize = await this.prisma.$queryRaw<any[]>`
        SELECT 
          relname as name,
          pg_size_pretty(pg_total_relation_size(relid)) as size
        FROM pg_catalog.pg_statio_user_tables
        ORDER BY pg_total_relation_size(relid) DESC
        LIMIT 10
      `;

      return {
        databaseSize: dbSize[0]?.size || 'Unknown',
        tablesSize: tablesSize.map((t) => ({ name: t.name, size: t.size })),
      };
    } catch {
      return { databaseSize: 'Unknown', tablesSize: [] };
    }
  }

  /**
   * فحص الـ Replication
   */
  private async checkReplication(): Promise<{
    lag: number;
    status: string;
  } | undefined> {
    try {
      const result = await this.prisma.$queryRaw<any[]>`
        SELECT 
          EXTRACT(EPOCH FROM (now() - pg_last_xact_replay_timestamp())) as lag_seconds,
          CASE 
            WHEN pg_is_in_recovery() THEN 'replica'
            ELSE 'primary'
          END as status
      `;

      if (result[0]?.status === 'replica') {
        return {
          lag: parseFloat(result[0]?.lag_seconds || '0'),
          status: result[0]?.status,
        };
      }

      return undefined;
    } catch {
      return undefined;
    }
  }

  /**
   * تحسين الجداول
   */
  async optimizeTables(): Promise<{ optimized: string[] }> {
    const tables = await this.prisma.$queryRaw<any[]>`
      SELECT tablename FROM pg_tables WHERE schemaname = 'public'
    `;

    const optimized: string[] = [];

    for (const table of tables) {
      try {
        await this.prisma.$executeRawUnsafe(`VACUUM ANALYZE "${table.tablename}"`);
        optimized.push(table.tablename);
      } catch (error) {
        this.logger.warn(`Failed to optimize ${table.tablename}: ${error.message}`);
      }
    }

    this.logger.log(`Optimized ${optimized.length} tables`);
    return { optimized };
  }

  /**
   * الحصول على الاستعلامات الطويلة الجارية
   */
  async getLongRunningQueries(thresholdSeconds: number = 30): Promise<any[]> {
    try {
      return await this.prisma.$queryRaw`
        SELECT 
          pid,
          now() - pg_stat_activity.query_start AS duration,
          query,
          state
        FROM pg_stat_activity
        WHERE (now() - pg_stat_activity.query_start) > interval '${thresholdSeconds} seconds'
          AND state != 'idle'
        ORDER BY duration DESC
      `;
    } catch {
      return [];
    }
  }

  /**
   * إنهاء استعلام طويل
   */
  async terminateQuery(pid: number): Promise<boolean> {
    try {
      const result = await this.prisma.$queryRaw<any[]>`
        SELECT pg_terminate_backend(${pid})
      `;
      return result[0]?.pg_terminate_backend === true;
    } catch {
      return false;
    }
  }

  /**
   * فحص دوري للصحة
   */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async scheduledHealthCheck(): Promise<void> {
    try {
      const health = await this.getHealthStatus();
      
      if (health.status === 'critical') {
        this.logger.error(`🚨 Database health critical: ${health.issues.join(', ')}`);
        // يمكن إضافة تنبيه هنا
      } else if (health.status === 'warning') {
        this.logger.warn(`⚠️ Database health warning: ${health.issues.join(', ')}`);
      }
    } catch (error) {
      this.logger.error(`Health check failed: ${error.message}`);
    }
  }

  /**
   * الحصول على آخر فحص
   */
  getLastHealthCheck(): DatabaseHealthStatus | null {
    return this.lastHealthCheck;
  }
}
