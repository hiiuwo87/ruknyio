import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
  Inject,
  Optional,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { RedisService } from '../../cache/redis.service';

/**
 * ⚡ Performance Monitoring Interceptor
 * Logs slow endpoints and tracks metrics to help identify performance bottlenecks
 */
@Injectable()
export class PerformanceInterceptor implements NestInterceptor {
  private readonly logger = new Logger('Performance');
  private readonly SLOW_REQUEST_THRESHOLD = 1000; // 1 second
  private readonly WARNING_THRESHOLD = 500; // 500ms
  private readonly METRICS_KEY = 'perf:metrics';
  private readonly SLOW_ENDPOINTS_KEY = 'perf:slow_endpoints';

  constructor(
    @Optional() @Inject(RedisService) private readonly redis?: RedisService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const { method, url, ip } = request;
    const startTime = Date.now();
    const endpoint = `${method}:${this.normalizeUrl(url)}`;

    return next.handle().pipe(
      tap({
        next: () => {
          const duration = Date.now() - startTime;

          // Track metrics asynchronously (non-blocking)
          this.trackMetrics(endpoint, duration, 'success').catch(() => {});

          // Log slow requests
          if (duration > this.SLOW_REQUEST_THRESHOLD) {
            this.logger.warn(
              `⚠️ SLOW REQUEST: ${method} ${url} - ${duration}ms (IP: ${ip})`,
            );
            this.trackSlowEndpoint(endpoint, duration).catch(() => {});
          } else if (duration > this.WARNING_THRESHOLD) {
            // In development, log warning-level requests
            if (process.env.NODE_ENV !== 'production') {
              this.logger.debug(`⏱️ ${method} ${url} - ${duration}ms`);
            }
          }
        },
        error: (error) => {
          const duration = Date.now() - startTime;
          this.trackMetrics(endpoint, duration, 'error').catch(() => {});

          // 🔕 401/403 on auth routes are expected - skip logging entirely
          const statusCode = error?.status || error?.statusCode;
          const isAuthEndpoint = url.includes('/auth/');
          const isExpectedAuthFailure =
            (statusCode === 401 || statusCode === 403) && isAuthEndpoint;

          if (isExpectedAuthFailure) {
            // Silently skip - these are expected for unauthenticated users
          } else if (statusCode === 401 || statusCode === 403) {
            this.logger.debug(
              `🔒 AUTH: ${method} ${url} - ${duration}ms - ${error.message}`,
            );
          } else {
            this.logger.error(
              `❌ ERROR REQUEST: ${method} ${url} - ${duration}ms - ${error.message}`,
            );
          }
        },
      }),
    );
  }

  /**
   * Normalize URL by removing query params and replacing UUIDs/IDs
   */
  private normalizeUrl(url: string): string {
    return url
      .split('?')[0] // Remove query params
      .replace(
        /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,
        ':id',
      ) // Replace UUIDs
      .replace(/\/\d+/g, '/:id'); // Replace numeric IDs
  }

  /**
   * Track request metrics in Redis
   */
  private async trackMetrics(
    endpoint: string,
    duration: number,
    status: 'success' | 'error',
  ): Promise<void> {
    if (!this.redis) return;

    try {
      await this.redis.hincrbyBatch([
        { hash: this.METRICS_KEY, field: `${endpoint}:count` },
        { hash: this.METRICS_KEY, field: `${endpoint}:${status}` },
        { hash: this.METRICS_KEY, field: `${endpoint}:total_ms`, by: duration },
      ]);
    } catch {
      // Ignore metrics errors
    }
  }

  /**
   * Track slow endpoints for analysis
   */
  private async trackSlowEndpoint(
    endpoint: string,
    duration: number,
  ): Promise<void> {
    if (!this.redis) return;

    try {
      await this.redis.hincrbyBatch([
        { hash: this.SLOW_ENDPOINTS_KEY, field: `${endpoint}:count` },
        {
          hash: this.SLOW_ENDPOINTS_KEY,
          field: `${endpoint}:total_ms`,
          by: duration,
        },
      ]);
      // Store last slow request time
      await this.redis.hset(
        this.SLOW_ENDPOINTS_KEY,
        `${endpoint}:last`,
        new Date().toISOString(),
      );
    } catch {
      // Ignore metrics errors
    }
  }
}
