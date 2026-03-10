import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { AccountLockoutService } from './account-lockout.service';
import { JwtAuthGuard } from '../../core/common/guards/auth/jwt-auth.guard';
import { RolesGuard } from '../../core/common/guards/roles.guard';
import { Roles } from '../../core/common/decorators/auth/roles.decorator';
import { CurrentUser } from '../../core/common/decorators/auth/current-user.decorator';
import { Throttle } from '@nestjs/throttler';
import {
  CheckLockoutDto,
  UnlockAccountDto,
  LockoutStatusResponseDto,
} from './dto/account-lockout.dto';

/**
 * 🔒 Account Lockout Controller
 *
 * إدارة قفل الحسابات وفحص الحالة
 */
@ApiTags('Account Lockout')
@Controller('auth/lockout')
export class AccountLockoutController {
  constructor(private lockoutService: AccountLockoutService) {}

  /**
   * 🔍 فحص حالة القفل (للمستخدم)
   */
  @Get('status')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({ summary: 'فحص حالة قفل الحساب' })
  @ApiQuery({ name: 'email', required: true, description: 'البريد الإلكتروني' })
  @ApiResponse({
    status: 200,
    description: 'حالة القفل',
    type: LockoutStatusResponseDto,
  })
  async checkStatus(@Query('email') email: string) {
    const stats = await this.lockoutService.getLockoutStats(email);
    const maxAttempts = 5; // من الإعدادات

    return {
      isLocked: stats.isLocked,
      lockoutUntil: stats.lockoutUntil,
      lockCount: stats.lockCount,
      recentAttempts: stats.recentAttempts,
      remainingAttempts: Math.max(0, maxAttempts - stats.recentAttempts),
      lastAttempt: stats.lastAttempt,
    };
  }

  /**
   * 🔓 فتح قفل الحساب (للمشرفين فقط)
   */
  @Post('unlock')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth('JWT-auth')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'فتح قفل الحساب (للمشرفين)' })
  @ApiResponse({ status: 200, description: 'تم فتح القفل بنجاح' })
  @ApiResponse({ status: 403, description: 'غير مصرح' })
  async unlockAccount(
    @Body() dto: UnlockAccountDto,
    @CurrentUser() admin: any,
  ) {
    await this.lockoutService.unlockAccount(dto.email, admin.id);

    return {
      success: true,
      message: `تم فتح قفل الحساب ${dto.email} بنجاح`,
    };
  }

  /**
   * 📊 إحصائيات القفل (للمشرفين)
   */
  @Get('admin/stats')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'إحصائيات القفل (للمشرفين)' })
  @ApiResponse({ status: 200, description: 'إحصائيات القفل' })
  async getAdminStats(@Query('email') email?: string) {
    if (email) {
      return this.lockoutService.getLockoutStats(email);
    }

    // TODO: إضافة إحصائيات عامة
    return {
      message: 'أدخل بريد إلكتروني للحصول على إحصائيات محددة',
    };
  }

  /**
   * 🧹 تنظيف المحاولات القديمة (للمشرفين)
   */
  @Post('admin/cleanup')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth('JWT-auth')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'تنظيف المحاولات القديمة' })
  @ApiResponse({ status: 200, description: 'تم التنظيف' })
  async cleanup() {
    const deletedCount = await this.lockoutService.cleanupOldAttempts();

    return {
      success: true,
      deletedAttempts: deletedCount,
      message: `تم حذف ${deletedCount} محاولة قديمة`,
    };
  }
}
