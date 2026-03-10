import { Controller, Get, Post, Body, Delete, Param, UseGuards } from '@nestjs/common';
import { RateLimitingService } from './rate-limiting.service';

/**
 * 🎛️ Rate Limiting Controller
 *
 * إدارة تحديد معدل الطلبات
 */
@Controller('admin/rate-limiting')
// @UseGuards(AdminGuard) // يجب إضافة حارس للمشرفين
export class RateLimitingController {
  constructor(private readonly rateLimitingService: RateLimitingService) {}

  /**
   * الحصول على إحصائيات Rate Limiting
   */
  @Get('statistics')
  async getStatistics() {
    return this.rateLimitingService.getStatistics();
  }

  /**
   * الحصول على حالة معرف محدد
   */
  @Get('status/:identifier')
  async getStatus(@Param('identifier') identifier: string) {
    return this.rateLimitingService.getRateLimitStatus(identifier);
  }

  /**
   * إعادة تعيين حد مستخدم
   */
  @Post('reset/user/:userId')
  async resetUserLimit(
    @Param('userId') userId: string,
    @Body('endpoint') endpoint?: string,
  ) {
    await this.rateLimitingService.resetUserLimit(userId, endpoint);
    return { success: true, message: `Reset rate limits for user ${userId}` };
  }

  /**
   * إضافة إلى القائمة البيضاء
   */
  @Post('whitelist')
  async addToWhitelist(
    @Body('identifier') identifier: string,
    @Body('duration') duration?: number,
  ) {
    await this.rateLimitingService.addToWhitelist(identifier, duration);
    return { success: true, message: `Added ${identifier} to whitelist` };
  }

  /**
   * إزالة من القائمة البيضاء
   */
  @Delete('whitelist/:identifier')
  async removeFromWhitelist(@Param('identifier') identifier: string) {
    await this.rateLimitingService.removeFromWhitelist(identifier);
    return { success: true, message: `Removed ${identifier} from whitelist` };
  }
}
