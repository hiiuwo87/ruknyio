import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { generateSecret, generateURI, verifySync } from 'otplib';
import * as QRCode from 'qrcode';
import * as crypto from 'crypto';

/**
 * 🔐 Two-Factor Authentication Service
 *
 * خدمة المصادقة الثنائية باستخدام TOTP (Time-based One-Time Password)
 * متوافق مع Google Authenticator, Microsoft Authenticator, Authy وغيرها
 *
 * الميزات:
 * - إنشاء مفتاح سري فريد لكل مستخدم
 * - توليد QR Code للتطبيقات
 * - التحقق من رموز OTP
 * - رموز احتياطية للاسترداد
 * - تشفير المفاتيح في قاعدة البيانات
 */

export interface TwoFactorSetupResult {
  secret: string;
  qrCodeUrl: string;
  backupCodes: string[];
  manualEntryKey: string;
}

export interface TwoFactorVerifyResult {
  valid: boolean;
  usedBackupCode?: boolean;
}

@Injectable()
export class TwoFactorService {
  private readonly APP_NAME = 'Rukny';
  private readonly ENCRYPTION_KEY: Buffer;
  private readonly ENCRYPTION_ALGORITHM = 'aes-256-gcm';

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
  ) {
    // 🔒 مفتاح التشفير للأسرار (يجب أن يكون 32 bytes = 64 hex characters)
    const key = this.configService.get<string>('TWO_FACTOR_ENCRYPTION_KEY');
    
    if (!key) {
      throw new Error(
        '❌ TWO_FACTOR_ENCRYPTION_KEY is required. ' +
          'Generate one with: openssl rand -hex 32',
      );
    }

    // 🔒 دعم كلا التنسيقين: hex (64 chars) أو plain text (32 chars)
    if (/^[0-9a-fA-F]{64}$/.test(key)) {
      // Hex encoded key (32 bytes = 64 hex chars)
      this.ENCRYPTION_KEY = Buffer.from(key, 'hex');
    } else if (key.length >= 32) {
      // Plain text key (at least 32 chars)
      this.ENCRYPTION_KEY = Buffer.from(key.substring(0, 32), 'utf8');
    } else {
      throw new Error(
        '❌ TWO_FACTOR_ENCRYPTION_KEY must be either 64 hex characters or at least 32 characters. ' +
          'Generate one with: openssl rand -hex 32',
      );
    }
  }

  /**
   * 🔐 تشفير المفتاح السري
   */
  private encrypt(text: string): string {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(
      this.ENCRYPTION_ALGORITHM,
      this.ENCRYPTION_KEY, // 🔒 استخدام Buffer مباشرة
      iv,
    );

    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const authTag = cipher.getAuthTag();

    // تنسيق: iv:authTag:encrypted
    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
  }

  /**
   * 🔓 فك تشفير المفتاح السري
   * يدعم كلا التنسيقين: المشفر (iv:authTag:encrypted) والقديم (base32 مباشر)
   */
  private decrypt(encryptedText: string): string {
    if (!encryptedText || typeof encryptedText !== 'string') {
      throw new BadRequestException('المفتاح السري غير موجود أو غير صالح');
    }

    const parts = encryptedText.split(':');
    
    // إذا كان التنسيق القديم (base32 مباشر بدون تشفير)
    // base32 عادة يحتوي فقط على A-Z و 2-7
    if (parts.length !== 3) {
      // تحقق إذا كان base32 صالح
      if (/^[A-Z2-7]+=*$/i.test(encryptedText)) {
        return encryptedText; // إرجاع المفتاح كما هو
      }
      throw new BadRequestException('تنسيق المفتاح السري غير صالح');
    }

    const [ivHex, authTagHex, encrypted] = parts;

    try {
      const iv = Buffer.from(ivHex, 'hex');
      const authTag = Buffer.from(authTagHex, 'hex');

      const decipher = crypto.createDecipheriv(
        this.ENCRYPTION_ALGORITHM,
        this.ENCRYPTION_KEY, // 🔒 استخدام Buffer مباشرة
        iv,
      );

      decipher.setAuthTag(authTag);

      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      return decrypted;
    } catch (error) {
      throw new BadRequestException('فشل في فك تشفير المفتاح السري');
    }
  }

  /**
   * 🎲 توليد رموز احتياطية
   */
  private generateBackupCodes(count: number = 10): string[] {
    const codes: string[] = [];
    for (let i = 0; i < count; i++) {
      // رمز من 8 أحرف (أرقام وحروف)
      const code = crypto.randomBytes(4).toString('hex').toUpperCase();
      // تنسيق: XXXX-XXXX
      codes.push(`${code.substring(0, 4)}-${code.substring(4, 8)}`);
    }
    return codes;
  }

  /**
   * 🔒 تشفير الرموز الاحتياطية
   */
  private hashBackupCodes(codes: string[]): string[] {
    return codes.map((code) =>
      crypto.createHash('sha256').update(code.replace('-', '')).digest('hex'),
    );
  }

  /**
   * 📱 إعداد المصادقة الثنائية (الخطوة 1)
   *
   * ينشئ مفتاحاً سرياً جديداً و QR Code
   * لا يتم تفعيل 2FA حتى يتم التحقق من الرمز
   */
  async generateSetup(userId: string): Promise<TwoFactorSetupResult> {
    // التحقق من المستخدم
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        twoFactorEnabled: true,
        profile: {
          select: { username: true },
        },
      },
    });

    if (!user) {
      throw new BadRequestException('المستخدم غير موجود');
    }

    if (user.twoFactorEnabled) {
      throw new BadRequestException(
        'المصادقة الثنائية مفعلة بالفعل. قم بإلغاء التفعيل أولاً',
      );
    }

    // إنشاء مفتاح سري جديد باستخدام otplib
    const secret = generateSecret(); // توليد مفتاح base32
    const otpauthUrl = generateURI({ issuer: this.APP_NAME, label: user.email, secret });

    // توليد QR Code
    const qrCodeUrl = await QRCode.toDataURL(otpauthUrl);

    // توليد رموز احتياطية
    const backupCodes = this.generateBackupCodes(10);

    // حفظ المفتاح المشفر مؤقتاً (pending)
    // سيتم تفعيله عند التحقق من أول رمز
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        twoFactorSecret: this.encrypt(secret),
        // لا نفعّل حتى يتم التحقق
        twoFactorEnabled: false,
      },
      select: { id: true, twoFactorSecret: true, twoFactorEnabled: true },
    });

    // حفظ الرموز الاحتياطية المشفرة
    await this.saveBackupCodes(userId, backupCodes);

    return {
      secret: secret,
      qrCodeUrl,
      backupCodes,
      manualEntryKey: secret, // للإدخال اليدوي
    };
  }

  /**
   * ✅ التحقق من رمز OTP وتفعيل 2FA (الخطوة 2)
   */
  async verifyAndEnable(
    userId: string,
    token: string,
  ): Promise<{ success: boolean; backupCodes: string[] }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        twoFactorSecret: true,
        twoFactorEnabled: true,
      },
    });

    if (!user) {
      throw new BadRequestException('المستخدم غير موجود');
    }

    if (!user.twoFactorSecret) {
      throw new BadRequestException(
        'لم يتم إعداد المصادقة الثنائية. قم بالإعداد أولاً',
      );
    }

    if (user.twoFactorEnabled) {
      throw new BadRequestException('المصادقة الثنائية مفعلة بالفعل');
    }

    // فك تشفير المفتاح
    const secret = this.decrypt(user.twoFactorSecret);

    // التحقق من الرمز باستخدام otplib
    const cleanToken = token.replace(/\s/g, ''); // إزالة المسافات
    const result = verifySync({ token: cleanToken, secret });

    if (!result.valid) {
      throw new UnauthorizedException(
        'رمز التحقق غير صحيح. تأكد من إدخال الرمز الظاهر في التطبيق',
      );
    }

    // تفعيل 2FA
    await this.prisma.user.update({
      where: { id: userId },
      data: { twoFactorEnabled: true },
      select: { id: true, twoFactorEnabled: true },
    });

    // استرجاع الرموز الاحتياطية
    const backupCodes = await this.getBackupCodes(userId);

    return {
      success: true,
      backupCodes,
    };
  }

  /**
   * 🔓 التحقق من رمز OTP عند تسجيل الدخول
   */
  async verifyToken(
    userId: string,
    token: string,
  ): Promise<TwoFactorVerifyResult> {
    if (!userId) {
      throw new BadRequestException('معرف المستخدم مطلوب');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        twoFactorSecret: true,
        twoFactorEnabled: true,
      },
    });

    if (!user) {
      throw new BadRequestException('المستخدم غير موجود');
    }

    if (!user.twoFactorEnabled) {
      throw new BadRequestException('المصادقة الثنائية غير مفعلة لهذا الحساب');
    }

    if (!user.twoFactorSecret) {
      throw new BadRequestException('المفتاح السري غير موجود. يرجى إعادة إعداد المصادقة الثنائية');
    }

    // فك تشفير المفتاح
    const secret = this.decrypt(user.twoFactorSecret);

    // التحقق من الرمز باستخدام otplib
    const cleanToken = token.replace(/\s/g, '');
    const result = verifySync({ token: cleanToken, secret });

    if (result.valid) {
      return { valid: true };
    }

    // محاولة التحقق من الرموز الاحتياطية
    const backupCodeUsed = await this.verifyBackupCode(userId, token);
    if (backupCodeUsed) {
      return { valid: true, usedBackupCode: true };
    }

    return { valid: false };
  }

  /**
   * ❌ إلغاء تفعيل المصادقة الثنائية
   */
  async disable(userId: string, token: string): Promise<{ success: boolean }> {
    // التحقق من الرمز أولاً
    const verification = await this.verifyToken(userId, token);

    if (!verification.valid) {
      throw new UnauthorizedException('رمز التحقق غير صحيح');
    }

    // إلغاء التفعيل
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        twoFactorEnabled: false,
        twoFactorSecret: null,
      },
      select: { id: true, twoFactorEnabled: true, twoFactorSecret: true },
    });

    // حذف الرموز الاحتياطية
    await this.deleteBackupCodes(userId);

    return { success: true };
  }

  /**
   * 🔄 إعادة توليد الرموز الاحتياطية
   */
  async regenerateBackupCodes(
    userId: string,
    token: string,
  ): Promise<{ backupCodes: string[] }> {
    // التحقق من الرمز
    const verification = await this.verifyToken(userId, token);

    if (!verification.valid) {
      throw new UnauthorizedException('رمز التحقق غير صحيح');
    }

    // توليد رموز جديدة
    const newBackupCodes = this.generateBackupCodes(10);

    // حذف القديمة وحفظ الجديدة
    await this.deleteBackupCodes(userId);
    await this.saveBackupCodes(userId, newBackupCodes);

    return { backupCodes: newBackupCodes };
  }

  /**
   * 📊 حالة المصادقة الثنائية للمستخدم
   */
  async getStatus(userId: string): Promise<{
    enabled: boolean;
    backupCodesRemaining: number;
  }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { twoFactorEnabled: true },
    });

    const backupCodesCount = await this.prisma.twoFactorBackupCode.count({
      where: { userId, used: false },
    });

    return {
      enabled: user?.twoFactorEnabled || false,
      backupCodesRemaining: backupCodesCount,
    };
  }

  /**
   * 💾 حفظ الرموز الاحتياطية
   */
  private async saveBackupCodes(
    userId: string,
    codes: string[],
  ): Promise<void> {
    const hashedCodes = this.hashBackupCodes(codes);

    await this.prisma.twoFactorBackupCode.createMany({
      data: hashedCodes.map((codeHash) => ({
        id: crypto.randomUUID(),
        userId,
        codeHash,
        used: false,
      })),
    });
  }

  /**
   * 🔍 التحقق من رمز احتياطي
   */
  private async verifyBackupCode(
    userId: string,
    code: string,
  ): Promise<boolean> {
    const normalizedCode = code.replace(/[-\s]/g, '').toUpperCase();
    const codeHash = crypto
      .createHash('sha256')
      .update(normalizedCode)
      .digest('hex');

    const backupCode = await this.prisma.twoFactorBackupCode.findFirst({
      where: {
        userId,
        codeHash,
        used: false,
      },
    });

    if (backupCode) {
      // تعليم الرمز كمستخدم
      await this.prisma.twoFactorBackupCode.update({
        where: { id: backupCode.id },
        data: {
          used: true,
          usedAt: new Date(),
        },
      });
      return true;
    }

    return false;
  }

  /**
   * 📋 استرجاع الرموز الاحتياطية المتبقية (للعرض فقط عند الإعداد)
   */
  private async getBackupCodes(userId: string): Promise<string[]> {
    // ملاحظة: لا يمكن استرجاع الرموز الأصلية لأنها مشفرة
    // هذا يُستخدم فقط مباشرة بعد الإنشاء
    const codes = await this.prisma.twoFactorBackupCode.findMany({
      where: { userId, used: false },
      select: { id: true },
    });

    return codes.map(() => '********'); // placeholder
  }

  /**
   * 🗑️ حذف الرموز الاحتياطية
   */
  private async deleteBackupCodes(userId: string): Promise<void> {
    await this.prisma.twoFactorBackupCode.deleteMany({
      where: { userId },
    });
  }

  /**
   * 🔍 التحقق مما إذا كان المستخدم يحتاج 2FA
   */
  async requiresTwoFactor(userId: string): Promise<boolean> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { twoFactorEnabled: true },
    });

    return user?.twoFactorEnabled || false;
  }
}
