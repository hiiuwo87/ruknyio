import {
  Controller,
  Get,
  Put,
  Post,
  Delete,
  Patch,
  Body,
  Param,
  UseGuards,
  Request,
  Query,
  Res,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiResponse,
  ApiBody,
} from '@nestjs/swagger';
import { Response } from 'express';
import { UserService } from './user.service';
import { SecurityLogService } from '../../infrastructure/security/log.service';
import { IpVerificationService } from '../auth/ip-verification.service';
import { JwtAuthGuard } from '../../core/common/guards/auth/jwt-auth.guard';
import {
  UpdateProfileDto,
  Verify2FADto,
  ChangeEmailDto,
  UpdateSecurityPreferencesDto,
  DeactivateAccountDto,
  DeleteAccountDto,
} from './dto';

@ApiTags('User')
@Controller('user')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT-auth')
export class UserController {
  constructor(
    private userService: UserService,
    private securityLogService: SecurityLogService,
    private ipVerificationService: IpVerificationService,
  ) {}

  @Get('profile')
  @ApiOperation({ summary: 'Get current user profile' })
  @ApiResponse({
    status: 200,
    description: 'User profile retrieved successfully',
  })
  async getProfile(@Request() req) {
    return this.userService.getProfile(req.user.id);
  }

  @Put('profile')
  @ApiOperation({ summary: 'Update user profile' })
  @ApiResponse({ status: 200, description: 'Profile updated successfully' })
  async updateProfile(@Request() req, @Body() updateDto: UpdateProfileDto) {
    return this.userService.updateProfile(req.user.id, updateDto);
  }

  @Post('2fa/setup')
  @ApiOperation({ summary: 'Setup 2FA - Get QR Code' })
  @ApiResponse({ status: 200, description: 'QR Code generated successfully' })
  async setup2FA(@Request() req) {
    return this.userService.setup2FA(req.user.id);
  }

  @Post('2fa/verify')
  @ApiOperation({ summary: 'Verify and enable 2FA' })
  @ApiResponse({ status: 200, description: '2FA enabled successfully' })
  async verify2FA(@Request() req, @Body() verifyDto: Verify2FADto) {
    return this.userService.verify2FA(req.user.id, verifyDto.code);
  }

  @Post('2fa/disable')
  @ApiOperation({ summary: 'Disable 2FA' })
  @ApiResponse({ status: 200, description: '2FA disabled successfully' })
  async disable2FA(@Request() req, @Body() verifyDto: Verify2FADto) {
    return this.userService.disable2FA(req.user.id, verifyDto.code);
  }

  @Get('sessions')
  @ApiOperation({ summary: 'Get all active sessions' })
  @ApiResponse({
    status: 200,
    description: 'Active sessions retrieved successfully',
  })
  async getSessions(@Request() req) {
    // استخدام sessionId من JWT مباشرة
    const currentSessionId = req.user?.sessionId;
    return this.userService.getSessions(req.user.id, currentSessionId);
  }

  @Delete('sessions/:sessionId')
  @ApiOperation({ summary: 'Delete specific session (logout from device)' })
  @ApiResponse({ status: 200, description: 'Session deleted successfully' })
  async deleteSession(@Request() req, @Param('sessionId') sessionId: string) {
    // استخراج sessionId من JWT للتأكد من عدم حذف الجلسة الحالية
    const currentSessionId = req.user?.sessionId;
    return this.userService.deleteSession(req.user.id, sessionId, currentSessionId);
  }

  @Delete('sessions')
  @ApiOperation({
    summary: 'Delete all other sessions (logout from all other devices)',
  })
  @ApiResponse({
    status: 200,
    description: 'All other sessions deleted successfully',
  })
  async deleteOtherSessions(@Request() req) {
    // استخراج sessionId من JWT
    const currentSessionId = req.user?.sessionId;
    return this.userService.deleteOtherSessions(req.user.id, currentSessionId);
  }

  @Get('security-logs')
  @ApiOperation({ summary: 'Get security activity logs' })
  @ApiResponse({
    status: 200,
    description: 'Security logs retrieved successfully',
  })
  async getSecurityLogs(
    @Request() req,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('action') action?: string,
  ) {
    return this.securityLogService.getUserLogs({
      userId: req.user.id,
      page: page ? parseInt(page) : 1,
      limit: limit ? parseInt(limit) : 20,
      action: action as any,
    });
  }

  @Get('security-stats')
  @ApiOperation({ summary: 'Get security statistics' })
  @ApiResponse({
    status: 200,
    description: 'Security stats retrieved successfully',
  })
  async getSecurityStats(@Request() req) {
    return this.securityLogService.getLogStats(req.user.id);
  }

  @Delete('security-logs/:logId')
  @ApiOperation({ summary: 'Delete a single security log' })
  @ApiResponse({
    status: 200,
    description: 'Security log deleted successfully',
  })
  async deleteSecurityLog(@Request() req, @Param('logId') logId: string) {
    await this.securityLogService.deleteLog(logId, req.user.id);
    return { message: 'Security log deleted successfully' };
  }

  @Post('security-logs/delete-multiple')
  @ApiOperation({ summary: 'Delete multiple security logs' })
  @ApiResponse({
    status: 200,
    description: 'Security logs deleted successfully',
  })
  async deleteMultipleLogs(@Request() req, @Body() body: { logIds: string[] }) {
    await this.securityLogService.deleteMultipleLogs(body.logIds, req.user.id);
    return {
      message: `${body.logIds.length} security logs deleted successfully`,
    };
  }

  @Get('security-logs/export')
  @ApiOperation({ summary: 'Export security logs (CSV, JSON, PDF)' })
  @ApiResponse({
    status: 200,
    description: 'Security logs exported successfully',
  })
  async exportSecurityLogs(
    @Request() req,
    @Res() res: Response,
    @Query('format') format?: string,
    @Query('action') action?: string,
    @Query('status') status?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const exportFormat = (format || 'csv').toLowerCase();
    const data = await this.securityLogService.exportLogs({
      userId: req.user.id,
      action: action as any,
      status: status as any,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      format: exportFormat as 'csv' | 'json' | 'pdf',
    });

    if (exportFormat === 'csv') {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename=security-logs-${Date.now()}.csv`,
      );
      return res.send(data);
    } else if (exportFormat === 'json') {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename=security-logs-${Date.now()}.json`,
      );
      return res.send(data);
    } else if (exportFormat === 'pdf') {
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename=security-logs-${Date.now()}.pdf`,
      );
      return res.send(data);
    }

    return res
      .status(HttpStatus.BAD_REQUEST)
      .json({ message: 'Invalid export format' });
  }

  @Get('ip-blocklist')
  @ApiOperation({ summary: 'Get blocked IP addresses' })
  @ApiResponse({
    status: 200,
    description: 'Blocked IPs retrieved successfully',
  })
  async getBlockedIPs(@Request() req) {
    return this.securityLogService.getBlockedIPs(req.user.id);
  }

  @Post('ip-blocklist')
  @ApiOperation({ summary: 'Block an IP address' })
  @ApiResponse({ status: 200, description: 'IP address blocked successfully' })
  async blockIP(
    @Request() req,
    @Body() body: { ipAddress: string; reason?: string; expiresAt?: Date },
  ) {
    return this.securityLogService.blockIP({
      userId: req.user.id,
      ipAddress: body.ipAddress,
      reason: body.reason,
      expiresAt: body.expiresAt,
    });
  }

  @Delete('ip-blocklist/:ipId')
  @ApiOperation({ summary: 'Unblock an IP address' })
  @ApiResponse({
    status: 200,
    description: 'IP address unblocked successfully',
  })
  async unblockIP(@Request() req, @Param('ipId') ipId: string) {
    await this.securityLogService.unblockIP(ipId, req.user.id);
    return { message: 'IP address unblocked successfully' };
  }

  @Patch('change-email')
  @ApiOperation({ summary: 'Request email change (requires admin approval)' })
  @ApiResponse({ status: 200, description: 'Email change request submitted' })
  async changeEmail(@Request() req, @Body() changeEmailDto: ChangeEmailDto) {
    const ipAddress = req.ip || req.connection.remoteAddress;
    const userAgent = req.headers['user-agent'];
    return this.userService.changeEmail(
      req.user.id,
      changeEmailDto,
      ipAddress,
      userAgent,
    );
  }

  @Get('email-change-request')
  @ApiOperation({ summary: 'Get latest email change request status' })
  @ApiResponse({ status: 200, description: 'Email change request retrieved' })
  async getEmailChangeRequest(@Request() req) {
    return this.userService.getEmailChangeRequest(req.user.id);
  }

  @Delete('email-change-request')
  @ApiOperation({ summary: 'Cancel pending email change request' })
  @ApiResponse({ status: 200, description: 'Email change request cancelled' })
  async cancelEmailChangeRequest(@Request() req) {
    return this.userService.cancelEmailChangeRequest(req.user.id);
  }

  @Post('send-email-verification')
  @ApiOperation({ summary: 'Send email verification code' })
  @ApiResponse({ status: 200, description: 'Verification code sent' })
  async sendEmailVerification(@Request() req) {
    return this.userService.sendEmailVerification(req.user.id);
  }

  @Post('verify-email')
  @ApiOperation({ summary: 'Verify email with code' })
  @ApiResponse({ status: 200, description: 'Email verified successfully' })
  async verifyEmail(@Request() req, @Body() body: { code: string }) {
    return this.userService.verifyEmailCode(req.user.id, body.code);
  }

  @Get('security-preferences')
  @ApiOperation({ summary: 'Get security alert preferences' })
  @ApiResponse({
    status: 200,
    description: 'Security preferences retrieved successfully',
  })
  async getSecurityPreferences(@Request() req) {
    return this.userService.getSecurityPreferences(req.user.id);
  }

  @Patch('security-preferences')
  @ApiOperation({ summary: 'Update security alert preferences' })
  @ApiResponse({
    status: 200,
    description: 'Security preferences updated successfully',
  })
  async updateSecurityPreferences(
    @Request() req,
    @Body() dto: UpdateSecurityPreferencesDto,
  ) {
    return this.userService.updateSecurityPreferences(req.user.id, dto);
  }

  @Get('security-alert-settings')
  @ApiOperation({ summary: 'Get security alert settings' })
  @ApiResponse({
    status: 200,
    description: 'Security alert settings retrieved successfully',
  })
  async getSecurityAlertSettings(@Request() req) {
    return this.userService.getSecurityAlertSettings(req.user.id);
  }

  @Put('security-alert-settings')
  @ApiOperation({ summary: 'Update security alert settings' })
  @ApiResponse({
    status: 200,
    description: 'Security alert settings updated successfully',
  })
  async updateSecurityAlertSettings(
    @Request() req,
    @Body() dto: UpdateSecurityPreferencesDto,
  ) {
    return this.userService.updateSecurityAlertSettings(req.user.id, dto);
  }

  @Get('trusted-devices')
  @ApiOperation({ summary: 'Get list of trusted devices' })
  @ApiResponse({
    status: 200,
    description: 'Trusted devices retrieved successfully',
  })
  async getTrustedDevices(@Request() req) {
    return this.userService.getTrustedDevices(req.user.id);
  }

  @Delete('trusted-devices/:deviceId')
  @ApiOperation({ summary: 'Remove a trusted device' })
  @ApiResponse({
    status: 200,
    description: 'Trusted device removed successfully',
  })
  async removeTrustedDevice(
    @Request() req,
    @Param('deviceId') deviceId: string,
  ) {
    return this.userService.removeTrustedDevice(req.user.id, deviceId);
  }

  // ==================== IP Alert Settings (Simplified) ====================

  @Get('ip-alerts')
  @ApiOperation({ summary: 'الحصول على إعدادات تنبيهات IP' })
  @ApiResponse({
    status: 200,
    description: 'تم جلب إعدادات التنبيهات بنجاح',
  })
  async getIPAlertSettings(@Request() req) {
    const currentIP = req.ip || req.socket?.remoteAddress || '';
    const settings = await this.ipVerificationService.getAlertSettings(req.user.id);
    
    return {
      alertOnNewIP: settings.alertOnNewIP,
      trustedIpCount: settings.trustedIpCount,
      lastLoginAt: settings.lastLoginAt,
      currentIP: this.ipVerificationService.getMaskedIP(currentIP),
    };
  }

  @Put('ip-alerts')
  @ApiOperation({ summary: 'تحديث إعدادات تنبيهات IP' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        alertOnNewIP: { type: 'boolean', description: 'إرسال تنبيه عند تسجيل دخول من IP جديد' },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'تم تحديث الإعدادات بنجاح',
  })
  async updateIPAlertSettings(
    @Request() req,
    @Body() body: { alertOnNewIP?: boolean },
  ) {
    await this.ipVerificationService.updateAlertSettings(req.user.id, body);
    
    await this.securityLogService.createLog({
      userId: req.user.id,
      action: 'SECURITY_SETTINGS_CHANGED',
      status: 'SUCCESS',
      description: `تم ${body.alertOnNewIP ? 'تفعيل' : 'تعطيل'} تنبيهات IP الجديد`,
      ipAddress: req.ip || req.socket?.remoteAddress,
      userAgent: req.headers['user-agent'],
    });

    return {
      message: 'تم تحديث الإعدادات بنجاح',
      settings: await this.ipVerificationService.getAlertSettings(req.user.id),
    };
  }

  @Get('trusted-ips')
  @ApiOperation({ summary: 'الحصول على عدد IPs الموثوقة' })
  @ApiResponse({
    status: 200,
    description: 'تم جلب عدد IPs الموثوقة بنجاح',
  })
  async getTrustedIPsCount(@Request() req) {
    const count = await this.ipVerificationService.getTrustedIPCount(req.user.id);
    return { 
      count,
      message: 'لا يمكن عرض قائمة IPs لأنها مخزنة كـ fingerprints مشفرة'
    };
  }

  @Post('trusted-ips/add-current')
  @ApiOperation({ summary: 'إضافة IP الحالي للقائمة الموثوقة' })
  @ApiResponse({
    status: 200,
    description: 'تم إضافة IP الحالي للقائمة الموثوقة بنجاح',
  })
  async addCurrentIPToTrusted(@Request() req) {
    const currentIP = req.ip || req.socket?.remoteAddress || '';
    
    if (!currentIP) {
      return { message: 'لم يتم التعرف على عنوان IP الحالي' };
    }

    const result = await this.ipVerificationService.addCurrentIPToTrusted(req.user.id, currentIP);
    
    if (result.success) {
      await this.securityLogService.createLog({
        userId: req.user.id,
        action: 'SECURITY_SETTINGS_CHANGED',
        status: 'SUCCESS',
        description: 'تم إضافة IP الحالي للموثوقة',
        ipAddress: currentIP,
        userAgent: req.headers['user-agent'],
      });

      return { 
        message: 'تم إضافة IP الحالي للقائمة الموثوقة بنجاح',
        maskedIP: result.maskedIP,
      };
    }

    return { message: 'فشل في إضافة IP' };
  }

  @Delete('trusted-ips/clear')
  @ApiOperation({ summary: 'مسح جميع IPs الموثوقة' })
  @ApiResponse({
    status: 200,
    description: 'تم مسح جميع IPs الموثوقة بنجاح',
  })
  async clearTrustedIPs(@Request() req) {
    await this.ipVerificationService.clearTrustedIPs(req.user.id);
    
    await this.securityLogService.createLog({
      userId: req.user.id,
      action: 'SECURITY_SETTINGS_CHANGED',
      status: 'SUCCESS',
      description: 'تم مسح جميع IPs الموثوقة',
      ipAddress: req.ip || req.socket?.remoteAddress,
      userAgent: req.headers['user-agent'],
    });

    return { message: 'تم مسح جميع IPs الموثوقة بنجاح' };
  }

  // ==================== Account Management ====================

  @Patch('deactivate')
  @ApiOperation({ summary: 'تعطيل الحساب مؤقتاً' })
  @ApiResponse({
    status: 200,
    description: 'تم تعطيل الحساب بنجاح',
  })
  async deactivateAccount(
    @Request() req,
    @Body() dto: DeactivateAccountDto,
  ) {
    const ipAddress = req.ip || req.connection?.remoteAddress;
    return this.userService.deactivateAccount(req.user.id, dto, ipAddress);
  }

  @Patch('reactivate')
  @ApiOperation({ summary: 'إعادة تفعيل الحساب' })
  @ApiResponse({
    status: 200,
    description: 'تم إعادة تفعيل الحساب بنجاح',
  })
  async reactivateAccount(@Request() req) {
    const ipAddress = req.ip || req.connection?.remoteAddress;
    return this.userService.reactivateAccount(req.user.id, ipAddress);
  }

  @Delete('account')
  @ApiOperation({ summary: 'حذف الحساب نهائياً' })
  @ApiResponse({
    status: 200,
    description: 'تم حذف الحساب نهائياً',
  })
  async deleteAccount(@Request() req, @Body() dto: DeleteAccountDto) {
    const ipAddress = req.ip || req.connection?.remoteAddress;
    return this.userService.deleteAccount(req.user.id, dto, ipAddress);
  }
}
