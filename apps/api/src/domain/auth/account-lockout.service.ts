import { Injectable, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma/prisma.service';
import { EmailService } from '../../integrations/email/email.service';
import { SecurityLogService } from '../../infrastructure/security/log.service';
import { ConfigService } from '@nestjs/config';

/**
 * 🔒 Account Lockout Service
 *
 * خدمة قفل الحسابات لحمايتها من:
 * - Brute Force Attacks
 * - Credential Stuffing
 * - Password Spraying
 *
 * آلية العمل:
 * 1. تتبع المحاولات الفاشلة لكل بريد إلكتروني و IP
 * 2. قفل الحساب بعد عدد معين من المحاولات
 * 3. زيادة مدة القفل تصاعدياً (Progressive Lockout)
 * 4. إرسال تنبيه للمستخدم عند القفل
 * 5. فتح القفل تلقائياً بعد انتهاء المدة
 */

export interface LockoutConfig {
  maxAttempts: number; // الحد الأقصى للمحاولات
  lockoutDurationMinutes: number; // مدة القفل الأولية
  maxLockoutDurationMinutes: number; // الحد الأقصى لمدة القفل
  attemptWindowMinutes: number; // نافذة احتساب المحاولات
  progressiveMultiplier: number; // مضاعف الزيادة التصاعدية
}

export interface AttemptResult {
  allowed: boolean;
  remainingAttempts?: number;
  lockoutUntil?: Date;
  lockoutMinutes?: number;
  message?: string;
}

@Injectable()
export class AccountLockoutService {
  private readonly config: LockoutConfig;

  constructor(
    private prisma: PrismaService,
    private emailService: EmailService,
    private securityLogService: SecurityLogService,
    private configService: ConfigService,
  ) {
    // إعدادات القفل
    this.config = {
      maxAttempts: parseInt(
        this.configService.get('LOCKOUT_MAX_ATTEMPTS') || '5',
        10,
      ),
      lockoutDurationMinutes: parseInt(
        this.configService.get('LOCKOUT_DURATION_MINUTES') || '15',
        10,
      ),
      maxLockoutDurationMinutes: parseInt(
        this.configService.get('LOCKOUT_MAX_DURATION_MINUTES') || '1440',
        10,
      ), // 24 ساعة
      attemptWindowMinutes: parseInt(
        this.configService.get('LOCKOUT_WINDOW_MINUTES') || '30',
        10,
      ),
      progressiveMultiplier: parseFloat(
        this.configService.get('LOCKOUT_PROGRESSIVE_MULTIPLIER') || '2',
      ),
    };
  }

  /**
   * 🔍 التحقق مما إذا كان الحساب مقفلاً
   */
  async isAccountLocked(email: string): Promise<{
    locked: boolean;
    lockoutUntil?: Date;
    remainingMinutes?: number;
  }> {
    const lockout = await this.prisma.accountLockout.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (!lockout || !lockout.lockedUntil) {
      return { locked: false };
    }

    const now = new Date();
    if (now >= lockout.lockedUntil) {
      // القفل انتهى - إعادة تعيين
      await this.resetLockout(email);
      return { locked: false };
    }

    const remainingMs = lockout.lockedUntil.getTime() - now.getTime();
    const remainingMinutes = Math.ceil(remainingMs / (1000 * 60));

    return {
      locked: true,
      lockoutUntil: lockout.lockedUntil,
      remainingMinutes,
    };
  }

  /**
   * 🚫 التحقق قبل محاولة تسجيل الدخول
   */
  async checkBeforeAttempt(
    email: string,
    ipAddress?: string,
  ): Promise<AttemptResult> {
    const normalizedEmail = email.toLowerCase();

    // التحقق من قفل الحساب
    const lockStatus = await this.isAccountLocked(normalizedEmail);
    if (lockStatus.locked) {
      return {
        allowed: false,
        lockoutUntil: lockStatus.lockoutUntil,
        lockoutMinutes: lockStatus.remainingMinutes,
        message: `الحساب مقفل. يرجى المحاولة بعد ${lockStatus.remainingMinutes} دقيقة`,
      };
    }

    // التحقق من قفل الـ IP
    if (ipAddress) {
      const ipLockStatus = await this.isIPLocked(ipAddress);
      if (ipLockStatus.locked) {
        return {
          allowed: false,
          lockoutUntil: ipLockStatus.lockoutUntil,
          lockoutMinutes: ipLockStatus.remainingMinutes,
          message: `تم حظر عنوان IP مؤقتاً. يرجى المحاولة بعد ${ipLockStatus.remainingMinutes} دقيقة`,
        };
      }
    }

    // حساب المحاولات المتبقية
    const lockout = await this.getOrCreateLockout(normalizedEmail);
    const recentAttempts = await this.countRecentAttempts(normalizedEmail);
    const remainingAttempts = Math.max(
      0,
      this.config.maxAttempts - recentAttempts,
    );

    return {
      allowed: true,
      remainingAttempts,
    };
  }

  /**
   * ❌ تسجيل محاولة فاشلة
   */
  async recordFailedAttempt(
    email: string,
    ipAddress?: string,
    reason?: string,
    metadata?: Record<string, any>,
  ): Promise<AttemptResult> {
    const normalizedEmail = email.toLowerCase();

    // تسجيل المحاولة
    await this.prisma.loginAttempt.create({
      data: {
        id: crypto.randomUUID(),
        email: normalizedEmail,
        ipAddress,
        success: false,
        reason,
        metadata: metadata || {},
      },
    });

    // تسجيل محاولة IP
    if (ipAddress) {
      await this.recordIPAttempt(ipAddress, false);
    }

    // حساب عدد المحاولات
    const recentAttempts = await this.countRecentAttempts(normalizedEmail);
    const remainingAttempts = Math.max(
      0,
      this.config.maxAttempts - recentAttempts,
    );

    // التحقق من الحاجة للقفل
    if (recentAttempts >= this.config.maxAttempts) {
      return await this.lockAccount(normalizedEmail, ipAddress);
    }

    // تحذير قبل القفل
    if (remainingAttempts <= 2) {
      // إرسال تحذير (اختياري)
      await this.sendWarningEmail(normalizedEmail, remainingAttempts);
    }

    return {
      allowed: true,
      remainingAttempts,
      message:
        remainingAttempts <= 2
          ? `تحذير: متبقي ${remainingAttempts} محاولات قبل قفل الحساب`
          : undefined,
    };
  }

  /**
   * ✅ تسجيل محاولة ناجحة
   */
  async recordSuccessfulAttempt(
    email: string,
    ipAddress?: string,
  ): Promise<void> {
    const normalizedEmail = email.toLowerCase();

    // تسجيل المحاولة الناجحة
    await this.prisma.loginAttempt.create({
      data: {
        id: crypto.randomUUID(),
        email: normalizedEmail,
        ipAddress,
        success: true,
      },
    });

    // إعادة تعيين القفل
    await this.resetLockout(normalizedEmail);

    // إعادة تعيين محاولات IP
    if (ipAddress) {
      await this.resetIPLockout(ipAddress);
    }
  }

  /**
   * 🔐 قفل الحساب
   */
  private async lockAccount(
    email: string,
    ipAddress?: string,
  ): Promise<AttemptResult> {
    const lockout = await this.getOrCreateLockout(email);

    // حساب مدة القفل التصاعدية
    const lockCount = lockout.lockCount + 1;
    let lockoutMinutes =
      this.config.lockoutDurationMinutes *
      Math.pow(this.config.progressiveMultiplier, lockCount - 1);

    // الحد الأقصى
    lockoutMinutes = Math.min(
      lockoutMinutes,
      this.config.maxLockoutDurationMinutes,
    );

    const lockedUntil = new Date();
    lockedUntil.setMinutes(lockedUntil.getMinutes() + lockoutMinutes);

    // تحديث سجل القفل
    await this.prisma.accountLockout.update({
      where: { email },
      data: {
        lockedUntil,
        lockCount,
        lastAttempt: new Date(),
      },
    });

    // تسجيل في Security Log
    const user = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });

    await this.securityLogService.createLog({
      userId: user?.id,
      action: 'SUSPICIOUS_ACTIVITY',
      status: 'WARNING',
      description: `تم قفل الحساب بسبب ${this.config.maxAttempts} محاولات فاشلة. مدة القفل: ${lockoutMinutes} دقيقة`,
      ipAddress,
    });

    // إرسال بريد تنبيه
    await this.sendLockoutEmail(email, lockoutMinutes, ipAddress);

    return {
      allowed: false,
      lockoutUntil: lockedUntil,
      lockoutMinutes: Math.ceil(lockoutMinutes),
      message: `تم قفل الحساب بسبب محاولات متعددة فاشلة. يرجى المحاولة بعد ${Math.ceil(lockoutMinutes)} دقيقة`,
    };
  }

  /**
   * 🔓 إعادة تعيين القفل
   */
  async resetLockout(email: string): Promise<void> {
    const normalizedEmail = email.toLowerCase();

    await this.prisma.accountLockout.upsert({
      where: { email: normalizedEmail },
      update: {
        lockedUntil: null,
        lastAttempt: new Date(),
        // لا نعيد تعيين lockCount لتتبع التاريخ
      },
      create: {
        id: crypto.randomUUID(),
        email: normalizedEmail,
        lockCount: 0,
      },
    });
  }

  /**
   * 🔓 فتح القفل يدوياً (للمشرفين)
   */
  async unlockAccount(email: string, adminId: string): Promise<void> {
    const normalizedEmail = email.toLowerCase();

    await this.prisma.accountLockout.update({
      where: { email: normalizedEmail },
      data: {
        lockedUntil: null,
        lockCount: 0,
      },
    });

    // تسجيل في Security Log
    const user = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: { id: true },
    });

    await this.securityLogService.createLog({
      userId: user?.id,
      action: 'PROFILE_UPDATE',
      status: 'SUCCESS',
      description: `تم فتح قفل الحساب يدوياً بواسطة المشرف ${adminId}`,
    });
  }

  /**
   * 📊 إحصائيات القفل للمستخدم
   */
  async getLockoutStats(email: string): Promise<{
    isLocked: boolean;
    lockoutUntil?: Date;
    lockCount: number;
    recentAttempts: number;
    lastAttempt?: Date;
  }> {
    const normalizedEmail = email.toLowerCase();
    const lockout = await this.prisma.accountLockout.findUnique({
      where: { email: normalizedEmail },
    });

    const recentAttempts = await this.countRecentAttempts(normalizedEmail);
    const lockStatus = await this.isAccountLocked(normalizedEmail);

    return {
      isLocked: lockStatus.locked,
      lockoutUntil: lockStatus.lockoutUntil,
      lockCount: lockout?.lockCount || 0,
      recentAttempts,
      lastAttempt: lockout?.lastAttempt,
    };
  }

  // ==================== IP Lockout ====================

  /**
   * 🔍 التحقق من قفل IP
   */
  private async isIPLocked(ipAddress: string): Promise<{
    locked: boolean;
    lockoutUntil?: Date;
    remainingMinutes?: number;
  }> {
    const ipLockout = await this.prisma.iPLockout.findUnique({
      where: { ipAddress },
    });

    if (!ipLockout || !ipLockout.lockedUntil) {
      return { locked: false };
    }

    const now = new Date();
    if (now >= ipLockout.lockedUntil) {
      await this.resetIPLockout(ipAddress);
      return { locked: false };
    }

    const remainingMs = ipLockout.lockedUntil.getTime() - now.getTime();
    const remainingMinutes = Math.ceil(remainingMs / (1000 * 60));

    return {
      locked: true,
      lockoutUntil: ipLockout.lockedUntil,
      remainingMinutes,
    };
  }

  /**
   * تسجيل محاولة IP
   */
  private async recordIPAttempt(
    ipAddress: string,
    success: boolean,
  ): Promise<void> {
    if (success) {
      await this.resetIPLockout(ipAddress);
      return;
    }

    const ipLockout = await this.prisma.iPLockout.upsert({
      where: { ipAddress },
      update: {
        attemptCount: { increment: 1 },
        lastAttempt: new Date(),
      },
      create: {
        id: crypto.randomUUID(),
        ipAddress,
        attemptCount: 1,
      },
    });

    // قفل IP بعد محاولات كثيرة (أكثر تساهلاً من الحساب)
    const ipMaxAttempts = this.config.maxAttempts * 3; // 15 محاولة افتراضياً
    if (ipLockout.attemptCount >= ipMaxAttempts) {
      const lockedUntil = new Date();
      lockedUntil.setMinutes(
        lockedUntil.getMinutes() + this.config.lockoutDurationMinutes,
      );

      await this.prisma.iPLockout.update({
        where: { ipAddress },
        data: { lockedUntil },
      });
    }
  }

  /**
   * إعادة تعيين قفل IP
   */
  private async resetIPLockout(ipAddress: string): Promise<void> {
    await this.prisma.iPLockout.upsert({
      where: { ipAddress },
      update: {
        attemptCount: 0,
        lockedUntil: null,
      },
      create: {
        id: crypto.randomUUID(),
        ipAddress,
        attemptCount: 0,
      },
    });
  }

  // ==================== Helpers ====================

  /**
   * الحصول على أو إنشاء سجل القفل
   */
  private async getOrCreateLockout(email: string) {
    return await this.prisma.accountLockout.upsert({
      where: { email },
      update: {},
      create: {
        id: crypto.randomUUID(),
        email,
        lockCount: 0,
      },
    });
  }

  /**
   * حساب المحاولات الأخيرة
   */
  private async countRecentAttempts(email: string): Promise<number> {
    const windowStart = new Date();
    windowStart.setMinutes(
      windowStart.getMinutes() - this.config.attemptWindowMinutes,
    );

    return await this.prisma.loginAttempt.count({
      where: {
        email,
        success: false,
        createdAt: { gte: windowStart },
      },
    });
  }

  /**
   * إرسال بريد تحذير
   */
  private async sendWarningEmail(
    email: string,
    remainingAttempts: number,
  ): Promise<void> {
    try {
      await this.emailService.sendSecurityAlert(email, 'مستخدم', {
        action: 'FAILED_LOGIN_WARNING',
        actionArabic: 'تحذير محاولات تسجيل دخول فاشلة',
        description:
          `تم اكتشاف ${this.config.maxAttempts - remainingAttempts} محاولات تسجيل دخول فاشلة لحسابك. ` +
          `متبقي ${remainingAttempts} محاولات قبل قفل الحساب مؤقتاً. ` +
          `إذا لم تكن أنت، يرجى تأمين حسابك فوراً.`,
        timestamp: new Date(),
      });
    } catch (error) {
      console.error('Failed to send warning email:', error);
    }
  }

  /**
   * إرسال بريد قفل الحساب
   */
  private async sendLockoutEmail(
    email: string,
    lockoutMinutes: number,
    ipAddress?: string,
  ): Promise<void> {
    try {
      await this.emailService.sendSecurityAlert(email, 'مستخدم', {
        action: 'ACCOUNT_LOCKED',
        actionArabic: 'تم قفل حسابك مؤقتاً',
        description:
          `تم قفل حسابك بسبب ${this.config.maxAttempts} محاولات تسجيل دخول فاشلة. ` +
          `سيتم فتح القفل تلقائياً بعد ${Math.ceil(lockoutMinutes)} دقيقة. ` +
          `إذا لم تكن أنت، يرجى تغيير كلمة المرور فور فتح القفل أو التواصل مع الدعم الفني.`,
        ipAddress,
        timestamp: new Date(),
      });
    } catch (error) {
      console.error('Failed to send lockout email:', error);
    }
  }

  /**
   * 🧹 تنظيف المحاولات القديمة (يُستدعى دورياً)
   */
  async cleanupOldAttempts(): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 7); // حذف المحاولات الأقدم من 7 أيام

    const result = await this.prisma.loginAttempt.deleteMany({
      where: {
        createdAt: { lt: cutoffDate },
      },
    });

    return result.count;
  }
}
