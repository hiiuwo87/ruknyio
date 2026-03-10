import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { MetricsService } from './metrics.service';

/**
 * 📊 Metrics Interceptor
 *
 * تسجيل مقاييس الأداء لجميع الطلبات
 */
@Injectable()
export class MetricsInterceptor implements NestInterceptor {
  private readonly logger = new Logger(MetricsInterceptor.name);

  constructor(private readonly metricsService: MetricsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();
    const startTime = Date.now();

    const method = request.method;
    const path = request.route?.path || request.url;

    // زيادة عداد الطلبات النشطة
    this.metricsService.setGauge(
      'http_requests_active',
      this.metricsService.getGauge('http_requests_active') + 1,
    );

    return next.handle().pipe(
      tap(() => {
        const duration = Date.now() - startTime;
        const statusCode = response.statusCode;

        // تسجيل الطلب
        this.metricsService.recordHttpRequest(method, path, statusCode, duration);

        // تقليل عداد الطلبات النشطة
        this.metricsService.setGauge(
          'http_requests_active',
          Math.max(0, this.metricsService.getGauge('http_requests_active') - 1),
        );

        // تسجيل الطلبات البطيئة
        if (duration > 1000) {
          this.logger.warn(`Slow request: ${method} ${path} - ${duration}ms`);
          this.metricsService.incrementCounter('slow_requests_total', 1, {
            method,
            path,
          });
        }
      }),
      catchError((error) => {
        const duration = Date.now() - startTime;
        const statusCode = error.status || 500;

        // تسجيل الخطأ
        this.metricsService.recordHttpRequest(method, path, statusCode, duration);
        this.metricsService.recordError(error.name || 'UnknownError');

        // تقليل عداد الطلبات النشطة
        this.metricsService.setGauge(
          'http_requests_active',
          Math.max(0, this.metricsService.getGauge('http_requests_active') - 1),
        );

        throw error;
      }),
    );
  }
}
