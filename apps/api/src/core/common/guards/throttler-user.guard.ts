import { Injectable, ExecutionContext } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { Request } from 'express';

/**
 * 🔒 User-based Throttler Guard
 *
 * يقوم بـ Rate Limiting بناءً على user ID للـ authenticated users
 * وباستخدام IP address للـ anonymous users
 *
 * الاستخدام:
 * ```typescript
 * // استبدال ThrottlerGuard بـ ThrottlerUserGuard في app.module.ts
 * {
 *   provide: APP_GUARD,
 *   useClass: ThrottlerUserGuard,
 * }
 * ```
 */
@Injectable()
export class ThrottlerUserGuard extends ThrottlerGuard {
  /**
   * 🔒 توليد مفتاح فريد للـ rate limiting
   * - للـ authenticated users: user ID
   * - للـ anonymous users: IP address
   */
  protected async getTracker(req: Record<string, any>): Promise<string> {
    // إذا كان المستخدم مسجلاً، استخدم user ID
    const user = (req as any).user;
    if (user?.id) {
      return `user:${user.id}`;
    }

    // إذا لم يكن مسجلاً، استخدم IP address
    const ip = req.ip || req.socket?.remoteAddress || 'unknown';
    return `ip:${ip}`;
  }
}
