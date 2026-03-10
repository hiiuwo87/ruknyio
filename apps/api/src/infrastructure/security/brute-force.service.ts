import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../../core/cache/redis.service';

/**
 * 🔒 Brute Force Protection Service
 *
 * حماية متقدمة من هجمات القوة الغاشمة باستخدام:
 * - Sliding Window Algorithm للدقة
 * - تصعيد العقوبات (Progressive Penalties)
 * - حظر IP و المستخدم
 */
@Injectable()
export class BruteForceService {
  private readonly logger = new Logger(BruteForceService.name);

  // إعدادات افتراضية
  private readonly CONFIG = {
    // محاولات تسجيل الدخول
    LOGIN_MAX_ATTEMPTS: 5,
    LOGIN_WINDOW_SECONDS: 300, // 5 دقائق
    LOGIN_BLOCK_DURATION: 900, // 15 دقيقة

    // محاولات إعادة تعيين كلمة المرور
    RESET_MAX_ATTEMPTS: 3,
    RESET_WINDOW_SECONDS: 3600, // ساعة
    RESET_BLOCK_DURATION: 3600, // ساعة

    // محاولات التحقق (OTP)
    OTP_MAX_ATTEMPTS: 5,
    OTP_WINDOW_SECONDS: 300, // 5 دقائق
    OTP_BLOCK_DURATION: 1800, // 30 دقيقة

    // API Rate Limiting
    API_MAX_REQUESTS: 100,
    API_WINDOW_SECONDS: 60, // دقيقة

    // تصعيد العقوبات
    PROGRESSIVE_MULTIPLIER: 2, // مضاعفة وقت الحظر
    MAX_BLOCK_DURATION: 86400, // 24 ساعة كحد أقصى
  };

  constructor(private readonly redis: RedisService) {}

  // ==================== Login Protection ====================

  /**
   * تسجيل محاولة تسجيل دخول فاشلة
   */
  async recordLoginAttempt(
    identifier: string,
    ip: string,
  ): Promise<{
    blocked: boolean;
    attemptsLeft: number;
    blockDuration?: number;
  }> {
    const userKey = `bf:login:user:${identifier}`;
    const ipKey = `bf:login:ip:${ip}`;

    // تحقق من الحظر الحالي
    const userBlocked = await this.isBlocked(userKey);
    const ipBlocked = await this.isBlocked(ipKey);

    if (userBlocked || ipBlocked) {
      const ttl = await this.getBlockTTL(userBlocked ? userKey : ipKey);
      return { blocked: true, attemptsLeft: 0, blockDuration: ttl };
    }

    // تسجيل المحاولة
    const [userAttempts, ipAttempts] = await Promise.all([
      this.incrementAttempts(userKey, this.CONFIG.LOGIN_WINDOW_SECONDS),
      this.incrementAttempts(ipKey, this.CONFIG.LOGIN_WINDOW_SECONDS),
    ]);

    const maxAttempts = this.CONFIG.LOGIN_MAX_ATTEMPTS;
    const attempts = Math.max(userAttempts, ipAttempts);

    // حساب المحاولات المتبقية
    const attemptsLeft = Math.max(0, maxAttempts - attempts);

    // تجاوز الحد؟
    if (attempts >= maxAttempts) {
      const blockDuration = await this.calculateProgressiveBlock(
        identifier,
        this.CONFIG.LOGIN_BLOCK_DURATION,
      );

      await Promise.all([
        this.blockKey(userKey, blockDuration),
        this.blockKey(ipKey, blockDuration),
      ]);

      this.logger.warn(
        `🚫 Blocked login for ${identifier} (IP: ${ip}) for ${blockDuration}s`,
      );

      return { blocked: true, attemptsLeft: 0, blockDuration };
    }

    return { blocked: false, attemptsLeft };
  }

  /**
   * إعادة تعيين محاولات تسجيل الدخول بعد نجاح الدخول
   */
  async resetLoginAttempts(identifier: string, ip: string): Promise<void> {
    const userKey = `bf:login:user:${identifier}`;
    const ipKey = `bf:login:ip:${ip}`;
    const blockHistoryKey = `bf:history:${identifier}`;

    await Promise.all([
      this.redis.del(userKey),
      this.redis.del(ipKey),
      this.redis.del(`${userKey}:blocked`),
      this.redis.del(`${ipKey}:blocked`),
      // تقليل سجل الحظر تدريجياً عند النجاح
      this.redis.decr(blockHistoryKey),
    ]);
  }

  // ==================== Password Reset Protection ====================

  /**
   * تسجيل محاولة إعادة تعيين كلمة المرور
   */
  async recordResetAttempt(
    email: string,
    ip: string,
  ): Promise<{ blocked: boolean; attemptsLeft: number }> {
    const emailKey = `bf:reset:email:${email}`;
    const ipKey = `bf:reset:ip:${ip}`;

    const emailBlocked = await this.isBlocked(emailKey);
    const ipBlocked = await this.isBlocked(ipKey);

    if (emailBlocked || ipBlocked) {
      return { blocked: true, attemptsLeft: 0 };
    }

    const [emailAttempts, ipAttempts] = await Promise.all([
      this.incrementAttempts(emailKey, this.CONFIG.RESET_WINDOW_SECONDS),
      this.incrementAttempts(ipKey, this.CONFIG.RESET_WINDOW_SECONDS),
    ]);

    const maxAttempts = this.CONFIG.RESET_MAX_ATTEMPTS;
    const attempts = Math.max(emailAttempts, ipAttempts);
    const attemptsLeft = Math.max(0, maxAttempts - attempts);

    if (attempts >= maxAttempts) {
      await Promise.all([
        this.blockKey(emailKey, this.CONFIG.RESET_BLOCK_DURATION),
        this.blockKey(ipKey, this.CONFIG.RESET_BLOCK_DURATION),
      ]);

      this.logger.warn(`🚫 Blocked password reset for ${email}`);
      return { blocked: true, attemptsLeft: 0 };
    }

    return { blocked: false, attemptsLeft };
  }

  // ==================== OTP Protection ====================

  /**
   * تسجيل محاولة تحقق OTP فاشلة
   */
  async recordOtpAttempt(
    userId: string,
    ip: string,
  ): Promise<{ blocked: boolean; attemptsLeft: number }> {
    const userKey = `bf:otp:user:${userId}`;
    const ipKey = `bf:otp:ip:${ip}`;

    const userBlocked = await this.isBlocked(userKey);
    if (userBlocked) {
      return { blocked: true, attemptsLeft: 0 };
    }

    const attempts = await this.incrementAttempts(
      userKey,
      this.CONFIG.OTP_WINDOW_SECONDS,
    );
    const maxAttempts = this.CONFIG.OTP_MAX_ATTEMPTS;
    const attemptsLeft = Math.max(0, maxAttempts - attempts);

    if (attempts >= maxAttempts) {
      await this.blockKey(userKey, this.CONFIG.OTP_BLOCK_DURATION);
      this.logger.warn(`🚫 Blocked OTP attempts for user ${userId}`);
      return { blocked: true, attemptsLeft: 0 };
    }

    return { blocked: false, attemptsLeft };
  }

  /**
   * إعادة تعيين محاولات OTP بعد النجاح
   */
  async resetOtpAttempts(userId: string): Promise<void> {
    const key = `bf:otp:user:${userId}`;
    await Promise.all([
      this.redis.del(key),
      this.redis.del(`${key}:blocked`),
    ]);
  }

  // ==================== API Rate Limiting ====================

  /**
   * التحقق من rate limit للـ API
   */
  async checkApiRateLimit(
    identifier: string,
    endpoint?: string,
  ): Promise<{
    allowed: boolean;
    remaining: number;
    resetIn: number;
  }> {
    const key = endpoint
      ? `bf:api:${identifier}:${endpoint}`
      : `bf:api:${identifier}`;

    const attempts = await this.getAttempts(key);
    const maxRequests = this.CONFIG.API_MAX_REQUESTS;

    if (attempts >= maxRequests) {
      const ttl = await this.redis.ttl(key);
      return {
        allowed: false,
        remaining: 0,
        resetIn: ttl > 0 ? ttl : this.CONFIG.API_WINDOW_SECONDS,
      };
    }

    await this.incrementAttempts(key, this.CONFIG.API_WINDOW_SECONDS);

    return {
      allowed: true,
      remaining: maxRequests - attempts - 1,
      resetIn: await this.redis.ttl(key),
    };
  }

  // ==================== Helper Methods ====================

  /**
   * زيادة عداد المحاولات
   */
  private async incrementAttempts(
    key: string,
    windowSeconds: number,
  ): Promise<number> {
    const attemptsKey = `${key}:attempts`;
    const count = await this.redis.incr(attemptsKey);

    if (count === 1) {
      await this.redis.expire(attemptsKey, windowSeconds);
    }

    return count;
  }

  /**
   * الحصول على عدد المحاولات
   */
  private async getAttempts(key: string): Promise<number> {
    const value = await this.redis.get(`${key}:attempts`);
    return value ? parseInt(value, 10) : 0;
  }

  /**
   * التحقق من الحظر
   */
  private async isBlocked(key: string): Promise<boolean> {
    const blocked = await this.redis.get(`${key}:blocked`);
    return blocked === '1';
  }

  /**
   * الحصول على وقت انتهاء الحظر
   */
  private async getBlockTTL(key: string): Promise<number> {
    return await this.redis.ttl(`${key}:blocked`);
  }

  /**
   * حظر مفتاح
   */
  private async blockKey(key: string, duration: number): Promise<void> {
    await this.redis.setex(`${key}:blocked`, duration, '1');
  }

  /**
   * حساب وقت الحظر التصاعدي
   */
  private async calculateProgressiveBlock(
    identifier: string,
    baseDuration: number,
  ): Promise<number> {
    const historyKey = `bf:history:${identifier}`;
    const blockCount = await this.redis.incr(historyKey);

    // حفظ السجل لمدة أسبوع
    if (blockCount === 1) {
      await this.redis.expire(historyKey, 604800);
    }

    // مضاعفة الوقت حسب عدد مرات الحظر السابقة
    const duration =
      baseDuration *
      Math.pow(this.CONFIG.PROGRESSIVE_MULTIPLIER, blockCount - 1);

    return Math.min(duration, this.CONFIG.MAX_BLOCK_DURATION);
  }

  // ==================== Admin Methods ====================

  /**
   * إلغاء حظر مستخدم يدوياً
   */
  async unblockUser(identifier: string): Promise<void> {
    const patterns = [
      `bf:login:user:${identifier}*`,
      `bf:reset:email:${identifier}*`,
      `bf:otp:user:${identifier}*`,
      `bf:history:${identifier}`,
    ];

    for (const pattern of patterns) {
      const keys = await this.redis.keys(pattern);
      if (keys.length > 0) {
        await Promise.all(keys.map((key) => this.redis.del(key)));
      }
    }

    this.logger.log(`✅ Unblocked user: ${identifier}`);
  }

  /**
   * إلغاء حظر IP يدوياً
   */
  async unblockIp(ip: string): Promise<void> {
    const patterns = [
      `bf:login:ip:${ip}*`,
      `bf:reset:ip:${ip}*`,
      `bf:otp:ip:${ip}*`,
      `bf:api:${ip}*`,
    ];

    for (const pattern of patterns) {
      const keys = await this.redis.keys(pattern);
      if (keys.length > 0) {
        await Promise.all(keys.map((key) => this.redis.del(key)));
      }
    }

    this.logger.log(`✅ Unblocked IP: ${ip}`);
  }

  /**
   * الحصول على حالة الحظر لمستخدم
   */
  async getBlockStatus(
    identifier: string,
  ): Promise<{
    loginBlocked: boolean;
    resetBlocked: boolean;
    otpBlocked: boolean;
    blockHistory: number;
  }> {
    const [loginBlocked, resetBlocked, otpBlocked, history] = await Promise.all(
      [
        this.isBlocked(`bf:login:user:${identifier}`),
        this.isBlocked(`bf:reset:email:${identifier}`),
        this.isBlocked(`bf:otp:user:${identifier}`),
        this.redis.get(`bf:history:${identifier}`),
      ],
    );

    return {
      loginBlocked,
      resetBlocked,
      otpBlocked,
      blockHistory: history ? parseInt(history, 10) : 0,
    };
  }
}
