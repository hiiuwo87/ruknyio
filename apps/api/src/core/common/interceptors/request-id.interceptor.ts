import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { randomUUID } from 'crypto';
import { Request, Response } from 'express';

/**
 * 🔒 Request ID Interceptor
 *
 * يضيف معرف فريد لكل طلب (Request ID) للتتبع والتصحيح
 * - يُستخدم في logs لتتبع الطلبات
 * - يُرسل في headers للـ client
 * - يساعد في debugging وcorrelation بين الخدمات
 */
@Injectable()
export class RequestIdInterceptor implements NestInterceptor {
  private readonly logger = new Logger('RequestTracker');

  // اسم الـ Header المستخدم
  private readonly REQUEST_ID_HEADER = 'X-Request-ID';

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const ctx = context.switchToHttp();
    const request = ctx.getRequest<Request>();
    const response = ctx.getResponse<Response>();

    // استخدام Request ID من الـ client إن وُجد، أو إنشاء واحد جديد
    const requestId =
      (request.headers[this.REQUEST_ID_HEADER.toLowerCase()] as string) ||
      this.generateRequestId();

    // إضافة Request ID للـ request object
    (request as any).requestId = requestId;

    // إضافة Request ID للـ response headers
    response.setHeader(this.REQUEST_ID_HEADER, requestId);

    // معلومات الطلب للتسجيل
    const { method, url, ip } = request;
    const userAgent = request.get('user-agent') || 'unknown';
    const startTime = Date.now();

    // تسجيل بداية الطلب
    this.logger.log(
      `[${requestId}] --> ${method} ${url} - IP: ${this.maskIp(ip)} - UA: ${this.truncateUA(userAgent)}`,
    );

    return next.handle().pipe(
      tap({
        next: () => {
          const duration = Date.now() - startTime;
          const statusCode = response.statusCode;
          this.logCompletion(requestId, method, url, statusCode, duration);
        },
        error: (error) => {
          const duration = Date.now() - startTime;
          const statusCode = error.status || 500;
          this.logCompletion(
            requestId,
            method,
            url,
            statusCode,
            duration,
            error.message,
          );
        },
      }),
    );
  }

  /**
   * إنشاء معرف فريد للطلب
   */
  private generateRequestId(): string {
    // صيغة: req_<timestamp>_<uuid>
    const timestamp = Date.now().toString(36);
    const uuid = randomUUID().split('-')[0]; // أول جزء من UUID
    return `req_${timestamp}_${uuid}`;
  }

  /**
   * إخفاء جزء من IP للخصوصية
   */
  private maskIp(ip: string | undefined): string {
    if (!ip) return 'unknown';

    // IPv4
    if (ip.includes('.')) {
      const parts = ip.split('.');
      if (parts.length === 4) {
        return `${parts[0]}.${parts[1]}.xxx.xxx`;
      }
    }

    // IPv6 - إخفاء النصف الأخير
    if (ip.includes(':')) {
      const parts = ip.split(':');
      if (parts.length >= 4) {
        return `${parts.slice(0, 4).join(':')}:****`;
      }
    }

    return ip.substring(0, 10) + '***';
  }

  /**
   * اختصار User Agent
   */
  private truncateUA(ua: string): string {
    if (ua.length <= 50) return ua;
    return ua.substring(0, 47) + '...';
  }

  /**
   * تسجيل انتهاء الطلب
   */
  private logCompletion(
    requestId: string,
    method: string,
    url: string,
    statusCode: number,
    duration: number,
    error?: string,
  ): void {
    const statusEmoji = statusCode < 400 ? '✅' : statusCode < 500 ? '⚠️' : '❌';
    const durationStr = duration < 1000 ? `${duration}ms` : `${(duration / 1000).toFixed(2)}s`;

    let message = `[${requestId}] <-- ${statusEmoji} ${statusCode} ${method} ${url} - ${durationStr}`;

    if (error) {
      message += ` - Error: ${error.substring(0, 100)}`;
    }

    if (duration > 3000) {
      this.logger.warn(`${message} [SLOW REQUEST]`);
    } else if (statusCode >= 500) {
      this.logger.error(message);
    } else if (statusCode >= 400) {
      this.logger.warn(message);
    } else {
      this.logger.log(message);
    }
  }
}

/**
 * Helper للحصول على Request ID من الطلب
 */
export function getRequestId(request: Request): string | undefined {
  return (request as any).requestId;
}

/**
 * Decorator للحصول على Request ID
 */
import { createParamDecorator } from '@nestjs/common';

export const RequestId = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest<Request>();
    return (request as any).requestId || 'unknown';
  },
);
