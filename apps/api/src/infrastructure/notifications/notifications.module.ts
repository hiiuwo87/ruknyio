import { Module } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { NotificationsGateway } from './notifications.gateway';
import { PrismaModule } from '../../core/database/prisma/prisma.module';

/**
 * 🔔 Notifications Module
 *
 * نظام إشعارات موحد يدعم:
 * - In-app notifications
 * - Push notifications (FCM)
 * - Email notifications
 * - Real-time via WebSocket
 */
@Module({
  imports: [PrismaModule],
  providers: [NotificationsService, NotificationsGateway],
  exports: [NotificationsService, NotificationsGateway],
})
export class NotificationsModule {}
