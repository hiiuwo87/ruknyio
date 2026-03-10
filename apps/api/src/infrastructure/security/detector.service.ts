import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma/prisma.service';
import { EmailService } from '../../integrations/email/email.service';
import { SecurityLogService } from './log.service';
import { createHash, randomUUID } from 'crypto';

/**
 * 🔒 Hash IP address for privacy (one-way hash)
 * يُستخدم في السجلات بدلاً من IP الفعلي
 */
function hashIpAddress(ip: string | undefined): string {
  if (!ip) return 'unknown';
  // استخدام salt ثابت للاتساق في البحث
  const salt = process.env.IP_HASH_SALT || 'rukny-security-salt';
  return createHash('sha256').update(`${salt}:${ip}`).digest('hex').substring(0, 16);
}

@Injectable()
export class SecurityDetectorService {
  constructor(
    private prisma: PrismaService,
    private emailService: EmailService,
    private securityLogService: SecurityLogService,
  ) {}

  /**
   * Check if device is new and send alert if needed
   */
  async checkNewDevice(
    userId: string,
    deviceInfo: {
      browser?: string;
      os?: string;
      deviceType?: string;
      ipAddress?: string;
      location?: string;
      userAgent?: string;
    },
  ): Promise<boolean> {
    try {
      // Get user preferences
      const preferences = await this.getOrCreatePreferences(userId);

      if (!preferences.emailOnNewDevice) {
        return false; // Alerts disabled
      }

      // Create device hash
      const deviceHash = this.createDeviceHash(deviceInfo);

      // Check if device exists
      const existingDevice = await this.prisma.trusted_devices.findUnique({
        where: {
          userId_deviceHash: {
            userId,
            deviceHash,
          },
        },
      });

      if (existingDevice) {
        // Update last used
        await this.prisma.trusted_devices.update({
          where: { id: existingDevice.id },
          data: { lastUsed: new Date() },
        });
        return false; // Known device
      }

      // New device detected!
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        return false;
      }

      // Save as trusted device
      await this.prisma.trusted_devices.create({
        data: {
          id: randomUUID(),
          userId,
          deviceHash,
          deviceName: this.getDeviceName(deviceInfo),
          browser: deviceInfo.browser,
          os: deviceInfo.os,
          deviceType: deviceInfo.deviceType || 'desktop',
          ipAddress: hashIpAddress(deviceInfo.ipAddress), // 🔒 Hash IP for privacy
          location: deviceInfo.location,
        },
      });

      // Log new device login
      await this.securityLogService.createLog({
        userId,
        action: 'NEW_DEVICE_LOGIN',
        status: 'WARNING',
        description: `تسجيل دخول من جهاز جديد: ${this.getDeviceName(deviceInfo)}`,
        ipAddress: hashIpAddress(deviceInfo.ipAddress), // 🔒 Hash IP
        location: deviceInfo.location,
        deviceType: deviceInfo.deviceType,
        browser: deviceInfo.browser,
        os: deviceInfo.os,
        userAgent: deviceInfo.userAgent,
      });

      // Get user profile for name
      const userProfile = await this.prisma.profile.findUnique({
        where: { userId: user.id },
        select: { name: true },
      });

      // Send email alert
      await this.emailService.sendNewDeviceAlert(
        user.email,
        userProfile?.name || 'User',
        {
          deviceName: this.getDeviceName(deviceInfo),
          browser: deviceInfo.browser,
          os: deviceInfo.os,
          deviceType: deviceInfo.deviceType || 'desktop',
          ipAddress: deviceInfo.ipAddress,
          location: deviceInfo.location,
          timestamp: new Date(),
        },
      );

      return true; // New device
    } catch (error) {
      console.error('Error checking new device:', error);
      return false;
    }
  }

  /**
   * Check failed login attempts and send alert if threshold exceeded
   */
  async checkFailedLoginAttempts(
    userId: string,
    ipAddress?: string,
    deviceInfo?: {
      browser?: string;
      os?: string;
      deviceType?: string;
    },
  ): Promise<void> {
    try {
      const preferences = await this.getOrCreatePreferences(userId);

      if (!preferences.emailOnFailedLogin) {
        return; // Alerts disabled
      }

      // Count failed attempts in the time window
      const timeWindow = new Date(
        Date.now() - preferences.failedLoginTimeWindow * 60 * 1000,
      );

      const failedAttempts = await this.prisma.securityLog.count({
        where: {
          userId,
          action: 'LOGIN_FAILED',
          ipAddress,
          createdAt: {
            gte: timeWindow,
          },
        },
      });

      // Check if threshold exceeded
      if (failedAttempts >= preferences.failedLoginThreshold) {
        const user = await this.prisma.user.findUnique({
          where: { id: userId },
        });

        if (!user) {
          return;
        }

        // Log threshold exceeded
        await this.securityLogService.createLog({
          userId,
          action: 'FAILED_LOGIN_THRESHOLD',
          status: 'WARNING',
          description: `تم تجاوز حد محاولات تسجيل الدخول الفاشلة (${failedAttempts} محاولات)`,
          ipAddress,
          deviceType: deviceInfo?.deviceType,
          browser: deviceInfo?.browser,
          os: deviceInfo?.os,
        });

        // Send email alert
        const userProfileForAlert = await this.prisma.profile.findUnique({
          where: { userId: user.id },
          select: { name: true },
        });
        await this.emailService.sendFailedLoginAlert(
          user.email,
          userProfileForAlert?.name || 'User',
          {
            failedAttempts,
            ipAddress,
            timeWindow: preferences.failedLoginTimeWindow,
            timestamp: new Date(),
          },
        );

        // Auto-block IP if enabled
        if (preferences.autoBlockSuspiciousIp) {
          await this.autoBlockIp(userId, ipAddress, failedAttempts);
        }
      }
    } catch (error) {
      console.error('Error checking failed login attempts:', error);
    }
  }

  /**
   * Auto-block suspicious IP address
   */
  private async autoBlockIp(
    userId: string,
    ipAddress: string,
    failedAttempts: number,
  ): Promise<void> {
    try {
      // Check if already blocked
      const existing = await this.prisma.ip_blocklist.findUnique({
        where: {
          userId_ipAddress: {
            userId,
            ipAddress,
          },
        },
      });

      if (existing) {
        // Update failed attempts
        await this.prisma.ip_blocklist.update({
          where: { id: existing.id },
          data: {
            failedAttempts,
            isActive: true,
            updatedAt: new Date(),
          },
        });
      } else {
        // Create new block entry
        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + 24); // Block for 24 hours

        await this.prisma.ip_blocklist.create({
          data: {
            id: randomUUID(),
            userId,
            ipAddress,
            reason: `محاولات دخول فاشلة متعددة (${failedAttempts} محاولات)`,
            blockType: 'AUTO_FAILED_LOGIN',
            failedAttempts,
            expiresAt,
            updatedAt: new Date(),
          },
        });
      }

      console.log(`🚫 Auto-blocked IP: ${ipAddress} for user: ${userId}`);
    } catch (error) {
      console.error('Error auto-blocking IP:', error);
    }
  }

  /**
   * Get or create security preferences for user
   */
  async getOrCreatePreferences(userId: string) {
    let preferences = await this.prisma.security_preferences.findUnique({
      where: { userId },
    });

    if (!preferences) {
      // Create default preferences
      preferences = await this.prisma.security_preferences.create({
        data: {
          id: randomUUID(),
          userId,
          emailOnNewDevice: true,
          emailOnPasswordChange: true,
          emailOnFailedLogin: true,
          emailOnEmailChange: true,
          emailOn2FAChange: true,
          emailOnSuspiciousActivity: true,
          failedLoginThreshold: 3,
          failedLoginTimeWindow: 15,
          autoBlockSuspiciousIp: false,
          updatedAt: new Date(),
        },
      });
    }

    return preferences;
  }

  /**
   * Create device hash for uniqueness
   */
  private createDeviceHash(deviceInfo: {
    browser?: string;
    os?: string;
    deviceType?: string;
  }): string {
    const hashString = `${deviceInfo.browser || 'unknown'}-${deviceInfo.os || 'unknown'}-${deviceInfo.deviceType || 'desktop'}`;
    return createHash('sha256').update(hashString).digest('hex');
  }

  /**
   * Get human-readable device name
   */
  private getDeviceName(deviceInfo: {
    browser?: string;
    os?: string;
    deviceType?: string;
  }): string {
    const parts = [];

    if (deviceInfo.browser) parts.push(deviceInfo.browser);
    if (deviceInfo.os) parts.push(deviceInfo.os);
    if (deviceInfo.deviceType && deviceInfo.deviceType !== 'desktop') {
      parts.push(deviceInfo.deviceType);
    }

    return parts.length > 0 ? parts.join(' - ') : 'Unknown Device';
  }

  /**
   * Get user's security preferences
   */
  async getPreferences(userId: string) {
    return this.getOrCreatePreferences(userId);
  }

  /**
   * Update user's security preferences
   */
  async updatePreferences(
    userId: string,
    data: Partial<{
      emailOnNewDevice: boolean;
      emailOnPasswordChange: boolean;
      emailOnFailedLogin: boolean;
      emailOnEmailChange: boolean;
      emailOn2FAChange: boolean;
      emailOnSuspiciousActivity: boolean;
      failedLoginThreshold: number;
      failedLoginTimeWindow: number;
      autoBlockSuspiciousIp: boolean;
    }>,
  ) {
    // Ensure preferences exist
    await this.getOrCreatePreferences(userId);

    return this.prisma.security_preferences.update({
      where: { userId },
      data: {
        ...data,
        updatedAt: new Date(),
      },
    });
  }

  /**
   * تذكر هذا الجهاز (2FA): إنشاء أو تحديث جهاز موثوق مع صلاحية 30 يوم
   * يُستدعى بعد نجاح التحقق من 2FA عند اختيار "تذكر هذا الجهاز"
   */
  async rememberDeviceFor2FA(
    userId: string,
    deviceInfo: {
      browser?: string;
      os?: string;
      deviceType?: string;
      ipAddress?: string;
      userAgent?: string;
    },
  ): Promise<string> {
    const deviceHash = this.createDeviceHash(deviceInfo);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 يوم

    const existing = await this.prisma.trusted_devices.findUnique({
      where: { userId_deviceHash: { userId, deviceHash } },
      select: { id: true },
    });

    if (existing) {
      await this.prisma.trusted_devices.update({
        where: { id: existing.id },
        data: { lastUsed: now, expiresAt },
      });
      return existing.id;
    }

    const id = randomUUID();
    await this.prisma.trusted_devices.create({
      data: {
        id,
        userId,
        deviceHash,
        deviceName: this.getDeviceName(deviceInfo),
        browser: deviceInfo.browser,
        os: deviceInfo.os,
        deviceType: deviceInfo.deviceType || 'desktop',
        ipAddress: deviceInfo.ipAddress,
        expiresAt,
      },
    });
    return id;
  }

  /**
   * التحقق من جهاز موثوق بالمعرف (للتخطي الآمن لـ 2FA)
   */
  async findTrustedDeviceById(deviceId: string, userId: string): Promise<{ id: string } | null> {
    const device = await this.prisma.trusted_devices.findFirst({
      where: {
        id: deviceId,
        userId,
        trusted: true,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      select: { id: true },
    });
    return device;
  }

  /**
   * Get user's trusted devices
   */
  async getTrustedDevices(userId: string) {
    return this.prisma.trusted_devices.findMany({
      where: { userId },
      orderBy: { lastUsed: 'desc' },
    });
  }

  /**
   * Remove a trusted device
   */
  async removeTrustedDevice(userId: string, deviceId: string) {
    const device = await this.prisma.trusted_devices.findUnique({
      where: { id: deviceId },
    });

    if (!device || device.userId !== userId) {
      throw new Error('Device not found');
    }

    await this.prisma.trusted_devices.delete({
      where: { id: deviceId },
    });

    return { message: 'Device removed successfully' };
  }
}
