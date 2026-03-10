import { Injectable, Logger } from '@nestjs/common';
import { createHash, randomBytes } from 'crypto';
import { RedisService } from '../../core/cache/redis.service';
import { PrismaService } from '../../core/database/prisma/prisma.service';

/**
 * 🔐 Session Fingerprinting Service
 *
 * تتبع الجلسات باستخدام بصمة الجهاز/المتصفح
 * للكشف عن سرقة الجلسات أو الاستخدام غير المصرح
 */
@Injectable()
export class SessionFingerprintService {
  private readonly logger = new Logger(SessionFingerprintService.name);

  constructor(
    private readonly redis: RedisService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * إنشاء بصمة للجهاز/المتصفح
   */
  generateFingerprint(data: {
    userAgent: string;
    acceptLanguage?: string;
    acceptEncoding?: string;
    screenResolution?: string;
    timezone?: string;
    platform?: string;
    plugins?: string;
    canvas?: string;
    webgl?: string;
    fonts?: string;
  }): string {
    // تجميع البيانات الثابتة
    const fingerprintData = [
      data.userAgent || '',
      data.acceptLanguage || '',
      data.platform || '',
      data.timezone || '',
      data.screenResolution || '',
      // بيانات إضافية من المتصفح
      data.plugins || '',
      data.canvas || '',
      data.webgl || '',
      data.fonts || '',
    ].join('|');

    // إنشاء hash
    return createHash('sha256').update(fingerprintData).digest('hex');
  }

  /**
   * إنشاء بصمة مبسطة من headers HTTP
   */
  generateSimpleFingerprint(headers: {
    'user-agent'?: string;
    'accept-language'?: string;
    'accept-encoding'?: string;
    'sec-ch-ua'?: string;
    'sec-ch-ua-platform'?: string;
    'sec-ch-ua-mobile'?: string;
  }): string {
    const data = [
      headers['user-agent'] || '',
      headers['accept-language'] || '',
      headers['sec-ch-ua'] || '',
      headers['sec-ch-ua-platform'] || '',
      headers['sec-ch-ua-mobile'] || '',
    ].join('|');

    return createHash('sha256').update(data).digest('hex').substring(0, 32);
  }

  /**
   * ربط بصمة بجلسة
   */
  async bindFingerprintToSession(
    sessionId: string,
    fingerprint: string,
    userId: string,
  ): Promise<void> {
    const key = `session:fingerprint:${sessionId}`;

    await this.redis.hmset(key, {
      fingerprint,
      userId,
      createdAt: Date.now().toString(),
      lastVerified: Date.now().toString(),
    });

    // انتهاء مع الجلسة (7 أيام)
    await this.redis.expire(key, 604800);

    this.logger.debug(
      `Fingerprint bound to session ${sessionId.substring(0, 8)}...`,
    );
  }

  /**
   * التحقق من بصمة الجلسة
   */
  async verifySessionFingerprint(
    sessionId: string,
    currentFingerprint: string,
  ): Promise<{
    valid: boolean;
    mismatch: boolean;
    confidence: number;
  }> {
    const key = `session:fingerprint:${sessionId}`;
    const stored = await this.redis.hgetall(key);

    if (!stored || !stored.fingerprint) {
      // لا توجد بصمة مخزنة - قد تكون جلسة قديمة
      return { valid: true, mismatch: false, confidence: 50 };
    }

    const storedFingerprint = stored.fingerprint;

    // تطابق تام
    if (storedFingerprint === currentFingerprint) {
      await this.redis.hset(key, 'lastVerified', Date.now().toString());
      return { valid: true, mismatch: false, confidence: 100 };
    }

    // حساب نسبة التشابه
    const similarity = this.calculateSimilarity(
      storedFingerprint,
      currentFingerprint,
    );

    // إذا كان التشابه عالياً (>80%) - قد يكون تحديث متصفح
    if (similarity > 80) {
      this.logger.debug(
        `Fingerprint slightly changed (${similarity}% similar)`,
      );
      return { valid: true, mismatch: false, confidence: similarity };
    }

    // تغيير كبير - محتمل سرقة جلسة
    this.logger.warn(
      `Fingerprint mismatch detected for session ${sessionId.substring(0, 8)}`,
    );
    return { valid: false, mismatch: true, confidence: similarity };
  }

  /**
   * حساب نسبة التشابه بين بصمتين
   */
  private calculateSimilarity(fp1: string, fp2: string): number {
    if (fp1 === fp2) return 100;
    if (!fp1 || !fp2) return 0;

    let matches = 0;
    const minLength = Math.min(fp1.length, fp2.length);

    for (let i = 0; i < minLength; i++) {
      if (fp1[i] === fp2[i]) matches++;
    }

    return Math.round((matches / Math.max(fp1.length, fp2.length)) * 100);
  }

  /**
   * إزالة بصمة الجلسة
   */
  async removeSessionFingerprint(sessionId: string): Promise<void> {
    await this.redis.del(`session:fingerprint:${sessionId}`);
  }

  /**
   * الحصول على جميع البصمات لمستخدم
   */
  async getUserFingerprints(userId: string): Promise<
    {
      fingerprint: string;
      firstSeen: Date;
      lastSeen: Date;
      sessionCount: number;
    }[]
  > {
    const key = `user:fingerprints:${userId}`;
    const fingerprints = await this.redis.hgetall(key);

    if (!fingerprints) return [];

    return Object.entries(fingerprints).map(([fp, data]) => {
      const parsed = JSON.parse(data as string);
      return {
        fingerprint: fp,
        firstSeen: new Date(parsed.firstSeen),
        lastSeen: new Date(parsed.lastSeen),
        sessionCount: parsed.count,
      };
    });
  }

  /**
   * تسجيل بصمة لمستخدم
   */
  async recordUserFingerprint(
    userId: string,
    fingerprint: string,
  ): Promise<void> {
    const key = `user:fingerprints:${userId}`;
    const existing = await this.redis.hget(key, fingerprint);

    if (existing) {
      const data = JSON.parse(existing);
      data.lastSeen = Date.now();
      data.count = (data.count || 0) + 1;
      await this.redis.hset(key, fingerprint, JSON.stringify(data));
    } else {
      await this.redis.hset(
        key,
        fingerprint,
        JSON.stringify({
          firstSeen: Date.now(),
          lastSeen: Date.now(),
          count: 1,
        }),
      );
    }

    // الاحتفاظ لمدة 90 يوماً
    await this.redis.expire(key, 7776000);
  }

  /**
   * التحقق من أن البصمة معروفة للمستخدم
   */
  async isKnownFingerprint(
    userId: string,
    fingerprint: string,
  ): Promise<boolean> {
    const key = `user:fingerprints:${userId}`;
    const exists = await this.redis.hexists(key, fingerprint);
    return exists === 1;
  }

  /**
   * إنشاء token للتحقق من الجهاز
   */
  async createDeviceVerificationToken(
    userId: string,
    fingerprint: string,
  ): Promise<string> {
    const token = randomBytes(32).toString('hex');
    const key = `device:verify:${token}`;

    await this.redis.hmset(key, {
      userId,
      fingerprint,
      createdAt: Date.now().toString(),
    });

    await this.redis.expire(key, 3600); // ساعة

    return token;
  }

  /**
   * التحقق من token الجهاز
   */
  async verifyDeviceToken(
    token: string,
  ): Promise<{ valid: boolean; userId?: string; fingerprint?: string }> {
    const key = `device:verify:${token}`;
    const data = await this.redis.hgetall(key);

    if (!data || !data.userId) {
      return { valid: false };
    }

    // حذف Token بعد الاستخدام
    await this.redis.del(key);

    // تسجيل البصمة كموثوقة
    await this.recordUserFingerprint(data.userId, data.fingerprint);

    return {
      valid: true,
      userId: data.userId,
      fingerprint: data.fingerprint,
    };
  }
}
