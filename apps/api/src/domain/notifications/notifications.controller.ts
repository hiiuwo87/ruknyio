import {
  Controller,
  Get,
  Patch,
  Delete,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../core/common/guards/auth/jwt-auth.guard';
import { CurrentUser } from '../../core/common/decorators/auth/current-user.decorator';
import {
  NotificationsService,
  NotificationResponseDto,
} from './notifications.service';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';

@ApiTags('notifications')
@ApiBearerAuth()
@Controller('notifications')
@UseGuards(JwtAuthGuard, ThrottlerGuard)
@Throttle({ default: { limit: 100, ttl: 60000 } }) // 100 requests per minute
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  @ApiOperation({ summary: 'جلب جميع الإشعارات' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'offset', required: false, type: Number })
  @ApiQuery({ name: 'unreadOnly', required: false, type: Boolean })
  @ApiQuery({ name: 'type', required: false, type: String })
  @ApiResponse({
    status: 200,
    description: 'تم جلب الإشعارات بنجاح',
  })
  async findAll(
    @CurrentUser('id') userId: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Query('unreadOnly') unreadOnly?: string,
    @Query('type') type?: string,
  ) {
    return this.notificationsService.findAllForUser(userId, {
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
      unreadOnly: unreadOnly === 'true',
      type: type as any,
    });
  }

  @Get('unread-count')
  @ApiOperation({ summary: 'جلب عدد الإشعارات غير المقروءة' })
  @ApiResponse({
    status: 200,
    description: 'عدد الإشعارات غير المقروءة',
  })
  async getUnreadCount(@CurrentUser('id') userId: string) {
    const count = await this.notificationsService.getUnreadCount(userId);
    return { unreadCount: count };
  }

  @Get(':id')
  @ApiOperation({ summary: 'جلب إشعار محدد' })
  @ApiResponse({
    status: 200,
    description: 'تم جلب الإشعار بنجاح',
  })
  @ApiResponse({
    status: 404,
    description: 'الإشعار غير موجود',
  })
  @ApiResponse({
    status: 403,
    description: 'لا يمكنك الوصول لهذا الإشعار',
  })
  async findOne(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
  ): Promise<NotificationResponseDto> {
    return this.notificationsService.findOne(id, userId);
  }

  @Patch(':id/read')
  @ApiOperation({ summary: 'تحديد إشعار كمقروء' })
  @ApiResponse({
    status: 200,
    description: 'تم تحديد الإشعار كمقروء',
  })
  async markAsRead(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
  ): Promise<NotificationResponseDto> {
    return this.notificationsService.markAsRead(id, userId);
  }

  @Patch('read-all')
  @ApiOperation({ summary: 'تحديد جميع الإشعارات كمقروءة' })
  @ApiResponse({
    status: 200,
    description: 'تم تحديد جميع الإشعارات كمقروءة',
  })
  async markAllAsRead(@CurrentUser('id') userId: string) {
    return this.notificationsService.markAllAsRead(userId);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'حذف إشعار' })
  @ApiResponse({
    status: 204,
    description: 'تم حذف الإشعار بنجاح',
  })
  async remove(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
  ): Promise<void> {
    return this.notificationsService.remove(id, userId);
  }

  @Delete()
  @ApiOperation({ summary: 'حذف جميع الإشعارات' })
  @ApiResponse({
    status: 200,
    description: 'تم حذف جميع الإشعارات',
  })
  async removeAll(@CurrentUser('id') userId: string) {
    return this.notificationsService.removeAll(userId);
  }
}
