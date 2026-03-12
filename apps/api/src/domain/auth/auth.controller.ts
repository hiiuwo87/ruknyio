import { Controller, Post, Body, HttpCode, HttpStatus, Get, UseGuards, Req, Res, Delete, Param, Query, ForbiddenException, UnauthorizedException, ConflictException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { TokenService } from './token.service';
import { ExchangeCodeDto, UpdateOAuthProfileDto } from './dto';
import { JwtAuthGuard } from '../../core/common/guards/auth/jwt-auth.guard';
import { GoogleAuthGuard } from '../../core/common/guards/auth/google-auth.guard';
import { LinkedInAuthGuard } from '../../core/common/guards/auth/linkedin-auth.guard';
import { CurrentUser } from '../../core/common/decorators/auth/current-user.decorator';
import { Request, Response } from 'express';
import { OAuthCodeService } from './oauth-code.service';
import { RedisOAuthCodeService } from './redis-oauth-code.service';
import { WebSocketTokenService } from './websocket-token.service';
import { SecurityLogService } from '../../infrastructure/security/log.service';
import { Throttle } from '@nestjs/throttler';
import { randomUUID } from 'crypto';
import { 
  setAccessTokenCookie,
  setRefreshTokenCookie,
  setCsrfTokenCookie,
  clearAuthCookies,
  clearRefreshTokenCookie, 
  extractAccessToken, 
  extractRefreshToken,
  validateCsrfOrigin,
  generateCsrfToken,
} from './cookie.config';
import { PrismaService } from '../../core/database/prisma/prisma.service';

// Throttle policies:
// - Production: strict
// - Development: more lenient to avoid blocking mobile/local testing when the client retries
const AUTH_REFRESH_THROTTLE =
  process.env.NODE_ENV === 'production'
    ? { default: { limit: 30, ttl: 60000 } } // 30 requests per minute
    : { default: { limit: 300, ttl: 60000 } }; // 300 requests per minute (dev only)

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private tokenService: TokenService,
    private oauthCodeService: RedisOAuthCodeService, // Use Redis implementation
    private webSocketTokenService: WebSocketTokenService,
    private securityLogService: SecurityLogService,
    private prisma: PrismaService,
  ) {}

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 60, ttl: 60000 } }) // 60 requests per minute
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get current user' })
  @ApiResponse({ status: 200, description: 'Current user retrieved' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 429, description: 'Too many requests' })
  async getMe(@CurrentUser() user: any) {
    return user;
  }

  /**
   * 🔐 Update OAuth User Profile
   * POST /auth/update-profile
   * 
   * Used by OAuth users (Google/LinkedIn) to complete their profile
   * with name and username after signup
   */
  @Post('update-profile')
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @ApiBearerAuth('JWT-auth')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update OAuth user profile (name and username)' })
  @ApiResponse({ status: 200, description: 'Profile updated successfully' })
  @ApiResponse({ status: 400, description: 'Invalid data' })
  @ApiResponse({ status: 409, description: 'Username already taken' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async updateOAuthProfile(
    @Body() dto: UpdateOAuthProfileDto,
    @CurrentUser() user: any,
    @Req() req: Request,
  ) {
    // Check if username is available
    const existingProfile = await this.prisma.profile.findUnique({
      where: { username: dto.username },
    });

    if (existingProfile && existingProfile.userId !== user.id) {
      throw new ConflictException('اسم المستخدم محجوز بالفعل');
    }

    // Update user and profile
    const updated = await this.prisma.user.update({
      where: { id: user.id },
      data: {
        profileCompleted: true,
        phoneNumber: dto.phone || null,
        lastLoginAt: new Date(),
        profile: {
          upsert: {
            create: {
              id: randomUUID(),
              username: dto.username,
              name: dto.name,
            },
            update: {
              username: dto.username,
              name: dto.name,
            },
          },
        },
      },
      include: {
        profile: true,
      },
    });

    // Log the update
    await this.securityLogService.createLog({
      userId: user.id,
      action: 'PROFILE_UPDATE' as any,
      status: 'SUCCESS' as any,
      description: 'تم تحديث الملف الشخصي (OAuth user)',
      ipAddress: req.ip || req.socket.remoteAddress,
      userAgent: req.headers['user-agent'],
    });

    return {
      success: true,
      user: {
        id: updated.id,
        email: updated.email,
        role: updated.role,
        name: updated.profile?.name,
        username: updated.profile?.username,
        avatar: updated.profile?.avatar,
        profileCompleted: updated.profileCompleted,
      },
      message: 'تم تحديث الملف الشخصي بنجاح',
    };
  }

  /**
   * 🔒 سجل النشاط للمستخدم (استغلال SecurityLog الموجود)
   */
  @Get('activity')
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 30, ttl: 60000 } }) // 30 requests per minute
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get current user activity log (security log)' })
  @ApiResponse({ status: 200, description: 'Activity log retrieved' })
  @ApiResponse({ status: 429, description: 'Too many requests' })
  async getActivity(
    @CurrentUser() user: any,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('action') action?: string,
  ) {
    return this.securityLogService.getUserLogs({
      userId: user.id,
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
      action: action as any,
    });
  }

  @Get('ws-token')
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 20, ttl: 60000 } }) // 20 requests per minute
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get WebSocket authentication token' })
  @ApiResponse({ status: 200, description: 'WebSocket token generated' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getWebSocketToken(@CurrentUser() user: any) {
    const token = this.webSocketTokenService.generateToken(user.id);
    return { token, expiresIn: 300 }; // 5 minutes
  }

  /**
   * 🔒 GET handler for refresh endpoint - returns error (must use POST)
   * This prevents 404 errors from browser prefetch/speculative requests
   */
  @Get('refresh')
  @HttpCode(HttpStatus.METHOD_NOT_ALLOWED)
  @ApiOperation({ summary: 'Refresh endpoint - must use POST' })
  @ApiResponse({ status: 405, description: 'Method not allowed - use POST' })
  refreshTokensGet() {
    return {
      success: false,
      error: 'Method Not Allowed',
      message: 'Use POST /auth/refresh to refresh tokens',
    };
  }

  /**
   * 🔒 تجديد التوكنز باستخدام Refresh Token
   * 
   * Refresh Token في httpOnly Cookie → Access Token في Response Body
   * 
   * الحماية:
   * - SameSite=Lax (يسمح بـ OAuth redirect)
   * - Origin/Referer validation (حماية CSRF إضافية)
   * - Rate limiting
   */
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @Throttle(AUTH_REFRESH_THROTTLE)
  @ApiOperation({ summary: 'Refresh access token using refresh token from cookie' })
  @ApiResponse({ status: 200, description: 'New access token returned in body' })
  @ApiResponse({ status: 401, description: 'Invalid or expired refresh token' })
  @ApiResponse({ status: 403, description: 'CSRF validation failed' })
  async refreshTokens(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    // 🔒 CSRF Protection - التحقق من Origin
    const csrfCheck = validateCsrfOrigin(req);
    if (!csrfCheck.valid) {
      throw new ForbiddenException(`CSRF validation failed: ${csrfCheck.reason}`);
    }

    const refreshToken = extractRefreshToken(req);
    
    if (!refreshToken) {
      // 🔒 مسح الكوكي في حالة عدم وجود token
      clearRefreshTokenCookie(res);
      throw new UnauthorizedException('Refresh token not found. Please login again.');
    }

    const userAgent = req.headers['user-agent'];
    const ipAddress = req.ip || req.socket.remoteAddress;

    try {
      // 🔒 تجديد التوكنز مع التدوير (Rotation)
      const tokens = await this.tokenService.refreshTokens(
        refreshToken,
        ipAddress,
        userAgent,
      );

      // 🔒 Access Token في httpOnly Cookie
      setAccessTokenCookie(res, tokens.accessToken);
      
      // 🔒 Refresh Token الجديد في httpOnly Cookie
      setRefreshTokenCookie(res, tokens.refreshToken);

      // 🔒 توليد CSRF Token جديد
      const csrfToken = generateCsrfToken();
      setCsrfTokenCookie(res, csrfToken);

      // 🔒 Response - لا نُرسل التوكنات في الـ body (فقط في cookies)
      return {
        success: true,
        message: 'Tokens refreshed successfully',
        csrf_token: csrfToken, // 🔒 CSRF token للـ frontend
        expires_in: 30 * 60, // 30 minutes - matches access token JWT and cookie
      };
    } catch (error) {
      // 🔒 مسح الكوكي الفاسدة عند فشل التجديد
      // هذا يمنع الحلقة اللانهائية من محاولات التجديد
      clearRefreshTokenCookie(res);
      throw error;
    }
  }

  /**
   * 🔒 الحصول على الجلسات النشطة للمستخدم
   */
  @Get('sessions')
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 30, ttl: 60000 } }) // 30 requests per minute
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get user active sessions' })
  @ApiResponse({ status: 200, description: 'Active sessions retrieved' })
  @ApiResponse({ status: 429, description: 'Too many requests' })
  async getActiveSessions(@CurrentUser() user: any) {
    return this.tokenService.getUserActiveSessions(user.id);
  }

  /**
   * 🔒 تسجيل الخروج من جميع الأجهزة
   */
  @Post('logout-all')
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 5, ttl: 60000 } }) // 5 requests per minute (sensitive action)
  @ApiBearerAuth('JWT-auth')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Logout from all devices' })
  @ApiResponse({ status: 200, description: 'Logged out from all devices' })
  @ApiResponse({ status: 429, description: 'Too many requests' })
  async logoutAll(
    @CurrentUser() user: any,
    @Res({ passthrough: true }) res: Response,
    @Req() req: Request,
  ) {
    const count = await this.tokenService.revokeAllUserSessions(
      user.id,
      'User requested logout from all devices',
    );

    // 🔒 تسجيل النشاط الأمني
    const userAgent = req.headers['user-agent'];
    const ipAddress = req.ip || req.socket.remoteAddress;
    await this.securityLogService.createLog({
      userId: user.id,
      action: 'LOGOUT_ALL_DEVICES' as any,
      status: 'SUCCESS' as any,
      description: `تسجيل الخروج من جميع الأجهزة (${count} جلسات)`,
      ipAddress,
      userAgent,
    });

    // 🔒 مسح جميع Auth Cookies
    clearAuthCookies(res);

    return {
      success: true,
      message: `تم تسجيل الخروج من ${count} جهاز`,
      devicesLoggedOut: count,
    };
  }

  /**
   * 🔒 إبطال جلسة معينة
   */
  @Delete('sessions/:sessionId')
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 10, ttl: 60000 } }) // 10 requests per minute
  @ApiBearerAuth('JWT-auth')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Revoke a specific session' })
  @ApiResponse({ status: 200, description: 'Session revoked successfully' })
  @ApiResponse({ status: 429, description: 'Too many requests' })
  async revokeSession(
    @CurrentUser() user: any,
    @Param('sessionId') sessionId: string,
  ) {
    await this.tokenService.revokeSession(sessionId, 'User revoked session');
    return {
      success: true,
      message: 'تم إنهاء الجلسة بنجاح',
    };
  }

  /**
   * 🔒 تسجيل الخروج - يعمل حتى مع توكن منتهي أو جلسة مُبطلة
   * لا نستخدم JwtAuthGuard حتى يصل الطلب دائماً ونُمسح الكوكيز ونُبطل الجلسة إن وُجدت
   */
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Logout user (works with expired token)' })
  @ApiResponse({ status: 200, description: 'User successfully logged out' })
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const token = extractAccessToken(req);

    // 1. إبطال الجلسة في DB أولاً (حتى مع توكن منتهي)
    const result = await this.authService.logout(token);

    // 2. مسح جميع Auth Cookies دائماً (حتى لو لم توجد جلسة)
    clearAuthCookies(res);

    return result;
  }

  @Get('google')
  @UseGuards(GoogleAuthGuard)
  @ApiOperation({ summary: 'Google OAuth login' })
  @ApiResponse({ status: 302, description: 'Redirect to Google OAuth' })
  async googleAuth(@Req() req: Request) {
    // Guard redirects to Google
  }

  @Get('google/callback')
  @UseGuards(GoogleAuthGuard)
  @ApiOperation({ summary: 'Google OAuth callback' })
  @ApiResponse({ status: 200, description: 'Google OAuth successful' })
  async googleAuthCallback(@Req() req: any, @Res() res: Response) {
    const userAgent = req.headers['user-agent'];
    const ipAddress = req.ip || req.socket.remoteAddress;
    
    const result = await this.authService.googleLogin(req.user, userAgent, ipAddress);
    
    // 🔒 لا نضع Cookie هنا - سيُضبط في /oauth/exchange
    // السبب: redirect من port 3001 إلى 3000 يُعتبر cross-origin

    // Generate one-time code with Access Token AND Refresh Token
    const code = await this.oauthCodeService.generate({
      access_token: result.access_token,
      refresh_token: result.refresh_token, // ✅ أضفنا refresh_token
      user: result.user,
      needsProfileCompletion: result.needsProfileCompletion,
    });

    // Redirect with code only — في التطوير استخدم FRONTEND_URL_DEV إن وُجد
    const base =
      process.env.NODE_ENV === 'development' && process.env.FRONTEND_URL_DEV
        ? process.env.FRONTEND_URL_DEV
        : process.env.AUTH_FRONTEND_URL || process.env.FRONTEND_URL || 'http://localhost:3000';
    const redirectUrl = `${base}/auth/callback?code=${code}`;
    res.redirect(redirectUrl);
  }

  @Post('oauth/exchange')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 50, ttl: 60000 } }) // 50 requests per minute (lenient for development/debugging)
  @ApiOperation({ summary: 'Exchange one-time OAuth code for access token' })
  @ApiResponse({ status: 200, description: 'Access token returned in body, refresh token in cookie' })
  @ApiResponse({ status: 400, description: 'Invalid or expired code' })
  async exchangeOAuthCode(
    @Body() body: ExchangeCodeDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    // 🔒 Debug: Log incoming code exchange request
    console.log('[OAuth Exchange] Code exchange started:', {
      codeLength: body.code?.length,
      codePreview: body.code?.substring(0, 20) + '...',
    });

    try {
      const exchanged = await this.oauthCodeService.exchange(body.code);
      console.log('[OAuth Exchange] Code exchanged successfully:', {
        hasAccessToken: !!exchanged.access_token,
        hasRefreshToken: !!exchanged.refresh_token,
        userId: exchanged.user?.id,
        needsProfileCompletion: exchanged.needsProfileCompletion,
      });

      const { access_token, refresh_token, user, needsProfileCompletion } = exchanged;
    
      // 🔒 Access Token في httpOnly Cookie
      if (access_token) {
        console.log('[OAuth Exchange] Setting access_token cookie...');
        setAccessTokenCookie(res, access_token);
        console.log('[OAuth Exchange] ✅ Access token cookie appended');
      }
      
      // 🔒 Refresh Token في httpOnly Cookie
      if (refresh_token) {
        console.log('[OAuth Exchange] Setting refresh_token cookie...');
        setRefreshTokenCookie(res, refresh_token);
        console.log('[OAuth Exchange] ✅ Refresh token cookie appended');
      }

      // 🔒 توليد CSRF Token
      const csrfToken = generateCsrfToken();
      console.log('[OAuth Exchange] Generated CSRF token:', csrfToken.substring(0, 20) + '...');
      console.log('[OAuth Exchange] Setting CSRF token cookie...');
      setCsrfTokenCookie(res, csrfToken);
      console.log('[OAuth Exchange] ✅ CSRF token cookie appended');
      
      // Log all Set-Cookie headers in response
      console.log('[OAuth Exchange] Response headers before return:');
      res.getHeaders()['set-cookie'] && console.log('  Set-Cookie count:', (res.getHeaders()['set-cookie'] as string[]).length);
      
      // 🔒 Response - لا نُرسل التوكنات في الـ body
      const response = { 
        success: true,
        csrf_token: csrfToken,
        expires_in: 30 * 60, // 30 minutes - matches access token JWT and cookie
        user,
        needsProfileCompletion,
        message: 'Tokens stored in httpOnly cookies',
      };

      console.log('[OAuth Exchange] ✅ Response ready:', {
        success: response.success,
        hasCsrfToken: !!response.csrf_token,
        userId: response.user?.id,
        needsProfileCompletion: response.needsProfileCompletion,
      });

      return response;
    } catch (error) {
      console.error('[OAuth Exchange] ❌ Code exchange failed:', error instanceof Error ? error.message : error);
      throw error;
    }
  }

  @Get('linkedin')
  @UseGuards(LinkedInAuthGuard)
  @ApiOperation({ summary: 'LinkedIn OAuth login' })
  @ApiResponse({ status: 302, description: 'Redirect to LinkedIn OAuth' })
  async linkedinAuth(@Req() req: Request) {
    // Guard redirects to LinkedIn
  }

  @Get('linkedin/callback')
  @UseGuards(LinkedInAuthGuard)
  @ApiOperation({ summary: 'LinkedIn OAuth callback' })
  @ApiResponse({ status: 200, description: 'LinkedIn OAuth successful' })
  async linkedinAuthCallback(@Req() req: any, @Res() res: Response) {
    const userAgent = req.headers['user-agent'];
    const ipAddress = req.ip || req.socket.remoteAddress;
    
    const result = await this.authService.linkedinLogin(req.user, userAgent, ipAddress);

    // 🔒 لا نضع Cookie هنا - سيُضبط في /oauth/exchange
    // السبب: redirect من port 3001 إلى 3000 يُعتبر cross-origin

    // Generate one-time code with Access Token AND Refresh Token
    const code = await this.oauthCodeService.generate({
      access_token: result.access_token,
      refresh_token: result.refresh_token, // ✅ أضفنا refresh_token
      user: result.user,
      needsProfileCompletion: result.needsProfileCompletion,
    });

    // Redirect with code only — في التطوير استخدم FRONTEND_URL_DEV إن وُجد
    const base =
      process.env.NODE_ENV === 'development' && process.env.FRONTEND_URL_DEV
        ? process.env.FRONTEND_URL_DEV
        : process.env.AUTH_FRONTEND_URL || process.env.FRONTEND_URL || 'http://localhost:3000';
    const redirectUrl = `${base}/auth/callback?code=${code}`;
    res.redirect(redirectUrl);
  }
}
