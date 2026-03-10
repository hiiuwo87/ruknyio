import {
  Controller,
  Get,
  Header,
  Headers,
  ForbiddenException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiHeader } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { PrismaService } from '../database/prisma/prisma.service';
import { RedisService } from '../cache/redis.service';
import { CacheManager } from '../cache/cache.manager';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly cacheManager: CacheManager,
  ) {}

  /**
   * ⚡ Verify health secret for protected endpoints
   */
  private verifyHealthSecret(providedSecret: string | undefined): void {
    const expectedSecret = process.env.HEALTH_SECRET;
    
    // If no secret configured, allow in development only
    if (!expectedSecret) {
      if (process.env.NODE_ENV === 'production') {
        throw new ForbiddenException('Health secret not configured');
      }
      return; // Allow in development without secret
    }

    if (providedSecret !== expectedSecret) {
      throw new ForbiddenException('Invalid health secret');
    }
  }

  @Get()
  @ApiOperation({
    summary: 'Health check endpoint',
    description: 'Returns the API health status and uptime information',
  })
  @ApiResponse({
    status: 200,
    description: 'API is healthy',
    schema: {
      example: {
        status: 'ok',
        timestamp: '2025-10-24T10:00:00.000Z',
        uptime: 86400,
        environment: 'development',
      },
    },
  })
  check() {
    const isProd = process.env.NODE_ENV === 'production';
    const base = { status: 'ok' } as any;
    if (!isProd) {
      base.timestamp = new Date().toISOString();
      base.uptime = process.uptime();
      base.environment = process.env.NODE_ENV || 'development';
    }
    return base;
  }

  /**
   * ⚡ Readiness check (for Kubernetes)
   * Returns true only when the service is ready to accept traffic
   */
  @Get('ready')
  @ApiOperation({
    summary: 'Readiness check',
    description: 'Returns readiness status for load balancers/K8s',
  })
  async readinessCheck() {
    const dbHealth = await this.prisma.getHealthStatus();
    const redisStatus = this.redis.getConnectionStatus();

    const ready = dbHealth.connected && redisStatus.connected;

    return {
      ready,
      checks: {
        database: dbHealth.connected,
        redis: redisStatus.connected,
      },
    };
  }

  /**
   * ⚡ Detailed health check with database and cache status
   * 🔒 Protected: Requires X-Health-Secret header in production
   */
  @Get('detailed')
  @Throttle({ default: { limit: 10, ttl: 60000 } }) // 10 requests per minute
  @ApiOperation({
    summary: 'Detailed health check (protected)',
    description: 'Returns detailed health status including database and cache. Requires X-Health-Secret header in production.',
  })
  @ApiHeader({
    name: 'X-Health-Secret',
    description: 'Secret key for accessing detailed health info',
    required: false,
  })
  @ApiResponse({
    status: 200,
    description: 'Detailed health status',
    schema: {
      example: {
        status: 'ok',
        timestamp: '2025-10-24T10:00:00.000Z',
        uptime: 86400,
        services: {
          database: { connected: true, responseTime: 5 },
          redis: { connected: true, ready: true },
          cache: { hits: 1000, misses: 100, hitRate: 90.9 },
        },
        memory: { used: 100, total: 512 },
      },
    },
  })
  @ApiResponse({ status: 403, description: 'Invalid or missing health secret' })
  async detailedCheck(
    @Headers('x-health-secret') healthSecret?: string,
  ) {
    // Verify secret in production
    this.verifyHealthSecret(healthSecret);
    const isProd = process.env.NODE_ENV === 'production';

    // Get service statuses in parallel
    const [dbHealth, redisStatus, cacheMetrics] = await Promise.all([
      this.prisma.getHealthStatus(),
      this.redis.getConnectionStatus(),
      this.cacheManager.getMetrics(),
    ]);

    // Memory usage
    const memoryUsage = process.memoryUsage();

    const result: any = {
      status: dbHealth.connected && redisStatus.connected ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      uptime: Math.floor(process.uptime()),
      services: {
        database: {
          connected: dbHealth.connected,
          responseTime: dbHealth.responseTime,
          ...(isProd ? {} : { queryCount: dbHealth.queryCount, slowQueries: dbHealth.slowQueryCount }),
        },
        redis: {
          connected: redisStatus.connected,
          ready: redisStatus.ready,
        },
        cache: {
          hits: cacheMetrics.hits,
          misses: cacheMetrics.misses,
          hitRate: cacheMetrics.hitRate,
        },
      },
    };

    // Add memory info in non-production
    if (!isProd) {
      result.memory = {
        heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024),
        heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024),
        rss: Math.round(memoryUsage.rss / 1024 / 1024),
        external: Math.round(memoryUsage.external / 1024 / 1024),
      };
      result.environment = process.env.NODE_ENV || 'development';
    }

    return result;
  }

  /**
   * ⚡ Database-only health check (for load balancers)
   */
  @Get('db')
  @ApiOperation({
    summary: 'Database health check',
    description: 'Quick database connectivity check',
  })
  async dbCheck() {
    const health = await this.prisma.getHealthStatus();
    return {
      status: health.connected ? 'ok' : 'error',
      responseTime: health.responseTime,
    };
  }

  /**
   * ⚡ Redis/Cache health check
   */
  @Get('cache')
  @ApiOperation({
    summary: 'Cache health check',
    description: 'Redis and cache status check',
  })
  async cacheCheck() {
    const [redisStatus, cacheMetrics] = await Promise.all([
      this.redis.getConnectionStatus(),
      this.cacheManager.getMetrics(),
    ]);

    return {
      status: redisStatus.connected ? 'ok' : 'error',
      redis: redisStatus,
      cache: cacheMetrics,
    };
  }

  /**
   * ⚡ Prometheus metrics endpoint
   * 🔒 Protected: Requires X-Health-Secret header in production
   * Returns metrics in OpenMetrics/Prometheus format
   */
  @Get('metrics')
  @Header('Content-Type', 'text/plain; charset=utf-8')
  @Throttle({ default: { limit: 30, ttl: 60000 } }) // 30 requests per minute
  @ApiOperation({
    summary: 'Prometheus metrics (protected)',
    description: 'Returns metrics in Prometheus format for monitoring systems',
  })
  @ApiHeader({
    name: 'X-Health-Secret',
    description: 'Secret key for accessing metrics',
    required: false,
  })
  async getMetrics(
    @Headers('x-health-secret') healthSecret?: string,
  ): Promise<string> {
    // Verify secret in production
    this.verifyHealthSecret(healthSecret);

    const [dbHealth, redisStatus, cacheMetrics] = await Promise.all([
      this.prisma.getHealthStatus(),
      this.redis.getConnectionStatus(),
      this.cacheManager.getMetrics(),
    ]);

    const memoryUsage = process.memoryUsage();
    const uptime = Math.floor(process.uptime());

    return `# HELP rukny_up API is up and running
# TYPE rukny_up gauge
rukny_up 1

# HELP rukny_uptime_seconds API uptime in seconds
# TYPE rukny_uptime_seconds gauge
rukny_uptime_seconds ${uptime}

# HELP rukny_db_connected Database connection status
# TYPE rukny_db_connected gauge
rukny_db_connected ${dbHealth.connected ? 1 : 0}

# HELP rukny_db_response_time_ms Database response time in milliseconds
# TYPE rukny_db_response_time_ms gauge
rukny_db_response_time_ms ${dbHealth.responseTime}

# HELP rukny_db_query_count_total Total queries executed since startup
# TYPE rukny_db_query_count_total counter
rukny_db_query_count_total ${dbHealth.queryCount}

# HELP rukny_db_slow_query_count_total Slow queries count since startup
# TYPE rukny_db_slow_query_count_total counter
rukny_db_slow_query_count_total ${dbHealth.slowQueryCount}

# HELP rukny_redis_connected Redis connection status
# TYPE rukny_redis_connected gauge
rukny_redis_connected ${redisStatus.connected ? 1 : 0}

# HELP rukny_redis_ready Redis ready status
# TYPE rukny_redis_ready gauge
rukny_redis_ready ${redisStatus.ready ? 1 : 0}

# HELP rukny_cache_hits_total Total cache hits
# TYPE rukny_cache_hits_total counter
rukny_cache_hits_total ${cacheMetrics.hits}

# HELP rukny_cache_misses_total Total cache misses
# TYPE rukny_cache_misses_total counter
rukny_cache_misses_total ${cacheMetrics.misses}

# HELP rukny_cache_hit_rate Cache hit rate percentage
# TYPE rukny_cache_hit_rate gauge
rukny_cache_hit_rate ${cacheMetrics.hitRate}

# HELP rukny_memory_heap_used_bytes Heap memory used
# TYPE rukny_memory_heap_used_bytes gauge
rukny_memory_heap_used_bytes ${memoryUsage.heapUsed}

# HELP rukny_memory_heap_total_bytes Total heap memory
# TYPE rukny_memory_heap_total_bytes gauge
rukny_memory_heap_total_bytes ${memoryUsage.heapTotal}

# HELP rukny_memory_rss_bytes Resident set size
# TYPE rukny_memory_rss_bytes gauge
rukny_memory_rss_bytes ${memoryUsage.rss}

# HELP rukny_memory_external_bytes External memory
# TYPE rukny_memory_external_bytes gauge
rukny_memory_external_bytes ${memoryUsage.external}
`;
  }
}
