import {
  Injectable,
  BadRequestException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../core/database/prisma/prisma.service';
import { hashIP, compareIP, isIPInList, maskIP } from '../../core/common/utils/ip-hash.util';

/**
 * 🔐 خدمة مراقبة تسجيل الدخول من IP جديد
 * 
 * الميزات:
 * - تخزين IP كـ HMAC-SHA256 fingerprint (لا يمكن استخراج IP الأصلي)
 * - إرسال تنبيه بريدي عند تسجيل الدخول من IP جديد
 * - قائمة IPs موثوقة (لا ترسل تنبيه عنها)
 * 
 * ملاحظة: تم إلغاء ميزة التحقق من IP لأن 2FA كافٍ
 */
@Injectable()
export class IpVerificationService {
  constructor(private prisma: PrismaService) {}

  // ===================== إعدادات الأمان =====================

  /**
   * الحصول على إعدادات الأمان للمستخدم
   */
  async getSecurityPreferences(userId: string) {
    const prefs = await this.prisma.security_preferences.findUnique({
      where: { userId },
    });

    return {
      alertOnNewIP: prefs?.alertOnNewIP ?? true,
      trustedIpFingerprints: prefs?.trustedIpFingerprints ?? [],
    };
  }

  /**
   * التحقق مما إذا كان IP موثوقاً للمستخدم
   */
  async isIPTrusted(userId: string, ipAddress: string): Promise<boolean> {
    const prefs = await this.getSecurityPreferences(userId);
    return isIPInList(ipAddress, prefs.trustedIpFingerprints);
  }

  /**
   * إضافة IP للقائمة الموثوقة (يُخزن كـ fingerprint)
   */
  async addTrustedIP(userId: string, ipAddress: string): Promise<void> {
    const fingerprint = hashIP(ipAddress);
    
    const prefs = await this.prisma.security_preferences.findUnique({
      where: { userId },
    });

    if (prefs) {
      const trustedFingerprints = prefs.trustedIpFingerprints || [];
      // التحقق من عدم وجود الـ fingerprint مسبقاً
      if (!trustedFingerprints.includes(fingerprint)) {
        await this.prisma.security_preferences.update({
          where: { userId },
          data: {
            trustedIpFingerprints: [...trustedFingerprints, fingerprint],
            updatedAt: new Date(),
          },
        });
      }
    } else {
      // إنشاء إعدادات جديدة مع IP موثوق
      await this.prisma.security_preferences.create({
        data: {
          id: randomUUID(),
          userId,
          trustedIpFingerprints: [fingerprint],
          updatedAt: new Date(),
        },
      });
    }
  }

  /**
   * إزالة IP من القائمة الموثوقة
   */
  async removeTrustedIP(userId: string, ipFingerprint: string): Promise<void> {
    const prefs = await this.prisma.security_preferences.findUnique({
      where: { userId },
    });

    if (prefs && prefs.trustedIpFingerprints) {
      await this.prisma.security_preferences.update({
        where: { userId },
        data: {
          trustedIpFingerprints: prefs.trustedIpFingerprints.filter(fp => fp !== ipFingerprint),
          updatedAt: new Date(),
        },
      });
    }
  }

  // ===================== فحص تغيير IP =====================

  /**
   * التحقق مما إذا كان يجب إرسال تنبيه عند تسجيل الدخول
   * 
   * @returns object يحتوي على:
   *   - shouldAlert: هل يجب إرسال تنبيه
   *   - isNewIP: هل هذا IP جديد
   *   - maskedIP: IP مُخفى للعرض في التنبيه
   */
  async checkLoginIP(
    userId: string, 
    currentIP: string
  ): Promise<{
    shouldAlert: boolean;
    isNewIP: boolean;
    maskedIP: string;
  }> {
    const currentFingerprint = hashIP(currentIP);
    const maskedIP = maskIP(currentIP);

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { lastKnownIpFingerprint: true },
    });

    // إذا لم يكن هناك IP مسجل سابقاً، لا ترسل تنبيه (أول تسجيل دخول)
    if (!user || !user.lastKnownIpFingerprint) {
      return { 
        shouldAlert: false, 
        isNewIP: true,
        maskedIP 
      };
    }

    // التحقق مما إذا كان IP تغير
    const ipChanged = !compareIP(currentIP, user.lastKnownIpFingerprint);
    
    if (!ipChanged) {
      return { 
        shouldAlert: false, 
        isNewIP: false,
        maskedIP 
      };
    }

    // الحصول على إعدادات الأمان
    const prefs = await this.getSecurityPreferences(userId);

    // التحقق مما إذا كان IP موثوقاً
    if (isIPInList(currentIP, prefs.trustedIpFingerprints)) {
      return { 
        shouldAlert: false, 
        isNewIP: true,
        maskedIP 
      };
    }

    return {
      shouldAlert: prefs.alertOnNewIP,
      isNewIP: true,
      maskedIP,
    };
  }

  // ===================== تحديث IP =====================

  /**
   * الحصول على fingerprint آخر IP معروف للمستخدم
   */
  async getLastKnownIPFingerprint(userId: string): Promise<string | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { lastKnownIpFingerprint: true },
    });

    return user?.lastKnownIpFingerprint || null;
  }

  /**
   * تحديث آخر IP معروف للمستخدم (يُخزن كـ fingerprint)
   */
  async updateLastKnownIP(userId: string, ipAddress: string): Promise<void> {
    const fingerprint = hashIP(ipAddress);
    
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        lastKnownIpFingerprint: fingerprint,
        lastLoginIpFingerprint: fingerprint,
        lastLoginAt: new Date(),
      },
    });
  }

  // ===================== إعدادات التنبيهات =====================

  /**
   * تفعيل/تعطيل التنبيه عند IP جديد
   */
  async setAlertOnNewIP(userId: string, enabled: boolean): Promise<void> {
    await this.upsertSecurityPreferences(userId, { alertOnNewIP: enabled });
  }

  /**
   * الحصول على إعدادات التنبيهات
   */
  async getAlertSettings(userId: string) {
    const prefs = await this.getSecurityPreferences(userId);
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { lastLoginAt: true },
    });

    return {
      alertOnNewIP: prefs.alertOnNewIP,
      trustedIpCount: prefs.trustedIpFingerprints.length,
      lastLoginAt: user?.lastLoginAt,
    };
  }

  /**
   * تحديث إعدادات التنبيهات
   */
  async updateAlertSettings(
    userId: string,
    settings: { alertOnNewIP?: boolean }
  ): Promise<void> {
    await this.upsertSecurityPreferences(userId, settings);
  }

  // ===================== إدارة IPs الموثوقة =====================

  /**
   * الحصول على عدد IPs الموثوقة
   */
  async getTrustedIPCount(userId: string): Promise<number> {
    const prefs = await this.getSecurityPreferences(userId);
    return prefs.trustedIpFingerprints.length;
  }

  /**
   * إضافة IP الحالي للقائمة الموثوقة
   */
  async addCurrentIPToTrusted(userId: string, currentIP: string): Promise<{ 
    success: boolean; 
    fingerprint?: string;
    maskedIP?: string;
  }> {
    try {
      const fingerprint = hashIP(currentIP);
      await this.addTrustedIP(userId, currentIP);
      return { 
        success: true, 
        fingerprint,
        maskedIP: maskIP(currentIP)
      };
    } catch (error) {
      return { success: false };
    }
  }

  /**
   * الحصول على قائمة fingerprints الموثوقة
   * ملاحظة: لا يمكن استرجاع IPs الأصلية من الـ fingerprints
   */
  async getTrustedIPFingerprints(userId: string): Promise<string[]> {
    const prefs = await this.getSecurityPreferences(userId);
    return prefs.trustedIpFingerprints;
  }

  /**
   * مسح جميع IPs الموثوقة
   */
  async clearTrustedIPs(userId: string): Promise<void> {
    await this.prisma.security_preferences.update({
      where: { userId },
      data: {
        trustedIpFingerprints: [],
        updatedAt: new Date(),
      },
    });
  }

  // ===================== مساعدات =====================

  /**
   * مساعد: تحديث أو إنشاء إعدادات الأمان
   */
  private async upsertSecurityPreferences(
    userId: string,
    data: Partial<{
      alertOnNewIP: boolean;
      trustedIpFingerprints: string[];
    }>
  ): Promise<void> {
    const existing = await this.prisma.security_preferences.findUnique({
      where: { userId },
    });

    if (existing) {
      await this.prisma.security_preferences.update({
        where: { userId },
        data: {
          ...data,
          updatedAt: new Date(),
        },
      });
    } else {
      await this.prisma.security_preferences.create({
        data: {
          id: randomUUID(),
          userId,
          ...data,
          updatedAt: new Date(),
        },
      });
    }
  }

  /**
   * التحقق مما إذا كان IP الحالي موثوقاً
   */
  async isCurrentIPTrusted(userId: string, currentIP: string): Promise<boolean> {
    return this.isIPTrusted(userId, currentIP);
  }

  /**
   * إخفاء IP للعرض (Utility)
   */
  getMaskedIP(ipAddress: string): string {
    return maskIP(ipAddress);
  }

  // ===================== التحقق من الرموز =====================

  /**
   * التحقق من رمز التحقق (IP change, 2FA, etc.)
   */
  async verifyCode(
    userId: string,
    code: string,
    type: string,
  ): Promise<boolean> {
    const verification = await this.prisma.verification_codes.findFirst({
      where: {
        userId,
        code,
        type: type as any,
        verified: false,
        expiresAt: { gt: new Date() },
      },
    });

    if (!verification) {
      // زيادة عداد المحاولات الفاشلة
      await this.prisma.verification_codes.updateMany({
        where: {
          userId,
          type: type as any,
          verified: false,
        },
        data: {
          attempts: { increment: 1 },
        },
      });
      return false;
    }

    // تحديث الرمز كمُستخدم
    await this.prisma.verification_codes.update({
      where: { id: verification.id },
      data: {
        verified: true,
        verifiedAt: new Date(),
      },
    });

    return true;
  }

  /**
   * تنظيف الرموز المنتهية الصلاحية
   */
  async cleanupExpiredCodes(): Promise<number> {
    const result = await this.prisma.verification_codes.deleteMany({
      where: {
        expiresAt: { lt: new Date() },
      },
    });

    return result.count;
  }
}
