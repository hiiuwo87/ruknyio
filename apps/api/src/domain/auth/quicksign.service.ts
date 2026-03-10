import { Injectable, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../core/database/prisma/prisma.service';
import { RedisService } from '../../core/cache/redis.service';
import { QuickSignType } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import * as crypto from 'crypto';

/**
 * 🔒 QuickSign Service
 * 
 * خدمة Magic Link للدخول السريع بدون كلمة مرور
 * 
 * تحسينات أمنية:
 * - تخزين hash التوكن فقط (وليس التوكن نفسه) - ملاحظة: يحتاج تغيير في schema
 * - One-time use (استخدام مرة واحدة)
 * - Expiration قصيرة (15-30 دقيقة)
 * - Rate limiting على طلب الإرسال
 * - ⚡ تخزين مؤقت في Redis للأداء
 */
@Injectable()
export class QuickSignService {
  // 🔒 30 دقيقة - مدة مناسبة للأمان والمرونة
  private readonly QUICKSIGN_EXPIRY_MINUTES = 30;
  private readonly CACHE_PREFIX = 'quicksign:';
  private readonly USER_CACHE_PREFIX = 'user:exists:';
  private readonly LOCK_PREFIX = 'quicksign:lock:';
  private readonly LOCK_TTL = 10; // 10 seconds for lock timeout

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private redis: RedisService,
  ) {}

  /**
   * 🔒 تشفير التوكن باستخدام SHA-256
   */
  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  /**
   * 🔒 محاولة الحصول على قفل للتحقق من التوكن
   * يمنع race conditions عند استخدام نفس الرابط عدة مرات
   */
  private async acquireTokenLock(tokenHash: string): Promise<boolean> {
    const lockKey = `${this.LOCK_PREFIX}${tokenHash}`;
    // NX = only set if doesn't exist, EX = expire in seconds
    const result = await this.redis.setNX(lockKey, 'locked', this.LOCK_TTL);
    return result;
  }

  /**
   * 🔒 إطلاق قفل التحقق من التوكن
   */
  private async releaseTokenLock(tokenHash: string): Promise<void> {
    const lockKey = `${this.LOCK_PREFIX}${tokenHash}`;
    await this.redis.del(lockKey);
  }

  /**
   * 🔒 إنشاء QuickSign link جديد
   * ⚡ محسّن للأداء - يستخدم Redis cache + DB في الخلفية
   */
  async generateQuickSign(
    email: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<{ token: string; type: QuickSignType; expiresIn: number }> {
    // ⚡ التحقق من cache أولاً للمستخدم
    const cacheKey = `${this.USER_CACHE_PREFIX}${email}`;
    let existingUser = await this.redis.get<{ id: string; email: string; profileCompleted: boolean } | null>(cacheKey);
    
    if (!existingUser) {
      // لم يوجد في الـ cache - نبحث في الـ DB
      existingUser = await this.prisma.user.findUnique({
        where: { email },
        select: { id: true, email: true, profileCompleted: true },
      });
      // تخزين النتيجة في cache لمدة 5 دقائق
      await this.redis.set(cacheKey, JSON.stringify(existingUser), 300);
    }

    const type: QuickSignType = existingUser ? QuickSignType.LOGIN : QuickSignType.SIGNUP;

    // 🔒 إنشاء token فريد (JWT + UUID)
    const uuid = uuidv4();
    const payload = {
      email,
      type,
      uuid,
      // iat يتم إضافته تلقائياً بواسطة JWT
    };

    const jwtToken = this.jwtService.sign(payload, {
      expiresIn: `${this.QUICKSIGN_EXPIRY_MINUTES}m`,
    });

    // حساب وقت الانتهاء
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + this.QUICKSIGN_EXPIRY_MINUTES);

    // 🔒 حساب hash الـ token للتخزين الآمن
    const tokenHash = this.hashToken(jwtToken);

    if (process.env.NODE_ENV === 'development') {
      console.log('[QuickSign.generateQuickSign] Generated new QuickSign token:', {
        email,
        type,
        tokenLength: jwtToken.length,
        tokenPreview: jwtToken.substring(0, 30) + '...',
        tokenHash: tokenHash.substring(0, 20) + '...',
        expiresAt: expiresAt.toISOString(),
      });
    }

    // ⚡ حفظ في Redis للتحقق السريع
    const tokenCacheKey = `${this.CACHE_PREFIX}${tokenHash}`;
    const tokenData = {
      email,
      type,
      userId: existingUser?.id,
      expiresAt: expiresAt.toISOString(),
      used: false,
    };
    await this.redis.set(tokenCacheKey, JSON.stringify(tokenData), this.QUICKSIGN_EXPIRY_MINUTES * 60);

    if (process.env.NODE_ENV === 'development') {
      console.log('[QuickSign.generateQuickSign] ✅ Token saved to Redis');
    }

    // 🔒 حفظ في قاعدة البيانات (ننتظر لضمان الحفظ - لا race condition)
    // ⚠️ نخزن hash فقط وليس الـ token نفسه (أمان أعلى)
    try {
      const createdRecord = await this.prisma.quicksign_links.create({
        data: {
          id: uuidv4(),
          email,
          token: tokenHash, // 🔒 hash بدلاً من plain text
          type,
          expiresAt,
          ipAddress,
          userAgent,
          userId: existingUser?.id,
        },
      });

      if (process.env.NODE_ENV === 'development') {
        console.log('[QuickSign.generateQuickSign] ✅ Token saved to Database with ID:', createdRecord.id);
      }
    } catch (err) {
      // إذا فشل الحفظ، نحذف من Redis ونرمي خطأ
      await this.redis.del(tokenCacheKey);
      console.error('[QuickSign] Failed to save to DB:', err);
      throw new Error('Failed to create QuickSign link');
    }

    return {
      token: jwtToken,
      type,
      expiresIn: this.QUICKSIGN_EXPIRY_MINUTES * 60, // بالثواني
    };
  }

  /**
   * 🔒 التحقق من صلاحية QuickSign token
   * ⚡ محسّن للأداء - يتحقق من Redis أولاً
   */
  async verifyQuickSign(token: string): Promise<{
    valid: boolean;
    email?: string;
    type?: QuickSignType;
    userId?: string;
    used?: boolean;
    expired?: boolean;
    profileCompleted?: boolean;
  }> {
    try {
      // 🔒 Debug: Log incoming token
      if (process.env.NODE_ENV === 'development') {
        console.log('[QuickSign.verifyQuickSign] Starting verification with token:', {
          tokenType: typeof token,
          tokenLength: token?.length,
          tokenPreview: token?.substring(0, 30) + '...',
          hasDots: (token?.match(/\./g) || []).length,
        });
      }

      const tokenHash = this.hashToken(token);

      // 🔒 Debug: Log hash
      if (process.env.NODE_ENV === 'development') {
        console.log('[QuickSign.verifyQuickSign] Token hash computed:', {
          hashPreview: tokenHash.substring(0, 20) + '...',
          hashLength: tokenHash.length,
        });
      }

      // 🔒 فك تشفير JWT أولاً للتحقق من الصلاحية
      const payload = this.jwtService.verify(token);
      
      if (process.env.NODE_ENV === 'development') {
        console.log('[QuickSign.verifyQuickSign] JWT verification successful:', {
          email: payload.email,
          type: payload.type,
          uuid: payload.uuid,
        });
      }

      // ⚡ التحقق من Redis أولاً (أسرع)
      const tokenCacheKey = `${this.CACHE_PREFIX}${tokenHash}`;
      const cachedData = await this.redis.get<{
        email: string;
        type: QuickSignType;
        userId?: string;
        expiresAt: string;
        used: boolean;
      }>(tokenCacheKey);
      
      if (cachedData) {
        console.log('[QuickSign.verifyQuickSign] Token found in Redis cache');
        // التحقق من الاستخدام المسبق
        if (cachedData.used) {
          return {
            valid: false,
            used: true,
            email: cachedData.email,
          };
        }

        // التحقق من انتهاء الصلاحية
        if (new Date() > new Date(cachedData.expiresAt)) {
          return {
            valid: false,
            expired: true,
            email: cachedData.email,
          };
        }

        // جلب profileCompleted من الـ cache إذا كان هناك userId
        let profileCompleted = false;
        if (cachedData.userId) {
          const userCacheKey = `${this.USER_CACHE_PREFIX}${cachedData.email}`;
          const cachedUser = await this.redis.get<{ profileCompleted?: boolean }>(userCacheKey);
          if (cachedUser) {
            profileCompleted = cachedUser?.profileCompleted || false;
          }
        }

        if (process.env.NODE_ENV === 'development') {
          console.log('[QuickSign.verifyQuickSign] Token verified from Redis:', {
            email: cachedData.email,
            type: cachedData.type,
            valid: true,
          });
        }

        return {
          valid: true,
          email: cachedData.email,
          type: cachedData.type,
          userId: cachedData.userId,
          profileCompleted,
        };
      }

      console.log('[QuickSign.verifyQuickSign] Token NOT in Redis, checking database with hash:', {
        hashPreview: tokenHash.substring(0, 20) + '...',
      });

      // ⚡ Fallback إلى قاعدة البيانات (نبحث بالـ hash)
      const quickSign = await this.prisma.quicksign_links.findUnique({
        where: { token: tokenHash }, // 🔒 البحث بالـ hash
        include: {
          users: {
            select: {
              id: true,
              email: true,
              profileCompleted: true,
            },
          },
        },
      });

      if (!quickSign) {
        console.warn('[QuickSign.verifyQuickSign] ❌ Token NOT found in database!', {
          tokenHashUsed: tokenHash.substring(0, 20) + '...',
          email: payload.email,
          // Try to debug by searching for tokens with same email
        });

        // Debug: Try to find ANY token for this email
        const anyTokens = await this.prisma.quicksign_links.findMany({
          where: { email: payload.email },
          select: { token: true, type: true, used: true, createdAt: true },
          orderBy: { createdAt: 'desc' },
          take: 3,
        });

        if (process.env.NODE_ENV === 'development') {
          console.log('[QuickSign.verifyQuickSign] Tokens in DB for this email:', {
            email: payload.email,
            count: anyTokens.length,
            tokens: anyTokens.map(t => ({
              tokenPreview: t.token.substring(0, 10) + '...',
              type: t.type,
              used: t.used,
            })),
          });
        }

        return { valid: false };
      }

      console.log('[QuickSign.verifyQuickSign] ✅ Token found in database');

      // التحقق من الاستخدام المسبق
      if (quickSign.used) {
        return {
          valid: false,
          used: true,
          email: quickSign.email,
        };
      }

      // التحقق من انتهاء الصلاحية
      if (new Date() > quickSign.expiresAt) {
        return {
          valid: false,
          expired: true,
          email: quickSign.email,
        };
      }

      // استخدام userId من quickSign مباشرة أو من users relation
      const userId = quickSign.userId || (quickSign as any).users?.id;
      const profileCompleted = (quickSign as any).users?.profileCompleted || false;

      return {
        valid: true,
        email: quickSign.email,
        type: quickSign.type,
        userId,
        profileCompleted,
      };
    } catch (error) {
      // 🔒 تحديد نوع الخطأ بدقة
      const errorName = error?.name || 'UnknownError';
      const errorMessage = error?.message || 'Unknown error';
      
      console.error('[QuickSign.verifyQuickSign] Error occurred:', {
        errorName,
        errorMessage,
      });
      
      // JWT Token Expired - نحاول استخراج البريد من الـ token المنتهي
      if (errorName === 'TokenExpiredError') {
        try {
          // 🔒 فك تشفير JWT للحصول على البريد (بدون التحقق من الصلاحية)
          const decoded = this.jwtService.decode(token) as { email?: string } | null;
          console.log('[QuickSign.verifyQuickSign] Token expired but decoded for email:', decoded?.email);
          return { 
            valid: false, 
            expired: true,
            email: decoded?.email,
          };
        } catch {
          return { valid: false, expired: true };
        }
      }
      
      // Invalid JWT (bad signature, malformed, etc.)
      if (errorName === 'JsonWebTokenError') {
        console.error('[QuickSign.verifyQuickSign] Invalid JWT signature or format');
        return { valid: false };
      }
      
      // Other errors (database, network, etc.)
      console.error(`[QuickSign.verifyQuickSign] Unexpected error:`, error);
      return { valid: false };
    }
  }

  /**
   * التحقق من صلاحية SIGNUP token لإكمال الملف الشخصي
   * هذا يسمح باستخدام token حتى لو كان marked as used
   * طالما لم يتم إنشاء مستخدم بعد
   */
  async verifySignupToken(token: string): Promise<{
    valid: boolean;
    email?: string;
    type?: QuickSignType;
    expired?: boolean;
    alreadyRegistered?: boolean;
  }> {
    try {
      // فك تشفير JWT
      const payload = this.jwtService.verify(token);

      // البحث عن Token في قاعدة البيانات (بالـ hash)
      const tokenHash = this.hashToken(token);
      const quickSign = await this.prisma.quicksign_links.findUnique({
        where: { token: tokenHash }, // 🔒 البحث بالـ hash
      });

      if (!quickSign) {
        return { valid: false };
      }

      // Reject tokens that were already consumed
      if (quickSign.used) {
        return { valid: false, used: true, email: quickSign.email } as any;
      }

      // التحقق من انتهاء الصلاحية
      if (new Date() > quickSign.expiresAt) {
        return {
          valid: false,
          expired: true,
          email: quickSign.email,
        };
      }

      // التحقق من أن هذا token من نوع SIGNUP
      if (quickSign.type !== QuickSignType.SIGNUP) {
        return { valid: false };
      }

      // التحقق إذا كان المستخدم قد سجل بالفعل بهذا البريد
      const existingUser = await this.prisma.user.findUnique({
        where: { email: quickSign.email },
      });

      if (existingUser) {
        return {
          valid: false,
          alreadyRegistered: true,
          email: quickSign.email,
        };
      }

      return {
        valid: true,
        email: quickSign.email,
        type: quickSign.type,
      };
    } catch (error) {
      // 🔒 تحديد نوع الخطأ بدقة
      const errorName = error?.name || 'UnknownError';
      const errorMessage = error?.message || 'Unknown error';
      
      console.warn(`[QuickSign] Signup token verification failed: ${errorName} - ${errorMessage}`);
      
      // JWT Token Expired
      if (errorName === 'TokenExpiredError') {
        return { valid: false, expired: true };
      }
      
      // Invalid JWT or other errors
      return { valid: false };
    }
  }

  /**
   * تحديد QuickSign كمستخدم
   * ⚡ يحدّث Redis + DB
   */
  async markQuickSignAsUsed(token: string): Promise<void> {
    const tokenHash = this.hashToken(token);
    
    // ⚡ تحديث Redis أولاً (سريع)
    const tokenCacheKey = `${this.CACHE_PREFIX}${tokenHash}`;
    const cachedData = await this.redis.get<{ used: boolean; [key: string]: any }>(tokenCacheKey);
    if (cachedData) {
      cachedData.used = true;
      await this.redis.set(tokenCacheKey, cachedData, 60); // نحتفظ لمدة دقيقة فقط
    }

    // تحديث DB (بالـ hash)
    await this.prisma.quicksign_links.update({
      where: { token: tokenHash }, // 🔒 البحث بالـ hash
      data: {
        used: true,
        usedAt: new Date(),
      },
    });
  }

  /**
   * إبطال QuickSign link
   */
  async invalidateQuickSign(token: string): Promise<void> {
    const tokenHash = this.hashToken(token);
    
    // ⚡ حذف من Redis
    const tokenCacheKey = `${this.CACHE_PREFIX}${tokenHash}`;
    await this.redis.del(tokenCacheKey);

    await this.prisma.quicksign_links.updateMany({
      where: { token: tokenHash }, // 🔒 البحث بالـ hash
      data: {
        used: true,
        usedAt: new Date(),
      },
    });
  }

  /**
   * إبطال جميع QuickSign links لبريد معين
   */
  async invalidateAllForEmail(email: string): Promise<void> {
    await this.prisma.quicksign_links.updateMany({
      where: {
        email,
        used: false,
      },
      data: {
        used: true,
        usedAt: new Date(),
      },
    });
  }

  /**
   * تنظيف QuickSign links المنتهية (Cron job)
   */
  async cleanupExpiredLinks(): Promise<number> {
    const result = await this.prisma.quicksign_links.deleteMany({
      where: {
        OR: [
          {
            expiresAt: {
              lt: new Date(),
            },
          },
          {
            used: true,
            usedAt: {
              lt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // حذف المستخدمة بعد 7 أيام
            },
          },
        ],
      },
    });

    return result.count;
  }

  /**
   * 🔒 التحقق واستهلاك التوكن بشكل ذري (Atomic)
   * يمنع race conditions عند فتح الرابط عدة مرات
   */
  async verifyAndConsumeQuickSign(token: string): Promise<{
    valid: boolean;
    email?: string;
    type?: QuickSignType;
    userId?: string;
    used?: boolean;
    expired?: boolean;
    profileCompleted?: boolean;
    error?: 'locked' | 'already_processing';
  }> {
    const tokenHash = this.hashToken(token);
    
    // 🔒 محاولة الحصول على قفل
    const lockAcquired = await this.acquireTokenLock(tokenHash);
    if (!lockAcquired) {
      // التوكن قيد المعالجة بالفعل
      return {
        valid: false,
        error: 'locked',
      };
    }

    try {
      // التحقق من التوكن
      const verification = await this.verifyQuickSign(token);
      
      if (!verification.valid) {
        return verification;
      }

      // 🔒 تعليم التوكن كمستخدم فوراً (داخل القفل)
      // فقط للـ LOGIN - SIGNUP يتم تعليمه عند إكمال الملف الشخصي
      if (verification.type === QuickSignType.LOGIN) {
        await this.markQuickSignAsUsed(token);
      }

      return verification;
    } finally {
      // 🔒 إطلاق القفل دائماً
      await this.releaseTokenLock(tokenHash);
    }
  }

  /**
   * التحقق من وجود QuickSign نشط للبريد
   */
  async hasActiveQuickSign(email: string): Promise<boolean> {
    const activeLink = await this.prisma.quicksign_links.findFirst({
      where: {
        email,
        used: false,
        expiresAt: {
          gt: new Date(),
        },
      },
    });

    return !!activeLink;
  }

  /**
   * الحصول على آخر QuickSign لبريد معين
   */
  async getLatestQuickSign(email: string) {
    return this.prisma.quicksign_links.findFirst({
      where: { email },
      orderBy: { createdAt: 'desc' },
    });
  }
}
