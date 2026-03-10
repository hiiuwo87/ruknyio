import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
  Req,
  Res,
  Param,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { Request, Response } from 'express';
import { TwoFactorService } from './two-factor.service';
import { TokenService } from './token.service';
import { PrismaService } from '../../core/database/prisma/prisma.service';
import { SecurityLogService } from '../../infrastructure/security/log.service';
import { SecurityDetectorService } from '../../infrastructure/security/detector.service';
import { JwtAuthGuard } from '../../core/common/guards/auth/jwt-auth.guard';
import { CurrentUser } from '../../core/common/decorators/auth/current-user.decorator';
import { Throttle } from '@nestjs/throttler';
import { 
  setAccessTokenCookie,
  setRefreshTokenCookie,
  setCsrfTokenCookie,
  generateCsrfToken,
  setTrustedDeviceCookie,
} from './cookie.config';
import { UAParser } from 'ua-parser-js';
import {
  Verify2FADto,
  Verify2FALoginDto,
  Disable2FADto,
  RegenerateBackupCodesDto,
  Setup2FAResponseDto,
  TwoFactorStatusDto,
  EnableTwoFactorResponseDto,
} from './dto/two-factor.dto';

const isProduction = process.env.NODE_ENV === 'production';

/**
 * 🔐 Two-Factor Authentication Controller
 *
 * إدارة المصادقة الثنائية (2FA)
 * - إعداد 2FA مع QR Code
 * - التحقق وتفعيل 2FA
 * - إلغاء تفعيل 2FA
 * - إدارة الرموز الاحتياطية
 * - التحقق عند تسجيل الدخول
 */
@ApiTags('Two-Factor Authentication')
@Controller('auth/2fa')
export class TwoFactorController {
  constructor(
    private twoFactorService: TwoFactorService,
    private tokenService: TokenService,
    private prisma: PrismaService,
    private securityLogService: SecurityLogService,
    private securityDetectorService: SecurityDetectorService,
  ) {}

  /**
   * 📊 حالة المصادقة الثنائية
   */
  @Get('status')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'الحصول على حالة المصادقة الثنائية' })
  @ApiResponse({
    status: 200,
    description: 'حالة 2FA',
    type: TwoFactorStatusDto,
  })
  async getStatus(@CurrentUser() user: any): Promise<TwoFactorStatusDto> {
    return this.twoFactorService.getStatus(user.id);
  }

  /**
   * 🔧 إعداد المصادقة الثنائية (الخطوة 1)
   *
   * ينشئ مفتاحاً سرياً و QR Code
   * يجب على المستخدم مسح الـ QR وإدخال الرمز للتفعيل
   */
  @Post('setup')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 3600000 } }) // 5 مرات في الساعة
  @ApiOperation({ summary: 'إعداد المصادقة الثنائية - الخطوة 1' })
  @ApiResponse({
    status: 200,
    description: 'QR Code والمفتاح السري',
    type: Setup2FAResponseDto,
  })
  @ApiResponse({ status: 400, description: '2FA مفعل بالفعل' })
  async setup(
    @CurrentUser() user: any,
    @Req() req: Request,
  ): Promise<Setup2FAResponseDto> {
    const result = await this.twoFactorService.generateSetup(user.id);

    // تسجيل في Security Log
    await this.securityLogService.createLog({
      userId: user.id,
      action: 'TWO_FA_ENABLED',
      status: 'SUCCESS',
      description: 'بدأ إعداد المصادقة الثنائية',
      ipAddress: req.ip || req.socket.remoteAddress,
      userAgent: req.headers['user-agent'],
    });

    return result;
  }

  /**
   * ✅ تفعيل المصادقة الثنائية (الخطوة 2)
   *
   * يتحقق من الرمز ويفعل 2FA
   */
  @Post('enable')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60000 } }) // 10 محاولات في الدقيقة
  @ApiOperation({ summary: 'تفعيل المصادقة الثنائية - الخطوة 2' })
  @ApiResponse({
    status: 200,
    description: 'تم التفعيل بنجاح',
    type: EnableTwoFactorResponseDto,
  })
  @ApiResponse({ status: 401, description: 'رمز غير صحيح' })
  async enable(
    @CurrentUser() user: any,
    @Body() dto: Verify2FADto,
    @Req() req: Request,
  ): Promise<EnableTwoFactorResponseDto> {
    const result = await this.twoFactorService.verifyAndEnable(
      user.id,
      dto.token,
    );

    // تسجيل في Security Log
    await this.securityLogService.createLog({
      userId: user.id,
      action: 'TWO_FA_ENABLED',
      status: 'SUCCESS',
      description: 'تم تفعيل المصادقة الثنائية',
      ipAddress: req.ip || req.socket.remoteAddress,
      userAgent: req.headers['user-agent'],
    });

    return {
      success: true,
      backupCodes: result.backupCodes,
      message:
        'تم تفعيل المصادقة الثنائية بنجاح. احتفظ بالرموز الاحتياطية في مكان آمن!',
    };
  }

  /**
   * ❌ إلغاء تفعيل المصادقة الثنائية
   */
  @Delete('disable')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 3600000 } }) // 5 مرات في الساعة
  @ApiOperation({ summary: 'إلغاء تفعيل المصادقة الثنائية' })
  @ApiResponse({ status: 200, description: 'تم إلغاء التفعيل' })
  @ApiResponse({ status: 401, description: 'رمز غير صحيح' })
  async disable(
    @CurrentUser() user: any,
    @Body() dto: Disable2FADto,
    @Req() req: Request,
  ) {
    await this.twoFactorService.disable(user.id, dto.token);

    // تسجيل في Security Log
    await this.securityLogService.createLog({
      userId: user.id,
      action: 'TWO_FA_DISABLED',
      status: 'WARNING',
      description: 'تم إلغاء تفعيل المصادقة الثنائية',
      ipAddress: req.ip || req.socket.remoteAddress,
      userAgent: req.headers['user-agent'],
    });

    return {
      success: true,
      message: 'تم إلغاء تفعيل المصادقة الثنائية',
    };
  }

  /**
   * 🔄 إعادة توليد الرموز الاحتياطية
   */
  @Post('backup-codes/regenerate')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 3, ttl: 3600000 } }) // 3 مرات في الساعة
  @ApiOperation({ summary: 'إعادة توليد الرموز الاحتياطية' })
  @ApiResponse({ status: 200, description: 'الرموز الاحتياطية الجديدة' })
  async regenerateBackupCodes(
    @CurrentUser() user: any,
    @Body() dto: RegenerateBackupCodesDto,
    @Req() req: Request,
  ) {
    const result = await this.twoFactorService.regenerateBackupCodes(
      user.id,
      dto.token,
    );

    // تسجيل في Security Log
    await this.securityLogService.createLog({
      userId: user.id,
      action: 'TWO_FA_VERIFIED',
      status: 'SUCCESS',
      description: 'تم إعادة توليد الرموز الاحتياطية',
      ipAddress: req.ip || req.socket.remoteAddress,
      userAgent: req.headers['user-agent'],
    });

    return {
      success: true,
      backupCodes: result.backupCodes,
      message: 'تم توليد رموز احتياطية جديدة. الرموز القديمة لم تعد صالحة!',
    };
  }

  /**
   * 🔓 التحقق من 2FA عند تسجيل الدخول
   *
   * يُستخدم بعد التحقق الأولي (QuickSign/OAuth) إذا كان 2FA مفعلاً
   */
  @Post('verify-login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60000 } }) // 🔒 10 محاولات في الدقيقة (منع brute force)
  @ApiOperation({ summary: 'التحقق من 2FA عند تسجيل الدخول' })
  @ApiResponse({ status: 200, description: 'تم التحقق بنجاح وإصدار التوكنز' })
  @ApiResponse({ status: 401, description: 'رمز غير صحيح أو جلسة منتهية' })
  async verifyLogin(
    @Body() dto: Verify2FALoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const userAgent = req.headers['user-agent'];
    const ipAddress = req.ip || req.socket.remoteAddress;

    // استرجاع بيانات الجلسة المعلقة من الـ Cache أو DB
    // (يتم إنشاؤها في QuickSign/OAuth عندما يكون 2FA مطلوباً)
    const pendingSession = await this.getPendingTwoFactorSession(
      dto.pendingSessionId,
    );

    if (!pendingSession) {
      // 🔒 مسح أي جلسة منتهية من قاعدة البيانات
      await this.deletePendingTwoFactorSession(dto.pendingSessionId);
      
      return {
        success: false,
        error: 'انتهت صلاحية جلستك. يرجى تسجيل الدخول مرة أخرى',
        expired: true,
      };
    }

    // التحقق من الرمز
    const verification = await this.twoFactorService.verifyToken(
      pendingSession.userId,
      dto.token,
    );

    if (!verification.valid) {
      // تسجيل المحاولة الفاشلة
      await this.securityLogService.createLog({
        userId: pendingSession.userId,
        action: 'LOGIN_FAILED',
        status: 'FAILED',
        description: 'محاولة فاشلة للتحقق من 2FA',
        ipAddress,
        userAgent,
      });

      return {
        success: false,
        error: 'رمز التحقق غير صحيح',
      };
    }

    // حذف الجلسة المعلقة
    await this.deletePendingTwoFactorSession(dto.pendingSessionId);

    // إنشاء التوكنز
    const user = await this.prisma.user.findUnique({
      where: { id: pendingSession.userId },
      select: {
        id: true,
        email: true,
        role: true,
        profile: {
          select: {
            name: true,
            username: true,
            avatar: true,
          },
        },
      },
    });

    const { tokens } = await this.tokenService.generateTokenPair(
      user.id,
      user.email,
      { userId: user.id, userAgent, ipAddress },
    );

    // 🔒 إعداد Access Token في httpOnly Cookie
    setAccessTokenCookie(res, tokens.accessToken);
    
    // 🔒 إعداد Refresh Token Cookie
    setRefreshTokenCookie(res, tokens.refreshToken);

    // 🔒 توليد CSRF Token
    const csrfToken = generateCsrfToken();
    setCsrfTokenCookie(res, csrfToken);

    // Parse device info for logging
    const parser = new UAParser(userAgent);
    const result = parser.getResult();

    // تذكر هذا الجهاز: إنشاء جهاز موثوق وتفعيل الكوكي
    if (dto.rememberDevice) {
      const deviceId = await this.securityDetectorService.rememberDeviceFor2FA(user.id, {
        browser: result.browser.name,
        os: result.os.name,
        deviceType: result.device.type || 'desktop',
        ipAddress,
        userAgent,
      });
      setTrustedDeviceCookie(res, deviceId);
    }

    // تسجيل النجاح
    await this.securityLogService.createLog({
      userId: user.id,
      action: 'LOGIN_SUCCESS',
      status: 'SUCCESS',
      description: verification.usedBackupCode
        ? 'تسجيل دخول ناجح بعد 2FA (رمز احتياطي)'
        : 'تسجيل دخول ناجح بعد 2FA',
      ipAddress,
      deviceType: result.device.type || 'desktop',
      browser: result.browser.name || 'Unknown',
      os: result.os.name || 'Unknown',
      userAgent,
    });

    return {
      success: true,
      usedBackupCode: verification.usedBackupCode || false,
      csrf_token: csrfToken,
      expires_in: 30 * 60, // 30 minutes - matches access token
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        name: user.profile?.name,
        username: user.profile?.username,
        avatar: user.profile?.avatar,
      },
      message: verification.usedBackupCode
        ? 'تم تسجيل الدخول بنجاح. تم استخدام رمز احتياطي.'
        : 'تم تسجيل الدخول بنجاح',
    };
  }

  /**
   * 🔍 التحقق من صلاحية جلسة 2FA المعلقة (Endpoint عام)
   * يُستخدم من الـ frontend للتحقق من صلاحية الجلسة قبل إدخال الرمز
   */
  @Get('check-session/:sessionId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'التحقق من صلاحية جلسة 2FA المعلقة' })
  @ApiResponse({ status: 200, description: 'الجلسة صالحة' })
  @ApiResponse({ status: 404, description: 'الجلسة منتهية أو غير موجودة' })
  async checkSession(@Param('sessionId') sessionId: string) {
    const session = await this.getPendingTwoFactorSession(sessionId);
    
    if (!session) {
      return {
        valid: false,
        error: 'جلسة التحقق منتهية أو غير موجودة. يرجى إعادة تسجيل الدخول',
      };
    }

    return {
      valid: true,
      email: session.email,
    };
  }

  /**
   * 🔍 استرجاع جلسة 2FA المعلقة
   */
  private async getPendingTwoFactorSession(sessionId: string): Promise<{
    userId: string;
    email: string;
  } | null> {
    if (!sessionId) return null;

    const pending = await this.prisma.pendingTwoFactorSession.findUnique({
      where: { id: sessionId },
    });

    if (!pending) {
      if (!isProduction) console.log('[2FA] Session not found:', sessionId);
      return null;
    }

    // 🔒 التحقق من انتهاء الصلاحية بدقة (مع buffer صغير لتجنب مشاكل timezone)
    const now = new Date();
    const expiresAt = new Date(pending.expiresAt);
    const timeUntilExpiry = expiresAt.getTime() - now.getTime();
    
    if (timeUntilExpiry <= 0) {
      if (!isProduction) {
        console.log('[2FA] Session expired:', {
          sessionId,
          expiresAt: expiresAt.toISOString(),
          now: now.toISOString(),
          timeUntilExpiry: `${Math.round(timeUntilExpiry / 1000)}s`,
        });
      }
      return null;
    }

    if (!isProduction) {
      console.log('[2FA] Session valid:', {
        sessionId,
        expiresAt: expiresAt.toISOString(),
        timeUntilExpiry: `${Math.round(timeUntilExpiry / 1000)}s`,
      });
    }

    return {
      userId: pending.userId,
      email: pending.email,
    };
  }

  /**
   * 🗑️ حذف جلسة 2FA المعلقة
   */
  private async deletePendingTwoFactorSession(
    sessionId: string,
  ): Promise<void> {
    if (!sessionId) return;

    await this.prisma.pendingTwoFactorSession
      .delete({
        where: { id: sessionId },
      })
      .catch(() => {
        /* ignore if not found */
      });
  }
}
