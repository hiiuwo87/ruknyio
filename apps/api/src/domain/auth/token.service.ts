import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../core/database/prisma/prisma.service';
import * as crypto from 'crypto';
import { UAParser } from 'ua-parser-js';
import { updateSessionActivityThrottled } from './utils/session-activity.util';

const isProduction = process.env.NODE_ENV === 'production';

/**
 * 🔒 Token Service
 *
 * خدمة إدارة التوكنز الآمنة مع دعم:
 * - Access Token (قصير المدة) - يحتوي على sessionId (sid)
 * - Refresh Token (طويل المدة) - hash مخزن في DB
 * - Token Rotation (تدوير عند التجديد)
 * - Session Management (إدارة الجلسات)
 *
 * ⚠️ ملاحظة مهمة:
 * - لا نخزن Access Token hash (JWT Stateless)
 * - نستخدم sessionId (sid) في JWT للربط بالجلسة
 * - الـ Revocation يتم عبر isRevoked في Session
 */

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export interface TokenPayload {
  sub: string; // User ID
  sid: string; // Session ID (للربط بالجلسة)
  email: string;
  type: 'access' | 'refresh';
}

export interface SessionInfo {
  userId: string;
  userAgent?: string;
  ipAddress?: string;
}

@Injectable()
export class TokenService {
  // 🔒 إعدادات الأمان
  private readonly ACCESS_TOKEN_EXPIRY = '30m'; // 30 دقيقة
  private readonly REFRESH_TOKEN_EXPIRY_DAYS = 14; // 14 يوم - ✅ موحد مع AuthService
  private readonly MAX_ROTATION_COUNT = 100; // الحد الأقصى للتدوير قبل إجبار إعادة تسجيل الدخول
  private readonly GRACE_PERIOD_MS = 30000; // 30 ثانية سماح لاستخدام token قديم (race condition)
  /** تقييد عدد الجلسات النشطة لكل مستخدم (أمان بدون تعقيد كبير) */
  private readonly MAX_ACTIVE_SESSIONS =
    this.configService.get<number>('MAX_ACTIVE_SESSIONS') ?? 5;

  constructor(
    private jwtService: JwtService,
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {}

  /**
   * 🔒 تشفير التوكن باستخدام SHA-256
   */
  hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  /**
   * 🔒 إنشاء Refresh Token آمن
   */
  generateSecureRefreshToken(): string {
    return crypto.randomBytes(64).toString('hex');
  }

  /**
   * 🔒 تقييد عدد الجلسات النشطة: إبطال أقدم الجلسات إذا تجاوز العدد المسموح
   */
  private async enforceMaxActiveSessions(userId: string): Promise<void> {
    const now = new Date();
    const active = await this.prisma.session.findMany({
      where: {
        userId,
        isRevoked: false,
        OR: [
          { refreshExpiresAt: null },
          { refreshExpiresAt: { gt: now } },
        ],
      },
      orderBy: { lastActivity: 'asc' },
      select: { id: true },
    });
    const toRevoke = active.length - this.MAX_ACTIVE_SESSIONS + 1;
    if (toRevoke <= 0) return;
    const ids = active.slice(0, toRevoke).map((s) => s.id);
    await this.prisma.session.updateMany({
      where: { id: { in: ids } },
      data: {
        isRevoked: true,
        revokedAt: now,
        revokedReason: 'تجاوز الحد الأقصى للجلسات النشطة',
      },
    });
  }

  /**
   * 🔒 إنشاء زوج من التوكنز (Access + Refresh)
   *
   * Access Token يحتوي على:
   * - sub: userId
   * - sid: sessionId (للتحقق من الجلسة)
   * - email
   * - type: 'access'
   */
  async generateTokenPair(
    userId: string,
    email: string,
    sessionInfo?: SessionInfo,
  ): Promise<{ tokens: TokenPair; sessionId: string }> {
    await this.enforceMaxActiveSessions(userId);

    // إنشاء Session ID
    const sessionId = crypto.randomUUID();

    // 1. إنشاء Access Token مع sessionId (sid)
    const accessPayload: TokenPayload = {
      sub: userId,
      sid: sessionId, // 🔒 Session ID للتحقق من الجلسة
      email,
      type: 'access',
    };
    const accessToken = this.jwtService.sign(accessPayload, {
      expiresIn: this.ACCESS_TOKEN_EXPIRY,
    });

    // 2. إنشاء Refresh Token (عشوائي وآمن)
    const refreshToken = this.generateSecureRefreshToken();

    // 3. حساب أوقات الانتهاء
    const sessionExpiresAt = new Date();
    sessionExpiresAt.setMinutes(sessionExpiresAt.getMinutes() + 30); // ✅ مطابق لـ ACCESS_TOKEN_EXPIRY

    const refreshExpiresAt = new Date();
    refreshExpiresAt.setDate(refreshExpiresAt.getDate() + this.REFRESH_TOKEN_EXPIRY_DAYS);

    // 4. تحليل معلومات الجهاز
    const parser = new UAParser(sessionInfo?.userAgent);
    const deviceInfo = parser.getResult();

    // 5. حفظ الجلسة في قاعدة البيانات
    // ⚠️ لا نخزن Access Token - نستخدم sessionId في JWT
    await this.prisma.session.create({
      data: {
        id: sessionId,
        user: { connect: { id: userId } }, // استخدام العلاقة بدلاً من userId مباشرة
        // 🔒 فقط Refresh Token Hash - لا Access Token
        refreshTokenHash: this.hashToken(refreshToken),
        expiresAt: sessionExpiresAt,
        refreshExpiresAt,
        deviceName: deviceInfo.device.model || 'Unknown Device',
        deviceType: deviceInfo.device.type || 'desktop',
        browser: deviceInfo.browser.name || 'Unknown',
        os: deviceInfo.os.name || 'Unknown',
        ipAddress: sessionInfo?.ipAddress,
        userAgent: sessionInfo?.userAgent,
        rotationCount: 0,
      },
    });

    return {
      tokens: { accessToken, refreshToken },
      sessionId,
    };
  }

  /**
   * 🔒 تجديد التوكنز (مع التدوير)
   *
   * يتم إنشاء توكنز جديدة وإبطال القديمة
   */
  async refreshTokens(
    refreshToken: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<TokenPair> {
    const startTime = Date.now();
    const timings: Record<string, number> = {};
    
    const refreshTokenHash = this.hashToken(refreshToken);
    timings.hash = Date.now() - startTime;

    // 1. البحث عن الجلسة بواسطة refreshTokenHash الحالي
    // ⚡ Performance: حد أدنى من الحقول + فهرس refreshTokenHash
    const sessionQueryStart = Date.now();
    const session = await this.prisma.session.findUnique({
      where: { refreshTokenHash },
      select: {
        id: true,
        userId: true,
        refreshTokenHash: true,
        previousRefreshTokenHash: true,
        isRevoked: true,
        revokedReason: true,
        refreshExpiresAt: true,
        rotationCount: true,
        ipAddress: true,
        userAgent: true,
        lastRotatedAt: true,
        user: { select: { email: true } },
      },
    });
    timings.sessionQuery = Date.now() - sessionQueryStart;
    
    // ⚡ Log slow queries (> 500ms)
    if (timings.sessionQuery > 500) {
      console.warn(`[TokenService] ⚠️ Slow session query: ${timings.sessionQuery}ms`);
    }

    // 2. إذا لم نجد الجلسة بـ hash الحالي، نبحث عن سرقة محتملة أو فترة سماح
    if (!session) {
      if (!isProduction) {
        console.log(
          '[TokenService] Session not found with current refresh token hash',
        );
      }

      // 🔍 Reuse Detection: هل هذا token قديم تم تدويره؟
      const tokenTheftCheck = await this.detectTokenTheft(
        refreshToken,
        refreshTokenHash,
      );

      // ✅ فترة السماح - إعادة استخدام Token خلال 30 ثانية من التدوير
      // 🔒 نعيد نفس الـ session الحالي بدلاً من إنشاء tokens جديدة (تجنب race condition)
      if (tokenTheftCheck.isGracePeriod && tokenTheftCheck.session) {
        if (!isProduction) {
          console.log(
            '[TokenService] ✅ Grace period hit - fetching current session tokens',
          );
        }
        const gracePeriodSession = tokenTheftCheck.session;

        // 🔒 نحتاج جلب الـ session الحالي مع الـ refresh token hash الجديد
        // ثم نعيد access token جديد فقط (الـ refresh token الحالي صالح)
        const currentSession = await this.prisma.session.findUnique({
          where: { id: gracePeriodSession.id },
          select: {
            id: true,
            userId: true,
            refreshTokenHash: true,
            user: { select: { email: true } },
          },
        });

        if (!currentSession) {
          throw new UnauthorizedException('Session not found during grace period');
        }

        // نُنشئ access token جديد فقط
        const newAccessPayload: TokenPayload = {
          sub: currentSession.userId,
          sid: currentSession.id,
          email: currentSession.user.email,
          type: 'access',
        };
        const newAccessToken = this.jwtService.sign(newAccessPayload, {
          expiresIn: this.ACCESS_TOKEN_EXPIRY,
        });

        // 🔒 نُعيد الـ refresh token الحالي (الذي تم تدويره مؤخراً)
        // نحتاج لإرجاع الـ token الأصلي، لكننا لا نخزنه - فقط الـ hash
        // لذا نُنشئ refresh token جديد ونُحدّث الـ hash
        const newRefreshToken = this.generateSecureRefreshToken();

        // تحديث الـ hash - بدون تغيير previousRefreshTokenHash لتجنب الـ cascade
        await this.prisma.session.update({
          where: { id: currentSession.id },
          data: {
            refreshTokenHash: this.hashToken(newRefreshToken),
            lastActivity: new Date(),
            // 🔒 لا نُحدّث lastRotatedAt لتجنب تمديد grace period
          },
        });

        return {
          accessToken: newAccessToken,
          refreshToken: newRefreshToken,
        };
      }

      if (tokenTheftCheck.isTheft) {
        if (!isProduction) {
          console.log(
            '[TokenService] 🚨 TOKEN THEFT DETECTED - revoking all sessions',
          );
        }
        // 🚨 سرقة محتملة! token قديم يُستخدم بعد التدوير
        await this.revokeAllUserSessions(
          tokenTheftCheck.userId,
          'SECURITY_ALERT: Refresh token reuse detected - possible token theft',
        );

        // 📝 تسجيل أمني للهجوم المحتمل
        await this.logSecurityAlert({
          type: 'TOKEN_THEFT_DETECTED',
          userId: tokenTheftCheck.userId,
          ipAddress,
          userAgent,
          details:
            'Old rotated refresh token was reused. All sessions revoked.',
        });

        throw new UnauthorizedException(
          'تم اكتشاف نشاط مشبوه. تم تسجيل خروجك من جميع الأجهزة لحماية حسابك',
        );
      }

      // Token مجهول تماماً - ليس سرقة، فقط غير صالح
      if (!isProduction) {
        console.log(
          '[TokenService] ❌ Invalid refresh token - not found in database',
        );
      }
      throw new UnauthorizedException(
        'جلسة غير صالحة. يرجى تسجيل الدخول مرة أخرى',
      );
    }

    // 3. التحقق من حالة الجلسة
    if (session.isRevoked) {
      if (!isProduction) {
        console.log(
          '[TokenService] ❌ Session is revoked:',
          session.revokedReason || 'No reason provided',
        );
      }
      // الجلسة مُبطلة - قد يكون:
      // - المستخدم سجل خروج
      // - تم اكتشاف سرقة سابقة
      // - انتهت صلاحية قسرية
      throw new UnauthorizedException(
        session.revokedReason?.includes('SECURITY_ALERT')
          ? 'تم تعليق جلستك لأسباب أمنية. يرجى تسجيل الدخول مرة أخرى'
          : 'انتهت الجلسة. يرجى تسجيل الدخول مرة أخرى',
      );
    }

    // 4. التحقق من انتهاء صلاحية Refresh Token
    if (session.refreshExpiresAt && session.refreshExpiresAt < new Date()) {
      if (!isProduction) {
        console.log('[TokenService] ❌ Refresh token expired:', {
          expiresAt: session.refreshExpiresAt,
          now: new Date(),
          userId: session.userId,
        });
      }
      await this.revokeSession(session.id, 'Refresh token expired naturally');
      throw new UnauthorizedException(
        'انتهت صلاحية الجلسة. يرجى تسجيل الدخول مرة أخرى',
      );
    }

    // 5. التحقق من حد التدوير
    if (session.rotationCount >= this.MAX_ROTATION_COUNT) {
      if (!isProduction) {
        console.log(
          '[TokenService] ❌ Max rotation count exceeded:',
          session.rotationCount,
        );
      }
      await this.revokeSession(session.id, 'Max rotation count exceeded');
      throw new UnauthorizedException(
        'تجاوزت الجلسة الحد الأقصى للتجديد. يرجى تسجيل الدخول مرة أخرى',
      );
    }

    if (!isProduction) {
      console.log('[TokenService] ✅ Rotating tokens for session:', session.id);
    }

    // 6. إنشاء توكنز جديدة
    const newAccessPayload: TokenPayload = {
      sub: session.userId,
      sid: session.id, // 🔒 نفس Session ID
      email: session.user.email,
      type: 'access',
    };
    const newAccessToken = this.jwtService.sign(newAccessPayload, {
      expiresIn: this.ACCESS_TOKEN_EXPIRY,
    });

    const newRefreshToken = this.generateSecureRefreshToken();

    // 7. حساب أوقات انتهاء جديدة
    const newSessionExpiresAt = new Date();
    newSessionExpiresAt.setMinutes(newSessionExpiresAt.getMinutes() + 30); // ✅ مطابق لـ ACCESS_TOKEN_EXPIRY

    // 8. تحديث الجلسة (Rotation) - فقط Refresh Token Hash الجديد
    // ⚠️ بعد هذه النقطة، أي استخدام للـ token القديم = سرقة محتملة
    const updateStart = Date.now();
    await this.prisma.session.update({
      where: { id: session.id },
      data: {
        // 🔒 Hash جديد فقط - القديم يصبح غير صالح فوراً
        // 🔒 حفظ Hash الحالي كـ previous قبل التدوير
        previousRefreshTokenHash: session.refreshTokenHash,
        refreshTokenHash: this.hashToken(newRefreshToken),
        expiresAt: newSessionExpiresAt,
        lastActivity: new Date(),
        rotationCount: session.rotationCount + 1,
        lastRotatedAt: new Date(),
        ipAddress: ipAddress || session.ipAddress,
        userAgent: userAgent || session.userAgent,
      },
    });
    timings.sessionUpdate = Date.now() - updateStart;
    
    // ⚡ Log total refresh time (warn if > 1s)
    const totalTime = Date.now() - startTime;
    if (totalTime > 1000 || !isProduction) {
      console.log(`[TokenService] Refresh completed in ${totalTime}ms`, {
        sessionQuery: timings.sessionQuery,
        sessionUpdate: timings.sessionUpdate,
        hash: timings.hash,
      });
    }

    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    };
  }

  /**
   * 🔍 كشف سرقة Token - يتحقق إذا كان token قديم تم تدويره
   *
   * المنطق:
   * 1. نبحث عن جلسة تحتوي على هذا الـ hash في previousRefreshTokenHash
   * 2. إذا وجدت ضمن فترة السماح = نعيد التوكنز الحالية (race condition)
   * 3. إذا وجدت خارج فترة السماح = سرقة محتملة!
   * 4. نُبطل جميع جلسات المستخدم
   */
  private async detectTokenTheft(
    refreshToken: string,
    providedHash: string,
  ): Promise<{
    isTheft: boolean;
    userId?: string;
    sessionId?: string;
    isGracePeriod?: boolean;
    session?: any;
  }> {
    try {
      // 🔍 البحث عن جلسة active يكون فيها هذا الـ hash هو الـ previous
      const suspiciousSession = await this.prisma.session.findFirst({
        where: {
          previousRefreshTokenHash: providedHash,
          isRevoked: false,
        },
        select: {
          id: true,
          userId: true,
          rotationCount: true,
          lastRotatedAt: true,
          refreshTokenHash: true,
          user: {
            select: {
              id: true,
              email: true,
            },
          },
        },
      });

      if (suspiciousSession) {
        // 🕐 تحقق من فترة السماح (Grace Period)
        // إذا كان التدوير الأخير خلال الـ 30 ثانية الماضية، اعتبره race condition
        const lastRotated = suspiciousSession.lastRotatedAt;
        if (lastRotated) {
          const timeSinceRotation =
            Date.now() - new Date(lastRotated).getTime();

          if (timeSinceRotation < this.GRACE_PERIOD_MS) {
            // ✅ ضمن فترة السماح - ليست سرقة، فقط race condition
            if (!isProduction) {
              console.log(
                `[TokenService] Grace period hit: ${timeSinceRotation}ms since rotation`,
              );
            }
            return {
              isTheft: false,
              isGracePeriod: true,
              session: suspiciousSession,
            };
          }
        }

        // 🚨 خارج فترة السماح = سرقة محتملة!
        // هذا الـ token كان صالحاً سابقاً لكن تم تدويره
        // والآن شخص يحاول استخدامه = إما المستخدم الأصلي أو السارق
        // كإجراء أمني، نُبطل كل شيء
        return {
          isTheft: true,
          userId: suspiciousSession.userId,
          sessionId: suspiciousSession.id,
        };
      }

      return { isTheft: false };
    } catch {
      return { isTheft: false };
    }
  }

  /**
   * 📝 تسجيل تنبيه أمني
   */
  private async logSecurityAlert(alert: {
    type: string;
    userId: string;
    ipAddress?: string;
    userAgent?: string;
    details: string;
  }): Promise<void> {
    try {
      // تسجيل في SecurityLog إذا كان متاحاً
      await this.prisma.securityLog.create({
        data: {
          userId: alert.userId,
          action: 'SUSPICIOUS_ACTIVITY' as any,
          status: 'WARNING' as any,
          description: `[${alert.type}] ${alert.details}`,
          ipAddress: alert.ipAddress,
          userAgent: alert.userAgent,
          metadata: {
            alertType: alert.type,
            timestamp: new Date().toISOString(),
          },
        },
      });
    } catch (error) {
      // لا نريد أن يفشل الـ flow الرئيسي بسبب فشل التسجيل
      console.error('Failed to log security alert:', error);
    }
  }

  /**
   * 🔒 إبطال جلسة واحدة
   */
  async revokeSession(sessionId: string, reason?: string): Promise<void> {
    await this.prisma.session.update({
      where: { id: sessionId },
      data: {
        isRevoked: true,
        revokedAt: new Date(),
        revokedReason: reason,
      },
    });
  }

  /**
   * 🔒 إبطال جميع جلسات المستخدم (تسجيل خروج من جميع الأجهزة)
   */
  async revokeAllUserSessions(
    userId: string,
    reason?: string,
  ): Promise<number> {
    const result = await this.prisma.session.updateMany({
      where: {
        userId,
        isRevoked: false,
      },
      data: {
        isRevoked: true,
        revokedAt: new Date(),
        revokedReason: reason || 'User requested logout from all devices',
      },
    });

    return result.count;
  }

  /**
   * 🔒 إبطال جلسة بواسطة Session ID من JWT
   */
  async revokeSessionByToken(
    accessToken: string,
    reason?: string,
  ): Promise<void> {
    try {
      // استخراج sessionId من JWT
      const payload = this.jwtService.verify<TokenPayload>(accessToken);
      const sessionId = payload.sid;

      if (sessionId) {
        await this.revokeSession(sessionId, reason);
      }
    } catch {
      // JWT غير صالح أو منتهي - لا مشكلة
    }
  }

  /**
   * 🔒 التحقق من صلاحية Access Token والجلسة
   * يستخدم sessionId (sid) من JWT للتحقق
   */
  async validateAccessToken(accessToken: string): Promise<{
    valid: boolean;
    userId?: string;
    sessionId?: string;
    error?: string;
  }> {
    try {
      // 1. فك تشفير JWT
      const payload = this.jwtService.verify<TokenPayload>(accessToken);

      // 2. التحقق من نوع التوكن
      if (payload.type !== 'access') {
        return { valid: false, error: 'Invalid token type' };
      }

      // 3. التحقق من وجود sessionId
      const sessionId = payload.sid;
      if (!sessionId) {
        return { valid: false, error: 'Missing session ID in token' };
      }

      // 4. البحث عن الجلسة باستخدام sessionId
      const session = await this.prisma.session.findUnique({
        where: { id: sessionId },
      });

      // 5. التحقق من وجود الجلسة
      if (!session) {
        return { valid: false, error: 'Session not found' };
      }

      // 6. التحقق من عدم إبطال الجلسة
      if (session.isRevoked) {
        return { valid: false, error: 'Session revoked' };
      }

      // 7. التحقق من تطابق المستخدم
      if (session.userId !== payload.sub) {
        return { valid: false, error: 'User mismatch' };
      }

      // 7. تحديث آخر نشاط (with throttling to prevent slow queries)
      updateSessionActivityThrottled(this.prisma, session.id);

      return {
        valid: true,
        userId: payload.sub,
        sessionId: session.id,
      };
    } catch (error) {
      return { valid: false, error: 'Token verification failed' };
    }
  }

  /**
   * 🔒 الحصول على جميع جلسات المستخدم النشطة
   */
  async getUserActiveSessions(userId: string) {
    return this.prisma.session.findMany({
      where: {
        userId,
        isRevoked: false,
        refreshExpiresAt: {
          gt: new Date(),
        },
      },
      select: {
        id: true,
        deviceName: true,
        deviceType: true,
        browser: true,
        os: true,
        ipAddress: true,
        lastActivity: true,
        createdAt: true,
      },
      orderBy: {
        lastActivity: 'desc',
      },
    });
  }

  /**
   * 🔒 تنظيف الجلسات المنتهية (للـ Cron Job)
   */
  async cleanupExpiredSessions(): Promise<number> {
    const result = await this.prisma.session.deleteMany({
      where: {
        OR: [
          // جلسات انتهت صلاحية refresh token
          {
            refreshExpiresAt: {
              lt: new Date(),
            },
          },
          // جلسات مُبطلة قديمة (أكثر من 7 أيام)
          {
            isRevoked: true,
            revokedAt: {
              lt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
            },
          },
        ],
      },
    });

    return result.count;
  }
}
