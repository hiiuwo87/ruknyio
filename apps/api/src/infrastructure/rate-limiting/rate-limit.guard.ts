import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RateLimitingService, RateLimitConfig } from './rate-limiting.service';
import * as crypto from 'crypto';

export const RATE_LIMIT_KEY = 'rate_limit';
export const SKIP_RATE_LIMIT_KEY = 'skip_rate_limit';

/**
 * Decorator لتعيين حد معين لنقطة نهائية
 */
export const RateLimit = (config: RateLimitConfig) =>
  SetMetadata(RATE_LIMIT_KEY, config);

/**
 * Decorator لتخطي Rate Limiting
 */
export const SkipRateLimit = () => SetMetadata(SKIP_RATE_LIMIT_KEY, true);

/**
 * 🛡️ Rate Limit Guard
 *
 * حارس لتطبيق تحديد معدل الطلبات
 */
@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(
    private readonly rateLimitingService: RateLimitingService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // التحقق من تخطي Rate Limiting
    const skipRateLimit = this.reflector.getAllAndOverride<boolean>(
      SKIP_RATE_LIMIT_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (skipRateLimit) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();

    // الحصول على المعرفات
    const ip = this.getClientIp(request);
    const userId = request.user?.id || null;
    const endpoint = `${request.method}:${request.route?.path || request.url}`;
    const tier = request.user?.subscriptionTier || 'free';

    // التحقق من القائمة البيضاء
    const ipHash = this.hashIp(ip);
    if (await this.rateLimitingService.isWhitelisted(`ip:${ipHash}`)) {
      return true;
    }
    if (userId && await this.rateLimitingService.isWhitelisted(`user:${userId}`)) {
      return true;
    }

    // الحصول على الحد المخصص إن وجد
    const customConfig = this.reflector.getAllAndOverride<RateLimitConfig>(
      RATE_LIMIT_KEY,
      [context.getHandler(), context.getClass()],
    );

    let result;

    if (customConfig) {
      // استخدام الحد المخصص
      const identifier = userId ? `user:${userId}` : `ip:${ipHash}`;
      result = await this.rateLimitingService.checkRateLimit(identifier, {
        ...customConfig,
        endpoint,
      });
    } else {
      // استخدام الفحص المجمع
      result = await this.rateLimitingService.checkCombinedRateLimit(
        ipHash,
        userId,
        endpoint,
        tier,
      );
    }

    // إضافة headers
    response.setHeader('X-RateLimit-Limit', result.limit);
    response.setHeader('X-RateLimit-Remaining', result.remaining);
    response.setHeader('X-RateLimit-Reset', result.resetAt);

    if (!result.allowed) {
      response.setHeader('Retry-After', result.retryAfter || 60);

      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: 'تم تجاوز الحد الأقصى للطلبات. يرجى المحاولة لاحقاً.',
          error: 'Too Many Requests',
          retryAfter: result.retryAfter,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    return true;
  }

  private getClientIp(request: any): string {
    const forwarded = request.headers['x-forwarded-for'];
    if (forwarded) {
      return forwarded.split(',')[0].trim();
    }
    return request.ip || request.connection?.remoteAddress || 'unknown';
  }

  private hashIp(ip: string): string {
    const salt = process.env.IP_HASH_SALT || 'rukny-salt';
    return crypto.createHash('sha256').update(`${ip}:${salt}`).digest('hex').substring(0, 16);
  }
}
