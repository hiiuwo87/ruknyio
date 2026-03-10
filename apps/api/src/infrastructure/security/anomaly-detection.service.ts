import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma/prisma.service';
import { RedisService } from '../../core/cache/redis.service';
import { SecurityLogService } from './log.service';
import { createHash } from 'crypto';

/**
 * 🔍 Anomaly Detection Service
 *
 * كشف السلوك المشبوه والأنشطة غير الطبيعية:
 * - تسجيل دخول من موقع جغرافي مختلف
 * - تغيير سريع في الـ IP
 * - نمط استخدام غير طبيعي
 * - محاولات متعددة من أجهزة مختلفة
 */
@Injectable()
export class AnomalyDetectionService {
  private readonly logger = new Logger(AnomalyDetectionService.name);

  private readonly CONFIG = {
    // تغيير الموقع المشبوه
    LOCATION_CHANGE_THRESHOLD_HOURS: 2, // إذا تغير البلد خلال ساعتين
    MIN_TRAVEL_TIME_HOURS: 3, // أقل وقت للسفر بين البلدان

    // أنماط مشبوهة
    MAX_DIFFERENT_IPS_PER_HOUR: 5,
    MAX_DIFFERENT_DEVICES_PER_DAY: 3,
    MAX_FAILED_ATTEMPTS_PATTERN: 10,

    // تنبيهات
    ALERT_COOLDOWN_MINUTES: 30, // تجنب تكرار التنبيهات
  };

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly securityLogService: SecurityLogService,
  ) {}

  /**
   * تحليل تسجيل الدخول للكشف عن الأنشطة المشبوهة
   */
  async analyzeLogin(
    userId: string,
    loginData: {
      ipAddress: string;
      country?: string;
      city?: string;
      deviceFingerprint?: string;
      userAgent?: string;
    },
  ): Promise<{
    suspicious: boolean;
    reasons: string[];
    riskScore: number;
    action: 'allow' | 'challenge' | 'block';
  }> {
    const reasons: string[] = [];
    let riskScore = 0;

    try {
      // 1. فحص تغيير الموقع السريع
      const locationAnomaly = await this.checkLocationAnomaly(
        userId,
        loginData.country,
        loginData.city,
      );
      if (locationAnomaly.suspicious) {
        reasons.push(locationAnomaly.reason);
        riskScore += locationAnomaly.score;
      }

      // 2. فحص تعدد عناوين IP
      const ipAnomaly = await this.checkIpAnomaly(userId, loginData.ipAddress);
      if (ipAnomaly.suspicious) {
        reasons.push(ipAnomaly.reason);
        riskScore += ipAnomaly.score;
      }

      // 3. فحص تعدد الأجهزة
      const deviceAnomaly = await this.checkDeviceAnomaly(
        userId,
        loginData.deviceFingerprint,
      );
      if (deviceAnomaly.suspicious) {
        reasons.push(deviceAnomaly.reason);
        riskScore += deviceAnomaly.score;
      }

      // 4. فحص نمط المحاولات الفاشلة
      const failedPattern = await this.checkFailedPattern(userId);
      if (failedPattern.suspicious) {
        reasons.push(failedPattern.reason);
        riskScore += failedPattern.score;
      }

      // 5. فحص وقت تسجيل الدخول غير المعتاد
      const timeAnomaly = await this.checkTimeAnomaly(userId);
      if (timeAnomaly.suspicious) {
        reasons.push(timeAnomaly.reason);
        riskScore += timeAnomaly.score;
      }

      // تحديد الإجراء بناءً على مستوى الخطر
      let action: 'allow' | 'challenge' | 'block' = 'allow';
      if (riskScore >= 80) {
        action = 'block';
      } else if (riskScore >= 40) {
        action = 'challenge';
      }

      // تسجيل النشاط المشبوه
      if (reasons.length > 0) {
        await this.logSuspiciousActivity(userId, reasons, riskScore, loginData);
      }

      // تحديث سجل المواقع
      await this.updateLocationHistory(
        userId,
        loginData.ipAddress,
        loginData.country,
        loginData.city,
      );

      return {
        suspicious: reasons.length > 0,
        reasons,
        riskScore: Math.min(100, riskScore),
        action,
      };
    } catch (error) {
      this.logger.error(`Anomaly detection failed: ${error.message}`);
      return { suspicious: false, reasons: [], riskScore: 0, action: 'allow' };
    }
  }

  /**
   * فحص تغيير الموقع الجغرافي السريع
   */
  private async checkLocationAnomaly(
    userId: string,
    country?: string,
    city?: string,
  ): Promise<{ suspicious: boolean; reason: string; score: number }> {
    if (!country) {
      return { suspicious: false, reason: '', score: 0 };
    }

    const lastLocationKey = `anomaly:location:${userId}`;
    const lastLocation = await this.redis.get(lastLocationKey);

    if (lastLocation) {
      const { country: lastCountry, timestamp } = JSON.parse(lastLocation);
      const hoursSinceLastLogin =
        (Date.now() - timestamp) / (1000 * 60 * 60);

      if (
        lastCountry !== country &&
        hoursSinceLastLogin < this.CONFIG.MIN_TRAVEL_TIME_HOURS
      ) {
        return {
          suspicious: true,
          reason: `تسجيل دخول من ${country} بعد ${lastCountry} خلال ${Math.round(hoursSinceLastLogin * 60)} دقيقة (مستحيل فيزيائياً)`,
          score: 50,
        };
      }
    }

    return { suspicious: false, reason: '', score: 0 };
  }

  /**
   * فحص تعدد عناوين IP
   */
  private async checkIpAnomaly(
    userId: string,
    ipAddress: string,
  ): Promise<{ suspicious: boolean; reason: string; score: number }> {
    const ipKey = `anomaly:ips:${userId}`;
    const ipHash = createHash('sha256').update(ipAddress).digest('hex').substring(0, 16);

    // إضافة IP للمجموعة
    await this.redis.sadd(ipKey, ipHash);
    await this.redis.expire(ipKey, 3600); // ساعة

    const uniqueIps = await this.redis.scard(ipKey);

    if (uniqueIps > this.CONFIG.MAX_DIFFERENT_IPS_PER_HOUR) {
      return {
        suspicious: true,
        reason: `${uniqueIps} عناوين IP مختلفة خلال ساعة`,
        score: 30,
      };
    }

    return { suspicious: false, reason: '', score: 0 };
  }

  /**
   * فحص تعدد الأجهزة
   */
  private async checkDeviceAnomaly(
    userId: string,
    fingerprint?: string,
  ): Promise<{ suspicious: boolean; reason: string; score: number }> {
    if (!fingerprint) {
      return { suspicious: false, reason: '', score: 0 };
    }

    const deviceKey = `anomaly:devices:${userId}`;

    await this.redis.sadd(deviceKey, fingerprint);
    await this.redis.expire(deviceKey, 86400); // يوم

    const uniqueDevices = await this.redis.scard(deviceKey);

    if (uniqueDevices > this.CONFIG.MAX_DIFFERENT_DEVICES_PER_DAY) {
      return {
        suspicious: true,
        reason: `${uniqueDevices} أجهزة مختلفة خلال يوم`,
        score: 25,
      };
    }

    return { suspicious: false, reason: '', score: 0 };
  }

  /**
   * فحص نمط المحاولات الفاشلة
   */
  private async checkFailedPattern(
    userId: string,
  ): Promise<{ suspicious: boolean; reason: string; score: number }> {
    const recentFailed = await this.prisma.securityLog.count({
      where: {
        userId,
        action: 'LOGIN_FAILED',
        createdAt: {
          gte: new Date(Date.now() - 3600000), // ساعة
        },
      },
    });

    if (recentFailed >= this.CONFIG.MAX_FAILED_ATTEMPTS_PATTERN) {
      return {
        suspicious: true,
        reason: `${recentFailed} محاولات دخول فاشلة خلال ساعة`,
        score: 35,
      };
    }

    return { suspicious: false, reason: '', score: 0 };
  }

  /**
   * فحص وقت تسجيل الدخول غير المعتاد
   */
  private async checkTimeAnomaly(
    userId: string,
  ): Promise<{ suspicious: boolean; reason: string; score: number }> {
    // الحصول على أوقات الدخول المعتادة
    const usualHoursKey = `anomaly:hours:${userId}`;
    const currentHour = new Date().getHours();

    // تسجيل الساعة الحالية
    await this.redis.hincrby(usualHoursKey, currentHour.toString(), 1);
    await this.redis.expire(usualHoursKey, 2592000); // شهر

    // الحصول على التوزيع
    const hourStats = await this.redis.hgetall(usualHoursKey);
    if (!hourStats || Object.keys(hourStats).length < 10) {
      // لا توجد بيانات كافية
      return { suspicious: false, reason: '', score: 0 };
    }

    const totalLogins = Object.values(hourStats).reduce<number>(
      (sum, val) => sum + parseInt(val as string, 10),
      0,
    );
    const currentHourLogins = parseInt(hourStats[currentHour] || '0', 10);
    const percentage = (currentHourLogins / (totalLogins as number)) * 100;

    // إذا كانت هذه الساعة نادرة جداً (<1%)
    if (percentage < 1 && (totalLogins as number) > 20) {
      return {
        suspicious: true,
        reason: `تسجيل دخول في وقت غير معتاد (${currentHour}:00)`,
        score: 15,
      };
    }

    return { suspicious: false, reason: '', score: 0 };
  }

  /**
   * تحديث سجل المواقع
   */
  private async updateLocationHistory(
    userId: string,
    ipAddress: string,
    country?: string,
    city?: string,
  ): Promise<void> {
    const key = `anomaly:location:${userId}`;
    await this.redis.set(
      key,
      JSON.stringify({
        ipAddress,
        country,
        city,
        timestamp: Date.now(),
      }),
      86400 * 7, // أسبوع
    );
  }

  /**
   * تسجيل النشاط المشبوه
   */
  private async logSuspiciousActivity(
    userId: string,
    reasons: string[],
    riskScore: number,
    loginData: any,
  ): Promise<void> {
    // تحقق من cooldown
    const cooldownKey = `anomaly:alert:${userId}`;
    const recentAlert = await this.redis.get(cooldownKey);
    if (recentAlert) {
      return; // تجنب تكرار التنبيهات
    }

    // تسجيل في السجلات
    await this.securityLogService.createLog({
      userId,
      action: 'SUSPICIOUS_ACTIVITY',
      status: 'WARNING',
      description: `نشاط مشبوه (خطورة: ${riskScore}%): ${reasons.join('، ')}`,
      ipAddress: loginData.ipAddress,
      metadata: { reasons, riskScore },
    });

    // إرسال تنبيه
    if (riskScore >= 40) {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { email: true },
      });

      if (user?.email) {
        // TODO: Implement email notification for suspicious activity
        this.logger.warn(
          `Suspicious activity for ${user.email}: ${reasons.join(', ')} (risk: ${riskScore})`,
        );
      }
    }

    // تعيين cooldown
    await this.redis.setex(
      cooldownKey,
      this.CONFIG.ALERT_COOLDOWN_MINUTES * 60,
      '1',
    );
  }

  /**
   * الحصول على تقرير الأنشطة المشبوهة لمستخدم
   */
  async getUserAnomalyReport(userId: string): Promise<{
    recentAlerts: number;
    uniqueIpsToday: number;
    uniqueDevicesToday: number;
    riskLevel: 'low' | 'medium' | 'high';
  }> {
    const [alerts, ips, devices] = await Promise.all([
      this.prisma.securityLog.count({
        where: {
          userId,
          action: 'SUSPICIOUS_ACTIVITY',
          createdAt: { gte: new Date(Date.now() - 86400000) },
        },
      }),
      this.redis.scard(`anomaly:ips:${userId}`),
      this.redis.scard(`anomaly:devices:${userId}`),
    ]);

    let riskLevel: 'low' | 'medium' | 'high' = 'low';
    if (alerts >= 3 || ips >= 5 || devices >= 4) {
      riskLevel = 'high';
    } else if (alerts >= 1 || ips >= 3 || devices >= 2) {
      riskLevel = 'medium';
    }

    return {
      recentAlerts: alerts,
      uniqueIpsToday: ips,
      uniqueDevicesToday: devices,
      riskLevel,
    };
  }
}
