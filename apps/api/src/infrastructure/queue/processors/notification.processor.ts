import { Process, Processor, OnQueueFailed } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { PrismaService } from '../../../core/database/prisma/prisma.service';
import { NotificationType } from '@prisma/client';

// Map internal types to Prisma enum
const typeMapping: Record<string, NotificationType> = {
  event: NotificationType.EVENT_STATUS_CHANGED,
  order: NotificationType.NEW_ORDER,
  general: NotificationType.ORDER_STATUS_CHANGED,
  security: NotificationType.ORDER_STATUS_CHANGED,
  payment: NotificationType.PAYMENT_RECEIVED,
};

/**
 * 🔔 Notification Processor
 *
 * معالج مهام الإشعارات
 */
@Processor('notification')
export class NotificationProcessor {
  private readonly logger = new Logger(NotificationProcessor.name);

  constructor(private readonly prisma: PrismaService) {}

  @Process('event-reminder')
  async handleEventReminder(
    job: Job<{
      userId: string;
      title: string;
      body: string;
      data: { eventId: string; startDate: string };
      channels: string[];
    }>,
  ) {
    this.logger.debug(`Processing event reminder for user ${job.data.userId}`);

    const { userId, title, body, data, channels } = job.data;

    // إنشاء إشعار in-app
    if (channels.includes('in-app')) {
      await this.createInAppNotification(userId, title, body, 'event', data);
    }

    // إرسال Push notification
    if (channels.includes('push')) {
      await this.sendPushNotification(userId, title, body, data);
    }

    this.logger.log(`Event reminder sent to user ${userId}`);
  }

  @Process('new-order')
  async handleNewOrder(
    job: Job<{
      userId: string;
      title: string;
      body: string;
      data: { orderId: string; amount: number };
      channels: string[];
    }>,
  ) {
    this.logger.debug(`Processing new order notification for ${job.data.userId}`);

    const { userId, title, body, data, channels } = job.data;

    if (channels.includes('in-app')) {
      await this.createInAppNotification(userId, title, body, 'order', data);
    }

    if (channels.includes('push')) {
      await this.sendPushNotification(userId, title, body, data);
    }

    this.logger.log(`New order notification sent to user ${userId}`);
  }

  @Process('general')
  async handleGeneral(
    job: Job<{
      userId: string;
      title: string;
      body: string;
      data?: Record<string, any>;
      channels: string[];
    }>,
  ) {
    const { userId, title, body, data, channels } = job.data;

    if (channels.includes('in-app')) {
      await this.createInAppNotification(userId, title, body, 'general', data);
    }

    if (channels.includes('push')) {
      await this.sendPushNotification(userId, title, body, data);
    }

    this.logger.log(`General notification sent to user ${userId}`);
  }

  // ==================== Helper Methods ====================

  private async createInAppNotification(
    userId: string,
    title: string,
    body: string,
    type: string,
    data?: Record<string, any>,
  ): Promise<void> {
    try {
      const notificationType = typeMapping[type] || NotificationType.ORDER_STATUS_CHANGED;
      await this.prisma.notifications.create({
        data: {
          userId,
          title,
          message: body,
          type: notificationType,
          data: data || null,
          isRead: false,
        },
      });
    } catch (error) {
      this.logger.warn(`Failed to create in-app notification: ${error.message}`);
    }
  }

  private async sendPushNotification(
    userId: string,
    title: string,
    body: string,
    data?: Record<string, any>,
  ): Promise<void> {
    // Push notifications disabled - no pushToken model in schema
    this.logger.debug(`Push notification skipped for user ${userId} - not implemented`);
  }

  private async sendToDevice(
    token: string,
    platform: string,
    title: string,
    body: string,
    data?: Record<string, any>,
  ): Promise<void> {
    // TODO: تكامل مع FCM أو OneSignal
    this.logger.debug(`Would send push to ${platform} device: ${token.substring(0, 20)}...`);
  }

  @OnQueueFailed()
  onFailed(job: Job, error: Error) {
    this.logger.error(
      `Notification job ${job.id} failed: ${error.message}`,
    );
  }
}
