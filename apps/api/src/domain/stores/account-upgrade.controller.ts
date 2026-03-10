import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AccountUpgradeService } from './account-upgrade.service';
import {
  UpgradeAccountDto,
  GuestDataSummaryDto,
  UpgradeResultDto,
} from './dto/account-upgrade.dto';

/**
 * 🚀 API ترقية الحساب
 *
 * تحويل حساب الضيف إلى حساب كامل
 */
@ApiTags('Account Upgrade - ترقية الحساب')
@Controller('account')
export class AccountUpgradeController {
  constructor(private readonly upgradeService: AccountUpgradeService) {}

  /**
   * 📊 جلب ملخص بيانات الضيف قبل الترقية
   */
  @Get('guest-summary')
  @ApiOperation({ summary: 'جلب ملخص بيانات الضيف' })
  @ApiResponse({
    status: 200,
    description: 'ملخص البيانات',
    type: GuestDataSummaryDto,
  })
  async getGuestSummary(@Query('phoneNumber') phoneNumber: string) {
    return this.upgradeService.getGuestDataSummary(phoneNumber);
  }

  /**
   * 🚀 ترقية حساب الضيف
   */
  @Post('upgrade')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 3, ttl: 3600000 } }) // 3 محاولات في الساعة
  @ApiOperation({ summary: 'ترقية حساب الضيف إلى حساب كامل' })
  @ApiResponse({
    status: 200,
    description: 'تم الترقية بنجاح',
    type: UpgradeResultDto,
  })
  @ApiResponse({ status: 409, description: 'البريد أو الهاتف مستخدم' })
  async upgradeAccount(@Body() dto: UpgradeAccountDto) {
    return this.upgradeService.upgradeAccount(dto);
  }
}
