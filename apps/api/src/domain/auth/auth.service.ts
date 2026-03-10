import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../core/database/prisma/prisma.service';
import { SecurityLogService } from '../../infrastructure/security/log.service';
import { SecurityDetectorService } from '../../infrastructure/security/detector.service';
import * as crypto from 'crypto';
import { UAParser } from 'ua-parser-js';
import { NotificationsGateway } from '../notifications/notifications.gateway';
import { AccountLockoutService } from './account-lockout.service';
import { IpVerificationService } from './ip-verification.service';

/**
 * 🔒 Auth Service
 *
 * خدمة المصادقة الرئيسية
 * تتعامل مع OAuth (Google/LinkedIn) وإدارة الجلسات
 */

export interface AuthResult {
  user: {
    id: string;
    email: string;
    role: string;
    name?: string;
    username?: string;
    avatar?: string;
  };
  access_token: string;
  refresh_token?: string;
  needsProfileCompletion: boolean;
}

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private securityLogService: SecurityLogService,
    private securityDetectorService: SecurityDetectorService,
    private notificationsGateway: NotificationsGateway,
    private accountLockoutService: AccountLockoutService,
    private ipVerificationService: IpVerificationService,
  ) {}

  /**
   * 🔒 تشفير التوكن باستخدام SHA-256
   */
  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  /**
   * 🔒 إنشاء Refresh Token آمن
   */
  private generateSecureRefreshToken(): string {
    return crypto.randomBytes(64).toString('hex');
  }

  /**
   * 🔒 إنشاء جلسة جديدة مع Access و Refresh tokens
   *
   * ملاحظة: Access Token يحتوي على sid (Session ID) للربط بالجلسة
   * لا نخزن Access Token hash - نستخدم JWT Stateless
   */
  private async createSession(
    userId: string,
    email: string,
    userAgent?: string,
    ipAddress?: string,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    // Parse user agent
    const parser = new UAParser(userAgent);
    const result = parser.getResult();

    // 1. إنشاء Session ID
    const sessionId = crypto.randomUUID();

    // 2. إنشاء Access Token مع sid (30 دقيقة)
    const accessToken = this.jwtService.sign(
      { sub: userId, sid: sessionId, email, type: 'access' },
      { expiresIn: '30m' },
    );

    // 3. إنشاء Refresh Token (14 يوم)
    const refreshToken = this.generateSecureRefreshToken();

    // 4. حساب أوقات الانتهاء
    const sessionExpiresAt = new Date();
    sessionExpiresAt.setMinutes(sessionExpiresAt.getMinutes() + 30);

    const refreshExpiresAt = new Date();
    // 🔒 تقليل مدة Refresh Token من 30 يوم إلى 14 يوم (أكثر أماناً)
    refreshExpiresAt.setDate(refreshExpiresAt.getDate() + 14);

    // 5. حفظ الجلسة في قاعدة البيانات
    // ⚠️ لا نخزن Access Token - نستخدم sessionId في JWT
    try {
      await this.prisma.session.create({
        data: {
          id: sessionId,
          user: { connect: { id: userId } }, // استخدام العلاقة بدلاً من userId مباشرة
          // 🔒 فقط Refresh Token Hash
          refreshTokenHash: this.hashToken(refreshToken),
          deviceName: result.device.model || 'Unknown Device',
          deviceType: result.device.type || 'desktop',
          browser: result.browser.name || 'Unknown',
          os: result.os.name || 'Unknown',
          ipAddress,
          userAgent,
          expiresAt: sessionExpiresAt,
          refreshExpiresAt,
          rotationCount: 0,
        },
      });
    } catch (error) {
      // 🔒 Session creation failure should fail the login process
      // Returning tokens without a session would create orphaned tokens
      throw new Error(
        `Failed to create session: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }

    return { accessToken, refreshToken };
  }

  async validateUser(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        role: true,
        profile: {
          select: {
            name: true,
            username: true,
            avatar: true,
          },
        },
      },
    });

    if (!user) return null;

    return {
      id: user.id,
      email: user.email,
      role: user.role,
      name: user.profile?.name,
      username: user.profile?.username,
      avatar: user.profile?.avatar,
    };
  }

  async googleLogin(googleUser: any, userAgent?: string, ipAddress?: string) {
    const { googleId, email, name, avatar } = googleUser;

    // Prioritize lookup by Google ID, then fall back to email
    let user = await this.prisma.user.findFirst({
      where: { googleId },
      include: { profile: true },
    });

    if (!user) {
      user = await this.prisma.user.findFirst({
        where: { email },
        include: { profile: true },
      });
    }

    let isNewUser = false;
    if (!user) {
      // Create new user with profile
      user = await this.prisma.user.create({
        data: {
          id: crypto.randomUUID(),
          email,
          googleId,
          emailVerified: true, // Google emails are considered verified
          profileCompleted: true, // OAuth users have name/email/avatar from provider
          profile: {
            create: {
              id: crypto.randomUUID(),
              username:
                email.split('@')[0] +
                '_' +
                Math.random().toString(36).substring(2, 6),
              name,
              avatar,
            },
          },
        },
        include: {
          profile: true,
        },
      });
      isNewUser = true;

      // 🏪 إنشاء Store تلقائياً للمستخدم الجديد عبر Google
      try {
        const storeSlug = (user.profile?.username || email.split('@')[0])
          .toLowerCase()
          .replace(/[^a-z0-9]/g, '-')
          .replace(/-+/g, '-')
          .slice(0, 40)
          || `store-${crypto.randomUUID().slice(0, 8)}`;
        await this.prisma.store.create({
          data: {
            userId: user.id,
            name: name || 'متجري',
            slug: storeSlug,
            contactEmail: email,
            country: 'Iraq',
          },
        });
      } catch (storeErr) {
        // لا تُفشل عملية التسجيل بسبب فشل إنشاء المتجر
        // سيتم إنشاؤه تلقائياً عند أول زيارة لإعدادات المتجر
      }
    } else if (!user.googleId) {
      // Link existing user account with Google
      user = await this.prisma.user.update({
        where: { id: user.id },
        data: {
          googleId,
          emailVerified: true,
          profile: user.profile
            ? {
                update: {
                  avatar: avatar || user.profile.avatar,
                },
              }
            : {
                create: {
                  id: crypto.randomUUID(),
                  username:
                    email.split('@')[0] +
                    '_' +
                    Math.random().toString(36).substring(2, 6),
                  name,
                  avatar,
                },
              },
        },
        include: {
          profile: true,
        },
      });
    }

    // Ensure profileCompleted is true for OAuth users with a profile
    if (!user.profileCompleted && user.profile) {
      user = await this.prisma.user.update({
        where: { id: user.id },
        data: { profileCompleted: true },
        include: { profile: true },
      });
    }

    // 🔒 إنشاء جلسة جديدة مع Access و Refresh tokens
    const { accessToken, refreshToken } = await this.createSession(
      user.id,
      user.email,
      userAgent,
      ipAddress,
    );

    // Parse device information for logging
    const parser = new UAParser(userAgent);
    const result = parser.getResult();

    // Log successful login
    await this.securityLogService.createLog({
      userId: user.id,
      action: 'LOGIN_SUCCESS',
      status: 'SUCCESS',
      description: `تسجيل دخول ناجح عبر Google`,
      ipAddress,
      deviceType: result.device.type || 'desktop',
      browser: result.browser.name || 'Unknown',
      os: result.os.name || 'Unknown',
      userAgent,
    });

    // Check for new device
    await this.securityDetectorService.checkNewDevice(user.id, {
      browser: result.browser.name,
      os: result.os.name,
      deviceType: result.device.type || 'desktop',
      ipAddress,
      userAgent,
    });

    // 🔔 إرسال إشعار تسجيل دخول جديد (Security)
    try {
      await this.notificationsGateway.sendNotification({
        userId: user.id,
        type: 'NEW_LOGIN' as any,
        title: 'تسجيل دخول جديد',
        message: `تم تسجيل الدخول إلى حسابك من ${result.browser.name || 'متصفح غير معروف'} على ${result.os.name || 'جهاز غير معروف'}`,
        data: {
          browser: result.browser.name || 'Unknown',
          os: result.os.name || 'Unknown',
          deviceType: result.device.type || 'desktop',
        },
      });
    } catch (err) {
      // لا تُفشل عملية تسجيل الدخول بسبب فشل الإشعار
      // يمكن مراقبة هذه الأخطاء لاحقاً
      // Log error but don't fail the login process
      // Logger is handled by global exception filter
    }

    // تسجيل المحاولة الناجحة وإعادة تعيين عداد الإغلاق
    await this.accountLockoutService.recordSuccessfulAttempt(
      user.email,
      ipAddress,
    );

    return {
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        name: user.profile?.name,
        username: user.profile?.username,
        avatar: user.profile?.avatar,
      },
      access_token: accessToken,
      refresh_token: refreshToken,
      needsProfileCompletion: isNewUser && !user.profile,
    };
  }

  async linkedinLogin(
    linkedinUser: any,
    userAgent?: string,
    ipAddress?: string,
  ) {
    const { linkedinId, email, name, avatar } = linkedinUser;

    // Prioritize lookup by LinkedIn ID, then fall back to email
    let user = await this.prisma.user.findFirst({
      where: { linkedinId },
      include: { profile: true },
    });

    if (!user) {
      user = await this.prisma.user.findFirst({
        where: { email },
        include: { profile: true },
      });
    }

    let isNewUser = false;
    if (!user) {
      // Create new user with profile
      user = await this.prisma.user.create({
        data: {
          id: crypto.randomUUID(),
          email,
          linkedinId,
          emailVerified: true, // LinkedIn emails are considered verified
          profileCompleted: true, // OAuth users have name/email/avatar from provider
          profile: {
            create: {
              id: crypto.randomUUID(),
              username:
                email.split('@')[0] +
                '_' +
                Math.random().toString(36).substring(2, 6),
              name,
              avatar,
            },
          },
        },
        include: {
          profile: true,
        },
      });
      isNewUser = true;

      // 🏪 إنشاء Store تلقائياً للمستخدم الجديد عبر LinkedIn
      try {
        const storeSlug = (user.profile?.username || email.split('@')[0])
          .toLowerCase()
          .replace(/[^a-z0-9]/g, '-')
          .replace(/-+/g, '-')
          .slice(0, 40)
          || `store-${crypto.randomUUID().slice(0, 8)}`;
        await this.prisma.store.create({
          data: {
            userId: user.id,
            name: name || 'متجري',
            slug: storeSlug,
            contactEmail: email,
            country: 'Iraq',
          },
        });
      } catch (storeErr) {
        // لا تُفشل عملية التسجيل بسبب فشل إنشاء المتجر
        // سيتم إنشاؤه تلقائياً عند أول زيارة لإعدادات المتجر
      }
    } else if (!user.linkedinId) {
      // Link existing user account with LinkedIn
      user = await this.prisma.user.update({
        where: { id: user.id },
        data: {
          linkedinId,
          emailVerified: true,
          profile: user.profile
            ? {
                update: {
                  avatar: avatar || user.profile.avatar,
                },
              }
            : {
                create: {
                  id: crypto.randomUUID(),
                  username:
                    email.split('@')[0] +
                    '_' +
                    Math.random().toString(36).substring(2, 6),
                  name,
                  avatar,
                },
              },
        },
        include: {
          profile: true,
        },
      });
    }

    // Ensure profileCompleted is true for OAuth users with a profile
    if (!user.profileCompleted && user.profile) {
      user = await this.prisma.user.update({
        where: { id: user.id },
        data: { profileCompleted: true },
        include: { profile: true },
      });
    }

    // 🔒 إنشاء جلسة جديدة مع Access و Refresh tokens
    const { accessToken, refreshToken } = await this.createSession(
      user.id,
      user.email,
      userAgent,
      ipAddress,
    );

    // Parse device information for logging
    const parser = new UAParser(userAgent);
    const result = parser.getResult();

    // Log successful login
    await this.securityLogService.createLog({
      userId: user.id,
      action: 'LOGIN_SUCCESS',
      status: 'SUCCESS',
      description: `تسجيل دخول ناجح عبر LinkedIn`,
      ipAddress,
      deviceType: result.device.type || 'desktop',
      browser: result.browser.name || 'Unknown',
      os: result.os.name || 'Unknown',
      userAgent,
    });

    // 🔔 إرسال إشعار تسجيل دخول جديد (Security)
    try {
      await this.notificationsGateway.sendNotification({
        userId: user.id,
        type: 'NEW_LOGIN' as any,
        title: 'تسجيل دخول جديد',
        message: `تم تسجيل الدخول إلى حسابك من ${result.browser.name || 'متصفح غير معروف'} على ${result.os.name || 'جهاز غير معروف'}`,
        data: {
          browser: result.browser.name || 'Unknown',
          os: result.os.name || 'Unknown',
          deviceType: result.device.type || 'desktop',
        },
      });
    } catch (err) {
      // Log error but don't fail the login process
      // Logger is handled by global exception filter
    }

    // Check for new device
    await this.securityDetectorService.checkNewDevice(user.id, {
      browser: result.browser.name,
      os: result.os.name,
      deviceType: result.device.type || 'desktop',
      ipAddress,
      userAgent,
    });

    // تسجيل المحاولة الناجحة وإعادة تعيين عداد الإغلاق
    await this.accountLockoutService.recordSuccessfulAttempt(
      user.email,
      ipAddress,
    );

    return {
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        name: user.profile?.name,
        username: user.profile?.username,
        avatar: user.profile?.avatar,
      },
      access_token: accessToken,
      refresh_token: refreshToken,
      needsProfileCompletion: isNewUser && !user.profile,
    };
  }

  /**
   * 🔒 تسجيل الخروج - إبطال الجلسة بدلاً من حذفها
   * يقبل توكن منتهي الصلاحية لاستخراج sessionId وإبطال الجلسة
   */
  async logout(token: string, userId?: string) {
    try {
      let sessionId: string | undefined;
      try {
        const decoded = this.jwtService.decode(token) as { sid?: string } | null;
        sessionId = decoded?.sid;
      } catch {
        // ignore
      }

      if (!sessionId) {
        return { message: 'Logged out successfully' };
      }

      const session = await this.prisma.session.findUnique({
        where: { id: sessionId },
      });

      if (session && !session.isRevoked) {
        await this.prisma.session.update({
          where: { id: sessionId },
          data: {
            isRevoked: true,
            revokedAt: new Date(),
            revokedReason: 'User logout',
          },
        });

        await this.securityLogService.createLog({
          userId: session.userId,
          action: 'LOGOUT',
          status: 'SUCCESS',
          description: 'تسجيل خروج',
          ipAddress: session.ipAddress,
          deviceType: session.deviceType,
          browser: session.browser,
          os: session.os,
        });
      }

      return { message: 'Logged out successfully' };
    } catch {
      return { message: 'Logged out successfully' };
    }
  }
}
