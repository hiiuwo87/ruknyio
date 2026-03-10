import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  ForbiddenException,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { Request } from 'express';

/**
 * 🔒 CSRF Protection Interceptor
 *
 * يتحقق من CSRF token في جميع POST/PUT/PATCH/DELETE requests
 *
 * يستخدم header X-XSRF-TOKEN أو X-CSRF-TOKEN
 * ويتحقق من تطابقه مع cookie XSRF-TOKEN
 */
@Injectable()
export class CsrfInterceptor implements NestInterceptor {
  private readonly isDevelopment = process.env.NODE_ENV !== 'production';

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest<Request>();
    const method = request.method.toUpperCase();

    // GET, HEAD, OPTIONS لا تحتاج CSRF protection
    if (['GET', 'HEAD', 'OPTIONS'].includes(method)) {
      return next.handle();
    }

    // التحقق من CSRF token
    const isValid = this.validateCsrfToken(request);

    if (!isValid) {
      throw new ForbiddenException(
        this.isDevelopment
          ? 'CSRF token validation failed'
          : 'Request validation failed',
      );
    }

    return next.handle();
  }

  /**
   * 🔒 التحقق من CSRF token
   */
  private validateCsrfToken(req: Request): boolean {
    // الحصول على token من header
    const tokenFromHeader =
      req.headers['x-xsrf-token'] ||
      req.headers['x-csrf-token'] ||
      (req.body?._csrf as string);

    // الحصول على token من cookie
    const tokenFromCookie = req.cookies?.['XSRF-TOKEN'];

    // يجب أن يكونا متطابقين
    if (!tokenFromHeader || !tokenFromCookie) {
      return false;
    }

    // 🔒 التحقق من التطابق (بسيط - في الإنتاج يجب استخدام signed cookies)
    // هنا نتحقق من أن القيم متطابقة
    // ملاحظة: في الإنتاج الكامل، يجب استخدام csurf library للتحقق الآمن
    return tokenFromHeader === tokenFromCookie;
  }
}
