import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../core/database/prisma/prisma.service';
import { WhatsappService } from '../../integrations/whatsapp/whatsapp.service';
import { EmailService } from '../../integrations/email/email.service';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import {
  RequestCheckoutOtpDto,
  VerifyCheckoutOtpDto,
  ResendCheckoutOtpDto,
  OtpRequestResponse,
  OtpVerifyResponse,
} from './dto/checkout-otp.dto';

/**
 * 🔐 خدمة التحقق للشراء - Checkout Auth Service
 *
 * نظام التحقق عبر واتساب للشراء كضيف
 * - تخزين OTP مشفر (bcrypt)
 * - Rate limiting
 * - Fallback للبريد الإلكتروني
 */

// Constants
const OTP_LENGTH = 6;
const OTP_EXPIRY_MINUTES = 15; // 15 دقيقة لإعطاء المستخدم وقتاً كافياً
const MAX_OTP_ATTEMPTS = 3;
const MAX_REQUESTS_PER_PHONE = 3;
const RATE_LIMIT_WINDOW_MINUTES = 15;
const BCRYPT_ROUNDS = 10;

@Injectable()
export class CheckoutAuthService {
  private readonly logger = new Logger(CheckoutAuthService.name);

  // Temporary helper to access new Prisma delegates/fields until types refresh
  private get prismaAny() {
    return this.prisma as any;
  }

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly whatsappService: WhatsappService,
    private readonly emailService: EmailService,
  ) {}

  /**
   * � فحص حالة خدمات الإرسال
   */
  async checkServicesStatus() {
    // فحص WhatsApp
    const whatsappEnabled = this.whatsappService.isEnabled();
    let whatsappStatus: any = {
      enabled: whatsappEnabled,
      connected: false,
    };

    if (whatsappEnabled) {
      try {
        const connection = await this.whatsappService.checkConnection();
        whatsappStatus = {
          enabled: true,
          connected: connection.connected,
          phone: connection.phone,
          name: connection.name,
        };
      } catch (error) {
        whatsappStatus.error = error?.message || 'Connection check failed';
      }
    }

    // فحص Email
    const emailTransporter = (this.emailService as any).transporter;
    const emailEnabled = (this.emailService as any).emailEnabled;
    const emailStatus: any = {
      enabled: emailEnabled,
      configured: !!emailTransporter,
    };

    if (emailTransporter) {
      try {
        // Test email connection
        await emailTransporter.verify();
        emailStatus.verified = true;
      } catch (error) {
        emailStatus.verified = false;
        emailStatus.error = error?.message || 'Verification failed';
      }
    }

    // الإعدادات
    const config = {
      whatsappApiUrl: this.configService.get('WHATSAPP_API_URL'),
      whatsappSessionId: this.configService.get('WHATSAPP_SESSION_ID')
        ? '✓ Set'
        : '✗ Missing',
      whatsappAccessToken: this.configService.get('WHATSAPP_ACCESS_TOKEN')
        ? '✓ Set'
        : '✗ Missing',
      mailHost: this.configService.get('MAIL_HOST') || '✗ Missing',
      mailUser: this.configService.get('MAIL_USER') ? '✓ Set' : '✗ Missing',
      mailPassword: this.configService.get('MAIL_PASSWORD')
        ? '✓ Set'
        : '✗ Missing',
      smtpFromEmail: this.configService.get('SMTP_FROM_EMAIL'),
    };

    return {
      status: 'OK',
      services: {
        whatsapp: whatsappStatus,
        email: emailStatus,
      },
      config,
      recommendation: this.getRecommendation(whatsappStatus, emailStatus),
    };
  }

  /**
   * 💡 توصيات بناءً على حالة الخدمات
   */
  private getRecommendation(whatsappStatus: any, emailStatus: any): string {
    if (
      whatsappStatus.enabled &&
      whatsappStatus.connected &&
      emailStatus.enabled &&
      emailStatus.verified
    ) {
      return '✅ Both services are working properly';
    }
    if (whatsappStatus.enabled && whatsappStatus.connected) {
      return '⚠️ WhatsApp is working but Email service needs configuration';
    }
    if (emailStatus.enabled && emailStatus.verified) {
      return '⚠️ Email is working but WhatsApp service needs configuration';
    }
    return '❌ Both services need configuration. Check environment variables.';
  }

  /**
   * � طلب رمز OTP للشراء
   */
  async requestOtp(dto: RequestCheckoutOtpDto): Promise<OtpRequestResponse> {
    const { phoneNumber, email, preferEmail } = dto;

    // التحقق من وجود أحد الحقلين على الأقل
    if (!phoneNumber && !email) {
      throw new BadRequestException({
        message: 'يجب تقديم رقم الهاتف أو البريد الإلكتروني',
        code: 'MISSING_CONTACT_INFO',
      });
    }

    // استخدام الهاتف كمعرّف أساسي، أو الإيميل إن لم يكن موجوداً
    const contactIdentifier = phoneNumber || email;

    // 1. التحقق من Rate Limiting
    await this.checkRateLimit(contactIdentifier);

    // 2. إلغاء أي OTPs سابقة لهذا المعرف
    await this.invalidatePreviousOtps(contactIdentifier, email);

    // 3. توليد رمز OTP جديد
    const otpCode = this.generateOtpCode();

    // 4. تشفير الرمز قبل التخزين
    const codeHash = await bcrypt.hash(otpCode, BCRYPT_ROUNDS);

    // 5. حساب وقت الانتهاء
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + OTP_EXPIRY_MINUTES);

    // 6. البحث عن مستخدم موجود
    const existingUser = phoneNumber
      ? await (this.prisma.user as any).findFirst({ where: { phoneNumber } })
      : await (this.prisma.user as any).findFirst({ where: { email } });

    // 7. حفظ OTP في قاعدة البيانات
    const otpRecord = await this.prismaAny.whatsappOtp.create({
      data: {
        phoneNumber: phoneNumber || null,
        email: email || null,
        codeHash, // 🔒 نخزن Hash فقط
        type: 'CHECKOUT',
        expiresAt,
        userId: existingUser?.id,
      },
    });

    // 8. تحديد طريقة الإرسال
    let sentVia: 'WHATSAPP' | 'EMAIL' = 'EMAIL';
    let sendResult: { success: boolean; error?: string } = { success: false };

    // إذا طلب المستخدم تفضيل البريد أو إذا كان البريد فقط متاحاً
    const useEmailDirectly = preferEmail || (!phoneNumber && email);

    if (phoneNumber && !useEmailDirectly) {
      // محاولة الإرسال عبر واتساب
      const WHATSAPP_OTP_TIMEOUT_MS = 15000; // ⏱️ 15 ثانية - توازن بين السرعة والموثوقية
      this.logger.log(`Attempting to send OTP via WhatsApp to ${phoneNumber}`);
      sendResult = await this.withTimeout(
        this.whatsappService.sendOtpMessage(phoneNumber, otpCode),
        WHATSAPP_OTP_TIMEOUT_MS,
        {
          success: false,
          error: 'WhatsApp timeout - API took too long to respond',
        },
      );

      if (sendResult.success) {
        sentVia = 'WHATSAPP';
        this.logger.log(`✅ OTP sent via WhatsApp to ${phoneNumber}`);
      } else {
        this.logger.warn(
          `❌ WhatsApp failed for ${phoneNumber}: ${sendResult.error || 'Unknown error'}`,
        );
        if (email) {
          // Fallback للبريد إذا كان متوفراً
          this.logger.log(`Attempting email fallback to ${email}`);
          try {
            await this.sendOtpEmail(email, otpCode);
            sentVia = 'EMAIL';
            sendResult = { success: true };
            this.logger.log(`✅ OTP sent via Email to ${email}`);
          } catch (emailError) {
            this.logger.error(
              '❌ Email fallback also failed:',
              emailError?.message || emailError,
            );
            sendResult = {
              success: false,
              error: emailError?.message || 'Email send failed',
            };
          }
        } else {
          this.logger.error(
            '❌ No email provided for fallback - WhatsApp service unavailable',
          );
          sendResult.error =
            'WhatsApp service unavailable and no email provided';
        }
      }
    } else if (useEmailDirectly && email) {
      // الإرسال عبر البريد مباشرة (تم تفضيله أو لا يوجد رقم هاتف)
      this.logger.log(
        `Sending OTP directly via Email to ${email} ${preferEmail ? '(user preference - skip WhatsApp)' : ''}`,
      );
      try {
        await this.sendOtpEmail(email, otpCode);
        sentVia = 'EMAIL';
        sendResult = { success: true };
        this.logger.log(`✅ OTP sent via Email to ${email}`);
      } catch (emailError) {
        this.logger.error(
          '❌ Email send failed:',
          emailError?.message || emailError,
        );
        sendResult = {
          success: false,
          error: emailError?.message || 'Email send failed',
        };
      }
    } else if (email) {
      // الإرسال عبر البريد مباشرة
      this.logger.log(`Sending OTP directly via Email to ${email}`);
      try {
        await this.sendOtpEmail(email, otpCode);
        sentVia = 'EMAIL';
        sendResult = { success: true };
        this.logger.log(`✅ OTP sent via Email to ${email}`);
      } catch (emailError) {
        this.logger.error(
          '❌ Email send failed:',
          emailError?.message || emailError,
        );
        sendResult = {
          success: false,
          error: emailError?.message || 'Email send failed',
        };
      }
    }

    // 9. تحديث قناة الإرسال
    await this.prismaAny.whatsappOtp.update({
      where: { id: otpRecord.id },
      data: { sentVia },
    });

    // 10. إذا فشل الإرسال بجميع القنوات
    if (!sendResult.success) {
      this.logger.error(
        `❌ OTP send failed for contact: ${contactIdentifier}. Error: ${sendResult.error}`,
      );

      // رسالة خطأ واضحة بناءً على السبب
      let errorMessage = 'فشل في إرسال رمز التحقق. يرجى المحاولة لاحقاً.';
      let suggestion = undefined;

      if (sendResult.error?.includes('timeout')) {
        if (email) {
          errorMessage =
            'خدمة واتساب بطيئة حالياً. جرب استخدام البريد الإلكتروني بدلاً من ذلك.';
          suggestion =
            'أضف { "preferEmail": true } في الطلب لاستخدام البريد مباشرة';
        } else {
          errorMessage =
            'خدمة واتساب بطيئة حالياً. يرجى إضافة بريدك الإلكتروني كخيار بديل.';
          suggestion = 'حاول إضافة بريدك الإلكتروني لزيادة فرص النجاح';
        }
      } else if (!email && phoneNumber) {
        errorMessage =
          'فشل الإرسال عبر واتساب. يرجى إضافة بريدك الإلكتروني كخيار بديل.';
        suggestion = 'حاول إضافة بريدك الإلكتروني لزيادة فرص النجاح';
      }

      throw new BadRequestException({
        message: errorMessage,
        code: 'OTP_SEND_FAILED',
        details:
          process.env.NODE_ENV !== 'production' ? sendResult.error : undefined,
        suggestion,
      });
    }

    return {
      success: true,
      message:
        sentVia === 'WHATSAPP'
          ? 'تم إرسال رمز التحقق عبر واتساب'
          : 'تم إرسال رمز التحقق عبر البريد الإلكتروني',
      otpId: otpRecord.id, // ⚠️ نُرجع ID فقط، ليس الرمز
      sentVia,
      expiresIn: OTP_EXPIRY_MINUTES * 60,
      maskedPhone: phoneNumber ? this.maskPhoneNumber(phoneNumber) : undefined,
    };
  }

  /**
   * ✅ التحقق من رمز OTP
   */
  async verifyOtp(dto: VerifyCheckoutOtpDto): Promise<OtpVerifyResponse> {
    const { phoneNumber, email, code, otpId } = dto;

    // التحقق من وجود أحد الحقلين
    if (!phoneNumber && !email) {
      throw new BadRequestException({
        message: 'يجب تقديم رقم الهاتف أو البريد الإلكتروني',
        code: 'MISSING_CONTACT_INFO',
      });
    }

    // 1. جلب OTP من قاعدة البيانات
    const otpRecord = await this.prismaAny.whatsappOtp.findUnique({
      where: { id: otpId },
    });

    // 2. التحقق من وجود السجل
    if (!otpRecord) {
      throw new BadRequestException({
        message: 'رمز التحقق غير صالح',
        code: 'INVALID_OTP_ID',
      });
    }

    // 3. التحقق من تطابق الهاتف أو الإيميل
    const contactMatches = phoneNumber
      ? otpRecord.phoneNumber === phoneNumber
      : otpRecord.email === email;

    if (!contactMatches) {
      throw new BadRequestException({
        message: 'بيانات الاتصال غير متطابقة',
        code: 'CONTACT_MISMATCH',
      });
    }

    // 4. التحقق من عدم انتهاء الصلاحية
    if (new Date() > otpRecord.expiresAt) {
      throw new BadRequestException({
        message: 'انتهت صلاحية رمز التحقق. يرجى طلب رمز جديد.',
        code: 'OTP_EXPIRED',
      });
    }

    // 5. التحقق من عدم استخدام الرمز مسبقاً
    if (otpRecord.verified) {
      throw new BadRequestException({
        message: 'تم استخدام هذا الرمز مسبقاً',
        code: 'OTP_ALREADY_USED',
      });
    }

    // 6. التحقق من عدد المحاولات
    if (otpRecord.attempts >= MAX_OTP_ATTEMPTS) {
      throw new BadRequestException({
        message: 'تم تجاوز الحد الأقصى للمحاولات. يرجى طلب رمز جديد.',
        code: 'MAX_ATTEMPTS_EXCEEDED',
      });
    }

    // 7. زيادة عداد المحاولات
    await this.prismaAny.whatsappOtp.update({
      where: { id: otpId },
      data: { attempts: { increment: 1 } },
    });

    // 8. 🔒 مقارنة الرمز باستخدام bcrypt
    const isValidCode = await bcrypt.compare(code, otpRecord.codeHash);

    if (!isValidCode) {
      const remainingAttempts = MAX_OTP_ATTEMPTS - (otpRecord.attempts + 1);
      throw new BadRequestException({
        message: `رمز التحقق غير صحيح. المحاولات المتبقية: ${remainingAttempts}`,
        code: 'INVALID_OTP_CODE',
        remainingAttempts,
      });
    }

    // 9. تحديث OTP كمُحقق
    await this.prismaAny.whatsappOtp.update({
      where: { id: otpId },
      data: {
        verified: true,
        verifiedAt: new Date(),
      },
    });

    // 10. إنشاء أو جلب المستخدم
    const contactInfo = phoneNumber || email;
    const { user, isNewUser } = await this.getOrCreateGuestUser(
      phoneNumber,
      email,
    );

    // 11. إنشاء JWT Token
    const accessToken = this.jwtService.sign(
      {
        sub: user.id,
        phone: phoneNumber,
        email: email,
        type: 'checkout',
      },
      { expiresIn: '24h' }, // جلسة شراء صالحة ليوم كامل
    );

    return {
      success: true,
      message: 'تم التحقق بنجاح',
      accessToken,
      userId: user.id,
      isNewUser,
    };
  }

  /**
   * 🔄 إعادة إرسال OTP
   */
  async resendOtp(dto: ResendCheckoutOtpDto): Promise<OtpRequestResponse> {
    const { phoneNumber, preferredChannel, email } = dto;

    // التحقق من Rate Limiting مع تساهل أكثر لإعادة الإرسال
    await this.checkRateLimit(phoneNumber, true);

    // إلغاء OTPs السابقة
    await this.invalidatePreviousOtps(phoneNumber);

    // توليد رمز جديد
    const otpCode = this.generateOtpCode();
    const codeHash = await bcrypt.hash(otpCode, BCRYPT_ROUNDS);

    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + OTP_EXPIRY_MINUTES);

    const existingUser = await (this.prisma.user as any).findFirst({
      where: { phoneNumber },
    });

    const otpRecord = await this.prismaAny.whatsappOtp.create({
      data: {
        phoneNumber,
        codeHash,
        type: 'CHECKOUT',
        expiresAt,
        userId: existingUser?.id,
      },
    });

    // تحديد قناة الإرسال
    let sentVia: 'WHATSAPP' | 'EMAIL' = preferredChannel || 'WHATSAPP';
    let sendResult = { success: false };

    if (sentVia === 'WHATSAPP') {
      const WHATSAPP_OTP_TIMEOUT_MS = 15000; // ⏱️ 15 ثانية
      sendResult = await this.withTimeout(
        this.whatsappService.sendOtpMessage(phoneNumber, otpCode),
        WHATSAPP_OTP_TIMEOUT_MS,
        { success: false, error: 'WhatsApp timeout' },
      );

      // Fallback للبريد
      if (!sendResult.success && email) {
        try {
          await this.sendOtpEmail(email, otpCode);
          sentVia = 'EMAIL';
          sendResult = { success: true };
        } catch {
          // Silent fail
        }
      }
    } else if (sentVia === 'EMAIL' && email) {
      try {
        await this.sendOtpEmail(email, otpCode);
        sendResult = { success: true };
      } catch {
        // محاولة واتساب كـ fallback
        sendResult = await this.whatsappService.sendOtpMessage(
          phoneNumber,
          otpCode,
        );
        if (sendResult.success) {
          sentVia = 'WHATSAPP';
        }
      }
    }

    await this.prismaAny.whatsappOtp.update({
      where: { id: otpRecord.id },
      data: { sentVia },
    });

    if (!sendResult.success) {
      throw new BadRequestException({
        message: 'فشل في إرسال رمز التحقق',
        code: 'OTP_SEND_FAILED',
      });
    }

    return {
      success: true,
      message:
        sentVia === 'WHATSAPP'
          ? 'تم إعادة إرسال رمز التحقق عبر واتساب'
          : 'تم إعادة إرسال رمز التحقق عبر البريد الإلكتروني',
      otpId: otpRecord.id,
      sentVia,
      expiresIn: OTP_EXPIRY_MINUTES * 60,
      maskedPhone: this.maskPhoneNumber(phoneNumber),
    };
  }

  // ============ Private Helper Methods ============

  /**
   * 🎲 توليد رمز OTP عشوائي
   */
  private generateOtpCode(): string {
    // استخدام crypto للأمان بدلاً من Math.random
    const buffer = crypto.randomBytes(4);
    const num = buffer.readUInt32BE(0);
    // تحويل إلى رقم من 6 خانات
    const code = ((num % 900000) + 100000).toString();
    return code;
  }

  private async withTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number,
    fallback: T,
  ): Promise<T> {
    let timeoutHandle: NodeJS.Timeout | undefined;
    try {
      return await Promise.race([
        promise,
        new Promise<T>((resolve) => {
          timeoutHandle = setTimeout(() => resolve(fallback), timeoutMs);
        }),
      ]);
    } finally {
      if (timeoutHandle) {
        clearTimeout(timeoutHandle);
      }
    }
  }

  /**
   * 🔒 التحقق من Rate Limiting
   */
  private async checkRateLimit(
    contactIdentifier: string,
    isResend = false,
  ): Promise<void> {
    const windowStart = new Date();
    windowStart.setMinutes(
      windowStart.getMinutes() - RATE_LIMIT_WINDOW_MINUTES,
    );

    const recentRequests = await this.prismaAny.whatsappOtp.count({
      where: {
        OR: [{ phoneNumber: contactIdentifier }, { email: contactIdentifier }],
        createdAt: { gte: windowStart },
      },
    });

    const limit = isResend
      ? MAX_REQUESTS_PER_PHONE + 2
      : MAX_REQUESTS_PER_PHONE;

    if (recentRequests >= limit) {
      throw new BadRequestException({
        message: `لقد تجاوزت الحد الأقصى للطلبات. يرجى الانتظار ${RATE_LIMIT_WINDOW_MINUTES} دقيقة.`,
        code: 'RATE_LIMIT_EXCEEDED',
        retryAfter: RATE_LIMIT_WINDOW_MINUTES * 60,
      });
    }
  }

  /**
   * 🚫 إلغاء OTPs السابقة
   */
  private async invalidatePreviousOtps(
    phoneNumber?: string,
    email?: string,
  ): Promise<void> {
    const whereCondition: any = {
      verified: false,
      expiresAt: { gt: new Date() },
    };

    if (phoneNumber) {
      whereCondition.phoneNumber = phoneNumber;
    } else if (email) {
      whereCondition.email = email;
    }

    await this.prismaAny.whatsappOtp.updateMany({
      where: whereCondition,
      data: {
        expiresAt: new Date(), // إنهاء الصلاحية فوراً
      },
    });
  }

  /**
   * 👤 إنشاء أو جلب مستخدم ضيف
   */
  private async getOrCreateGuestUser(
    phoneNumber?: string,
    email?: string,
  ): Promise<{ user: any; isNewUser: boolean }> {
    let user: any;

    // البحث عن مستخدم موجود
    if (phoneNumber) {
      user = await (this.prisma.user as any).findFirst({
        where: { phoneNumber },
      });

      if (user) {
        // تحديث حالة التحقق
        user = await (this.prisma.user as any).update({
          where: { id: user.id },
          data: {
            phoneVerified: true,
          },
        });
        return { user, isNewUser: false };
      }
    } else if (email) {
      user = await (this.prisma.user as any).findFirst({
        where: { email },
      });

      if (user) {
        // تحديث حالة التحقق - email verification
        user = await (this.prisma.user as any).update({
          where: { id: user.id },
          data: {
            emailVerified: true,
          },
        });
        return { user, isNewUser: false };
      }
    }

    // إنشاء مستخدم جديد (ضيف)
    const guestEmail =
      email ||
      `guest_${Date.now()}_${crypto.randomBytes(4).toString('hex')}@guest.rukny.io`;

    user = await (this.prisma.user as any).create({
      data: {
        id: crypto.randomUUID(),
        email: guestEmail,
        phoneNumber: phoneNumber || null,
        phoneVerified: !!phoneNumber,
        emailVerified: !!email,
        accountType: 'GUEST_CHECKOUT',
        role: 'GUEST',
      },
    });

    return { user, isNewUser: true };
  }

  /**
   * 📧 إرسال OTP عبر البريد الإلكتروني
   */
  private async sendOtpEmail(email: string, code: string): Promise<void> {
    // استخدام طريقة مشابهة لـ IP Verification
    const fromEmail = this.configService.get(
      'SMTP_FROM_EMAIL',
      'notifications@rukny.store',
    );
    const fromName = this.configService.get('SMTP_FROM_NAME', 'Rukny');

    const htmlContent = `
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8">
  <title>رمز التحقق - ركني</title>
  <style>
    body { font-family: 'Segoe UI', Tahoma, sans-serif; background: #f5f5f5; margin: 0; padding: 20px; direction: rtl; }
    .container { max-width: 500px; margin: 0 auto; background: white; border-radius: 12px; padding: 40px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
    .logo { text-align: center; margin-bottom: 30px; }
    .logo h1 { color: #4FADC0; margin: 0; font-size: 28px; }
    .code-box { background: #f8f9fa; border: 2px dashed #4FADC0; border-radius: 8px; padding: 20px; text-align: center; margin: 30px 0; }
    .code { font-size: 36px; font-weight: bold; letter-spacing: 8px; color: #333; font-family: monospace; }
    .info { color: #666; font-size: 14px; text-align: center; }
    .warning { color: #e74c3c; font-size: 13px; margin-top: 20px; padding: 10px; background: #fdf2f2; border-radius: 6px; }
    .footer { text-align: center; color: #999; font-size: 12px; margin-top: 30px; border-top: 1px solid #eee; padding-top: 20px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="logo">
      <h1>🛒 ركني</h1>
      <p style="color:#666;">متجرك الإلكتروني الموثوق</p>
    </div>
    
    <h2 style="text-align:center;color:#333;">رمز التحقق الخاص بك</h2>
    
    <div class="code-box">
      <div class="code">${code}</div>
    </div>
    
    <p class="info">
      ⏰ هذا الرمز صالح لمدة <strong>10 دقائق</strong> فقط
    </p>
    
    <div class="warning">
      ⚠️ <strong>تنبيه أمني:</strong> لا تشارك هذا الرمز مع أي شخص. فريق ركني لن يطلب منك هذا الرمز أبداً.
    </div>
    
    <p class="info" style="margin-top:20px;">
      إذا لم تطلب هذا الرمز، يرجى تجاهل هذه الرسالة.
    </p>
    
    <div class="footer">
      <p>© ${new Date().getFullYear()} ركني - Rukny.io</p>
    </div>
  </div>
</body>
</html>
    `;

    // استخدام nodemailer مباشرة عبر EmailService
    const transporter = (this.emailService as any).transporter;

    if (!transporter) {
      const errorMsg =
        'Email service is not configured. Missing MAIL_HOST, MAIL_USER, or MAIL_PASSWORD.';
      this.logger.error(errorMsg);
      throw new Error(errorMsg);
    }

    try {
      const mailOptions = {
        from: `"${fromName}" <${fromEmail}>`,
        to: email,
        subject: '🔐 رمز التحقق من ركني - Rukny Verification Code',
        html: htmlContent,
      };

      this.logger.debug(`Sending email to ${email} with options:`, {
        from: mailOptions.from,
        to: mailOptions.to,
        subject: mailOptions.subject,
      });

      const result = await transporter.sendMail(mailOptions);
      this.logger.log(
        `✅ OTP email sent successfully to ${email}. MessageId: ${result.messageId}`,
      );
    } catch (error) {
      this.logger.error(`❌ Failed to send OTP email to ${email}:`, {
        error: error?.message,
        code: error?.code,
        response: error?.response,
        stack: error?.stack?.split('\n').slice(0, 3).join('\n'),
      });
      throw new Error(
        `Email send failed: ${error?.message || 'Unknown error'}`,
      );
    }
  }

  /**
   * 🙈 إخفاء رقم الهاتف
   */
  private maskPhoneNumber(phone: string): string {
    // +9647701234567 -> +964770***4567
    if (phone.length < 8) return phone;
    const prefix = phone.slice(0, 7);
    const suffix = phone.slice(-4);
    return `${prefix}***${suffix}`;
  }
}
