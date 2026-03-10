import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma/prisma.service';
import { SecurityLogService } from '../../infrastructure/security/log.service';
import { EmailService } from '../../integrations/email/email.service';
import { SecurityDetectorService } from '../../infrastructure/security/detector.service';
import { NotificationsGateway } from '../notifications/notifications.gateway';
import { RedisService } from '../../core/cache/redis.service';
import { generateSecret, generateURI, verifySync } from 'otplib';
import * as qrcode from 'qrcode';
import {
  UpdateProfileDto,
  SessionResponseDto,
  ChangeEmailDto,
  UpdateSecurityPreferencesDto,
  DeactivateAccountDto,
  DeleteAccountDto,
} from './dto';

@Injectable()
export class UserService {
  constructor(
    private prisma: PrismaService,
    private securityLogService: SecurityLogService,
    private emailService: EmailService,
    private securityDetectorService: SecurityDetectorService,
    private notificationsGateway: NotificationsGateway,
    private redisService: RedisService,
  ) {}

  // Get user profile
  async getProfile(userId: string) {
    const cacheKey = `user:profile:${userId}`;
    const cached = await this.redisService.get(cacheKey);
    if (cached) return cached;

    const result = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        phone: true,
        role: true,
        twoFactorEnabled: true,
        emailVerified: true,
        createdAt: true,
        updatedAt: true,
        profile: {
          select: {
            name: true,
            username: true,
            avatar: true,
            bio: true,
            coverImage: true,
          },
        },
      },
    });

    await this.redisService.set(cacheKey, result, 60);
    return result;
  }

  // Update user profile
  async updateProfile(userId: string, updateData: UpdateProfileDto) {
    // Check if email is being changed and if it's already in use
    if (updateData.email) {
      const existingUser = await this.prisma.user.findUnique({
        where: { email: updateData.email },
      });

      if (existingUser && existingUser.id !== userId) {
        throw new BadRequestException('Email already in use');
      }
    }

    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: {
        phone: updateData.phone,
        updatedAt: new Date(),
        profile:
          updateData.name || updateData.avatar
            ? {
                update: {
                  ...(updateData.name && { name: updateData.name }),
                  ...(updateData.avatar && { avatar: updateData.avatar }),
                },
              }
            : undefined,
      },
      select: {
        id: true,
        email: true,
        phone: true,
        role: true,
        twoFactorEnabled: true,
        emailVerified: true,
        profile: {
          select: {
            name: true,
            username: true,
            avatar: true,
          },
        },
      },
    });

    // Log profile update
    const changes = Object.keys(updateData).join(', ');
    await this.securityLogService.createLog({
      userId,
      action: 'PROFILE_UPDATE',
      status: 'SUCCESS',
      description: `تحديث الملف الشخصي: ${changes}`,
    });

    // إرسال إشعار بتحديث الملف الشخصي
    await this.notificationsGateway.sendNotification({
      userId,
      type: 'SYSTEM',
      title: 'تم تحديث الملف الشخصي',
      message: `تم تحديث بياناتك الشخصية بنجاح: ${changes}`,
    });

    return updatedUser;
  }

  // Setup 2FA - Step 1: Generate QR Code
  async setup2FA(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    // Generate secret using otplib
    const secret = generateSecret();
    const otpauthUrl = generateURI({ issuer: 'Rukny.io', label: user.email, secret });

    // Save secret temporarily (not enabled yet)
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        twoFactorSecret: secret,
        updatedAt: new Date(),
      },
      select: { id: true, twoFactorSecret: true },
    });

    // Generate QR Code
    const qrCodeUrl = await qrcode.toDataURL(otpauthUrl);

    return {
      secret: secret,
      qrCode: qrCodeUrl,
    };
  }

  // Verify 2FA - Step 2: Verify code and enable
  async verify2FA(userId: string, code: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        profile: {
          select: { name: true },
        },
      },
    });

    if (!user || !user.twoFactorSecret) {
      throw new BadRequestException('2FA setup not initiated');
    }

    // Verify code using otplib
    const result = verifySync({ token: code, secret: user.twoFactorSecret });

    if (!result.valid) {
      // Log failed 2FA verification
      await this.securityLogService.createLog({
        userId,
        action: 'TWO_FA_VERIFIED',
        status: 'FAILED',
        description: `محاولة فاشلة للتحقق من رمز 2FA`,
      });
      throw new BadRequestException('Invalid verification code');
    }

    // Enable 2FA
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        twoFactorEnabled: true,
        updatedAt: new Date(),
      },
      select: { id: true, twoFactorEnabled: true },
    });

    // Log 2FA enabled
    await this.securityLogService.createLog({
      userId,
      action: 'TWO_FA_ENABLED',
      status: 'SUCCESS',
      description: `تم تفعيل المصادقة الثنائية`,
    });

    // إرسال إشعار بتفعيل المصادقة الثنائية
    await this.notificationsGateway.sendNotification({
      userId,
      type: 'TWO_FACTOR_ENABLED',
      title: 'تم تفعيل المصادقة الثنائية ✅',
      message:
        'تم تفعيل المصادقة الثنائية على حسابك بنجاح. حسابك الآن أكثر أماناً!',
    });

    // Send email notification
    await this.emailService.sendSecurityAlert(
      user.email,
      user.profile?.name || 'مستخدم',
      {
        action: 'TWO_FA_ENABLED',
        actionArabic: 'تفعيل المصادقة الثنائية',
        description: 'تم تفعيل المصادقة الثنائية على حسابك بنجاح',
        timestamp: new Date(),
      },
    );

    return { message: '2FA enabled successfully' };
  }

  // Disable 2FA
  async disable2FA(userId: string, code: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        profile: {
          select: { name: true },
        },
      },
    });

    if (!user || !user.twoFactorEnabled) {
      throw new BadRequestException('2FA is not enabled');
    }

    // Verify code before disabling using otplib
    const result = verifySync({ token: code, secret: user.twoFactorSecret });

    if (!result.valid) {
      // Log failed 2FA disable attempt
      await this.securityLogService.createLog({
        userId,
        action: 'TWO_FA_DISABLED',
        status: 'FAILED',
        description: `محاولة فاشلة لتعطيل المصادقة الثنائية - رمز خاطئ`,
      });
      throw new BadRequestException('Invalid verification code');
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        twoFactorEnabled: false,
        twoFactorSecret: null,
        updatedAt: new Date(),
      },
      select: { id: true, twoFactorEnabled: true, twoFactorSecret: true },
    });

    // Log 2FA disabled
    await this.securityLogService.createLog({
      userId,
      action: 'TWO_FA_DISABLED',
      status: 'SUCCESS',
      description: `تم تعطيل المصادقة الثنائية`,
    });

    // إرسال إشعار بتعطيل المصادقة الثنائية
    await this.notificationsGateway.sendNotification({
      userId,
      type: 'TWO_FACTOR_DISABLED',
      title: 'تم تعطيل المصادقة الثنائية ⚠️',
      message:
        'تم تعطيل المصادقة الثنائية على حسابك. ننصحك بإعادة تفعيلها لمزيد من الأمان.',
    });

    // Send email notification
    await this.emailService.sendSecurityAlert(
      user.email,
      user.profile?.name || 'مستخدم',
      {
        action: 'TWO_FA_DISABLED',
        actionArabic: 'تعطيل المصادقة الثنائية',
        description: 'تم تعطيل المصادقة الثنائية على حسابك',
        timestamp: new Date(),
      },
    );

    return { message: '2FA disabled successfully' };
  }

  // Get all active sessions for user
  // currentSessionId يُستخرج من JWT (payload.sid)
  async getSessions(
    userId: string,
    currentSessionId?: string,
  ): Promise<SessionResponseDto[]> {
    const sessions = await this.prisma.session.findMany({
      where: {
        userId,
        isRevoked: false,
      },
      orderBy: {
        lastActivity: 'desc',
      },
    });

    return sessions.map((session) => ({
      id: session.id,
      deviceName: session.deviceName,
      deviceType: session.deviceType,
      browser: session.browser,
      os: session.os,
      ipAddress: session.ipAddress,
      location: session.location,
      lastActivity: session.lastActivity,
      createdAt: session.createdAt,
      isCurrent: !!currentSessionId && session.id === currentSessionId,
    }));
  }

  // Delete specific session (logout from device)
  async deleteSession(
    userId: string,
    sessionId: string,
    currentSessionId?: string,
  ) {
    const session = await this.prisma.session.findUnique({
      where: { id: sessionId },
    });

    if (!session || session.userId !== userId) {
      throw new BadRequestException('Session not found');
    }

    if (currentSessionId && session.id === currentSessionId) {
      throw new BadRequestException('Cannot delete current session');
    }

    // Revoke instead of delete for audit trail
    await this.prisma.session.update({
      where: { id: sessionId },
      data: {
        isRevoked: true,
        revokedAt: new Date(),
        revokedReason: 'User deleted session',
      },
    });

    // Log session deletion
    await this.securityLogService.createLog({
      userId,
      action: 'SESSION_DELETED',
      status: 'SUCCESS',
      description: `تم حذف جلسة: ${session.deviceName || session.deviceType}`,
      ipAddress: session.ipAddress,
      deviceType: session.deviceType,
      browser: session.browser,
      os: session.os,
    });

    return { message: 'Session deleted successfully' };
  }

  // Delete all other sessions (logout from all other devices)
  async deleteOtherSessions(userId: string, currentSessionId?: string) {
    // Revoke all sessions except current
    const result = await this.prisma.session.updateMany({
      where: {
        userId,
        isRevoked: false,
        ...(currentSessionId ? { id: { not: currentSessionId } } : {}),
      },
      data: {
        isRevoked: true,
        revokedAt: new Date(),
        revokedReason: 'User logged out from all other devices',
      },
    });

    // Log session deletion
    await this.securityLogService.createLog({
      userId,
      action: 'SESSION_DELETED_ALL',
      status: 'SUCCESS',
      description: `تم إنهاء جميع الجلسات الأخرى (${result.count} جلسات)`,
    });

    return {
      message: 'All other sessions deleted successfully',
      deletedCount: result.count,
    };
  }

  // Request Email Change (بموافقة المسؤول - لا يتم التغيير مباشرة)
  async changeEmail(
    userId: string,
    changeEmailDto: ChangeEmailDto,
    ipAddress?: string,
    browser?: string,
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        profile: {
          select: { name: true },
        },
      },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    // التحقق من توثيق البريد الحالي
    if (!user.emailVerified) {
      throw new BadRequestException('يجب توثيق بريدك الإلكتروني الحالي أولاً');
    }

    // التحقق من تفعيل 2FA
    if (!user.twoFactorEnabled) {
      throw new BadRequestException('يجب تفعيل المصادقة الثنائية (2FA) أولاً');
    }

    // Check if new email is already in use
    const existingUser = await this.prisma.user.findUnique({
      where: { email: changeEmailDto.newEmail },
    });

    if (existingUser) {
      throw new BadRequestException('البريد الإلكتروني مستخدم بالفعل');
    }

    // التحقق من عدم وجود طلب معلّق
    const pendingRequest = await this.prisma.emailChangeRequest.findFirst({
      where: {
        userId,
        status: 'PENDING',
      },
    });

    if (pendingRequest) {
      throw new BadRequestException('لديك طلب تغيير بريد إلكتروني قيد المراجعة بالفعل');
    }

    const oldEmail = user.email;
    const newEmail = changeEmailDto.newEmail;

    // إنشاء طلب تغيير بريد إلكتروني (بانتظار موافقة المسؤول)
    await this.prisma.emailChangeRequest.create({
      data: {
        userId,
        oldEmail,
        newEmail,
        status: 'PENDING',
        ipAddress,
        browser,
      },
    });

    // Log the request
    await this.securityLogService.createLog({
      userId,
      action: 'EMAIL_CHANGE',
      status: 'WARNING',
      description: `طلب تغيير البريد الإلكتروني من ${oldEmail} إلى ${newEmail} - بانتظار موافقة المسؤول`,
      ipAddress,
      browser,
    });

    return {
      message: 'تم إرسال طلب تغيير البريد الإلكتروني بنجاح — بانتظار مراجعة المسؤول',
      oldEmail,
      newEmail,
      status: 'PENDING',
    };
  }

  // الحصول على آخر طلب تغيير بريد إلكتروني
  async getEmailChangeRequest(userId: string) {
    const request = await this.prisma.emailChangeRequest.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        oldEmail: true,
        newEmail: true,
        status: true,
        reason: true,
        createdAt: true,
        reviewedAt: true,
      },
    });

    return request;
  }

  // إلغاء طلب تغيير البريد الإلكتروني
  async cancelEmailChangeRequest(userId: string) {
    const request = await this.prisma.emailChangeRequest.findFirst({
      where: { userId, status: 'PENDING' },
    });

    if (!request) {
      throw new BadRequestException('لا يوجد طلب قيد المراجعة');
    }

    await this.prisma.emailChangeRequest.delete({
      where: { id: request.id },
    });

    return { message: 'تم إلغاء طلب تغيير البريد الإلكتروني' };
  }

  // إرسال رابط توثيق البريد الإلكتروني
  async sendEmailVerification(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { profile: { select: { name: true } } },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    if (user.emailVerified) {
      throw new BadRequestException('بريدك الإلكتروني موثّق بالفعل');
    }

    // إنشاء رمز تحقق
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes

    // حذف أي رموز سابقة
    await this.prisma.verification_codes.deleteMany({
      where: {
        userId,
        type: 'EMAIL_CHANGE',
        verified: false,
      },
    });

    // إنشاء رمز جديد
    await this.prisma.verification_codes.create({
      data: {
        id: crypto.randomUUID(),
        userId,
        code,
        type: 'EMAIL_CHANGE',
        expiresAt,
      },
    });

    // إرسال رمز التحقق عبر البريد
    try {
      await this.emailService.sendEmail({
        to: user.email,
        subject: '🔐 رمز توثيق بريدك الإلكتروني - Rukny',
        html: `
          <div dir="rtl" style="font-family: 'IBM Plex Sans Arabic', Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px;">
            <h2 style="color: #1a1a1a; margin-bottom: 16px;">توثيق البريد الإلكتروني</h2>
            <p style="color: #666; font-size: 14px;">مرحباً ${user.profile?.name || 'مستخدم'}،</p>
            <p style="color: #666; font-size: 14px;">رمز التحقق الخاص بك:</p>
            <div style="background: #f4f4f5; border-radius: 12px; padding: 20px; text-align: center; margin: 24px 0;">
              <code style="font-size: 28px; letter-spacing: 6px; font-weight: bold; color: #1a1a1a;">${code}</code>
            </div>
            <p style="color: #999; font-size: 12px;">صالح لمدة 30 دقيقة</p>
          </div>
        `,
      });
    } catch (error) {
      console.error('Failed to send verification email:', error);
    }

    return {
      message: 'تم إرسال رمز التحقق إلى بريدك الإلكتروني',
    };
  }

  // التحقق من رمز توثيق البريد الإلكتروني
  async verifyEmailCode(userId: string, code: string) {
    const verification = await this.prisma.verification_codes.findFirst({
      where: {
        userId,
        type: 'EMAIL_CHANGE',
        verified: false,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!verification) {
      throw new BadRequestException('رمز التحقق غير صالح أو منتهي الصلاحية');
    }

    if (verification.attempts >= 5) {
      throw new BadRequestException('تم تجاوز عدد المحاولات المسموح بها');
    }

    if (verification.code !== code) {
      // زيادة عدد المحاولات
      await this.prisma.verification_codes.update({
        where: { id: verification.id },
        data: { attempts: { increment: 1 } },
      });
      throw new BadRequestException('رمز التحقق غير صحيح');
    }

    // تحديث الرمز كمُحقق
    await this.prisma.verification_codes.update({
      where: { id: verification.id },
      data: { verified: true, verifiedAt: new Date() },
    });

    // تحديث حالة التوثيق
    await this.prisma.user.update({
      where: { id: userId },
      data: { emailVerified: true },
    });

    // مسح كاش المستخدم
    await this.redisService.del(`user:profile:${userId}`);

    return {
      message: 'تم توثيق بريدك الإلكتروني بنجاح',
      emailVerified: true,
    };
  }

  // Get Security Preferences
  async getSecurityPreferences(userId: string) {
    return this.securityDetectorService.getPreferences(userId);
  }

  // Update Security Preferences
  async updateSecurityPreferences(
    userId: string,
    dto: UpdateSecurityPreferencesDto,
  ) {
    return this.securityDetectorService.updatePreferences(userId, dto);
  }

  // Get Security Alert Settings (mapped from preferences)
  async getSecurityAlertSettings(userId: string) {
    const prefs = await this.securityDetectorService.getPreferences(userId);

    return {
      emailNotifications: true, // Always enabled at the system level
      loginAlerts: prefs.emailOnFailedLogin || false,
      newDeviceAlerts: prefs.emailOnNewDevice || false,
      suspiciousActivityAlerts: prefs.emailOnSuspiciousActivity || false,
      passwordChangeAlerts: prefs.emailOnPasswordChange || false,
      twoFactorAlerts: prefs.emailOn2FAChange || false,
      sessionManagementAlerts: true, // Default enabled
      ipBlocklistAlerts: prefs.autoBlockSuspiciousIp || false,
    };
  }

  // Update Security Alert Settings (maps to preferences)
  async updateSecurityAlertSettings(userId: string, settings: any) {
    const updateDto: UpdateSecurityPreferencesDto = {};

    if (settings.loginAlerts !== undefined) {
      updateDto.emailOnFailedLogin = settings.loginAlerts;
    }
    if (settings.newDeviceAlerts !== undefined) {
      updateDto.emailOnNewDevice = settings.newDeviceAlerts;
    }
    if (settings.suspiciousActivityAlerts !== undefined) {
      updateDto.emailOnSuspiciousActivity = settings.suspiciousActivityAlerts;
    }
    if (settings.passwordChangeAlerts !== undefined) {
      updateDto.emailOnPasswordChange = settings.passwordChangeAlerts;
    }
    if (settings.twoFactorAlerts !== undefined) {
      updateDto.emailOn2FAChange = settings.twoFactorAlerts;
    }
    if (settings.ipBlocklistAlerts !== undefined) {
      updateDto.autoBlockSuspiciousIp = settings.ipBlocklistAlerts;
    }

    await this.securityDetectorService.updatePreferences(userId, updateDto);

    return this.getSecurityAlertSettings(userId);
  }

  // Get Trusted Devices
  async getTrustedDevices(userId: string) {
    return this.securityDetectorService.getTrustedDevices(userId);
  }

  // Remove Trusted Device
  async removeTrustedDevice(userId: string, deviceId: string) {
    return this.securityDetectorService.removeTrustedDevice(userId, deviceId);
  }

  // Deactivate Account
  async deactivateAccount(
    userId: string,
    dto: DeactivateAccountDto,
    ipAddress?: string,
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { profile: { select: { name: true } } },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    if ((user as any).isDeactivated) {
      throw new BadRequestException('Account is already deactivated');
    }

    // Deactivate the account
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        isDeactivated: true,
        deactivatedAt: new Date(),
        updatedAt: new Date(),
      } as any,
    });

    // Revoke all sessions
    await this.prisma.session.updateMany({
      where: { userId, isRevoked: false },
      data: {
        isRevoked: true,
        revokedAt: new Date(),
        revokedReason: 'Account deactivated',
      },
    });

    // Log deactivation
    await this.securityLogService.createLog({
      userId,
      action: 'ACCOUNT_DEACTIVATED' as any,
      status: 'SUCCESS',
      description: `تم تعطيل الحساب${dto.reason ? `: ${dto.reason}` : ''}`,
      ipAddress,
    });

    // Send email notification
    await this.emailService.sendSecurityAlert(
      user.email,
      user.profile?.name || 'مستخدم',
      {
        action: 'ACCOUNT_DEACTIVATED',
        actionArabic: 'تعطيل الحساب',
        description: 'تم تعطيل حسابك مؤقتاً. يمكنك إعادة تفعيله في أي وقت عند تسجيل الدخول.',
        timestamp: new Date(),
      },
    );

    return { message: 'تم تعطيل الحساب بنجاح' };
  }

  // Reactivate Account
  async reactivateAccount(userId: string, ipAddress?: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { profile: { select: { name: true } } },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    if (!(user as any).isDeactivated) {
      throw new BadRequestException('Account is not deactivated');
    }

    // Reactivate the account
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        isDeactivated: false,
        deactivatedAt: null,
        updatedAt: new Date(),
      } as any,
    });

    // Log reactivation
    await this.securityLogService.createLog({
      userId,
      action: 'ACCOUNT_REACTIVATED' as any,
      status: 'SUCCESS',
      description: 'تم إعادة تفعيل الحساب',
      ipAddress,
    });

    return { message: 'تم إعادة تفعيل الحساب بنجاح' };
  }

  // Delete Account Permanently
  async deleteAccount(
    userId: string,
    dto: DeleteAccountDto,
    ipAddress?: string,
  ) {
    if (dto.confirmation !== 'DELETE') {
      throw new BadRequestException('يجب كتابة DELETE لتأكيد الحذف');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { profile: { select: { name: true } } },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    // Log deletion before deleting (so the log references the user)
    await this.securityLogService.createLog({
      userId,
      action: 'ACCOUNT_DELETED' as any,
      status: 'SUCCESS',
      description: `تم حذف الحساب نهائياً${dto.reason ? `: ${dto.reason}` : ''}`,
      ipAddress,
    });

    // Send farewell email before deletion
    await this.emailService.sendSecurityAlert(
      user.email,
      user.profile?.name || 'مستخدم',
      {
        action: 'ACCOUNT_DELETED',
        actionArabic: 'حذف الحساب',
        description: 'تم حذف حسابك نهائياً وجميع البيانات المرتبطة به.',
        timestamp: new Date(),
      },
    );

    // Delete the user (cascade will delete profile, sessions, etc.)
    await this.prisma.user.delete({
      where: { id: userId },
    });

    // Clear cache
    await this.redisService.del(`user:profile:${userId}`);

    return { message: 'تم حذف الحساب نهائياً' };
  }
}
