import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma/prisma.service';
import { NotificationsGateway } from './notifications.gateway';
import { NotificationType as PrismaNotificationType } from '@prisma/client';

export type NotificationType =
  | 'order'
  | 'event'
  | 'security'
  | 'payment'
  | 'system'
  | 'promotion'
  | 'reminder';

// Map internal types to Prisma enum
const notificationTypeMapping: Record<NotificationType, PrismaNotificationType> = {
  order: PrismaNotificationType.NEW_ORDER,
  event: PrismaNotificationType.EVENT_STATUS_CHANGED,
  security: PrismaNotificationType.ORDER_STATUS_CHANGED,
  payment: PrismaNotificationType.PAYMENT_RECEIVED,
  system: PrismaNotificationType.ORDER_STATUS_CHANGED,
  promotion: PrismaNotificationType.PRICE_DROP,
  reminder: PrismaNotificationType.EVENT_STATUS_CHANGED,
};

export type NotificationChannel = 'in-app' | 'push' | 'email' | 'sms';

export interface NotificationPayload {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  data?: Record<string, any>;
  channels?: NotificationChannel[];
  actionUrl?: string;
  imageUrl?: string;
  priority?: 'low' | 'normal' | 'high';
}

/**
 * 🔔 Notifications Service
 *
 * خدمة موحدة لإرسال الإشعارات
 */
@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsGateway: NotificationsGateway,
  ) {}

  /**
   * إرسال إشعار
   */
  async send(payload: NotificationPayload): Promise<{ id: string }> {
    const channels = payload.channels || ['in-app'];
    let notificationId: string = '';

    // In-app notification
    if (channels.includes('in-app')) {
      const notification = await this.createInAppNotification(payload);
      notificationId = notification.id;

      // إرسال فوري عبر WebSocket
      this.notificationsGateway.sendToUser(payload.userId, notification);
    }

    // Push notification
    if (channels.includes('push')) {
      await this.sendPushNotification(payload);
    }

    // Email - يتم عبر Queue عادةً
    if (channels.includes('email')) {
      this.logger.debug(`Email notification queued for ${payload.userId}`);
    }

    return { id: notificationId };
  }

  /**
   * إرسال إشعار لعدة مستخدمين
   */
  async sendToMany(
    userIds: string[],
    notification: Omit<NotificationPayload, 'userId'>,
  ): Promise<{ sent: number }> {
    let sent = 0;

    for (const userId of userIds) {
      try {
        await this.send({ ...notification, userId });
        sent++;
      } catch (error) {
        this.logger.warn(`Failed to send to ${userId}: ${error.message}`);
      }
    }

    return { sent };
  }

  /**
   * إنشاء إشعار in-app
   */
  private async createInAppNotification(
    payload: NotificationPayload,
  ): Promise<any> {
    return this.prisma.notifications.create({
      data: {
        userId: payload.userId,
        type: notificationTypeMapping[payload.type] || PrismaNotificationType.ORDER_STATUS_CHANGED,
        title: payload.title,
        message: payload.body,
        data: payload.data || null,
        isRead: false,
      },
    });
  }

  /**
   * إرسال Push notification
   */
  private async sendPushNotification(
    payload: NotificationPayload,
  ): Promise<void> {
    // Push notifications disabled - no pushToken model in schema
    this.logger.debug(
      `Push notification skipped for ${payload.userId} - not implemented`,
    );
  }

  /**
   * الحصول على إشعارات المستخدم
   */
  async getUserNotifications(
    userId: string,
    options: {
      page?: number;
      limit?: number;
      unreadOnly?: boolean;
    } = {},
  ): Promise<{
    notifications: any[];
    total: number;
    unreadCount: number;
  }> {
    const { page = 1, limit = 20, unreadOnly = false } = options;

    const where: any = { userId };
    if (unreadOnly) {
      where.isRead = false;
    }

    const [notifications, total, unreadCount] = await Promise.all([
      this.prisma.notifications.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.notifications.count({ where }),
      this.prisma.notifications.count({ where: { userId, isRead: false } }),
    ]);

    return { notifications, total, unreadCount };
  }

  /**
   * تحديد إشعار كمقروء
   */
  async markAsRead(notificationId: string, userId: string): Promise<void> {
    await this.prisma.notifications.updateMany({
      where: { id: notificationId, userId },
      data: { isRead: true },
    });
  }

  /**
   * تحديد جميع الإشعارات كمقروءة
   */
  async markAllAsRead(userId: string): Promise<{ updated: number }> {
    const result = await this.prisma.notifications.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });

    return { updated: result.count };
  }

  /**
   * حذف إشعار
   */
  async delete(notificationId: string, userId: string): Promise<void> {
    await this.prisma.notifications.deleteMany({
      where: { id: notificationId, userId },
    });
  }

  /**
   * حذف الإشعارات القديمة
   */
  async deleteOld(daysToKeep: number = 30): Promise<{ deleted: number }> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    const result = await this.prisma.notifications.deleteMany({
      where: {
        createdAt: { lt: cutoffDate },
        isRead: true,
      },
    });

    return { deleted: result.count };
  }

  // ==================== Quick Notification Methods ====================

  async notifyNewOrder(
    userId: string,
    orderId: string,
    amount: number,
  ): Promise<void> {
    await this.send({
      userId,
      type: 'order',
      title: 'طلب جديد 🎉',
      body: `لديك طلب جديد بقيمة ${amount.toLocaleString()} د.ع`,
      data: { orderId, amount },
      actionUrl: `/dashboard/orders/${orderId}`,
      channels: ['in-app', 'push'],
      priority: 'high',
    });
  }

  async notifyOrderStatusChange(
    userId: string,
    orderId: string,
    status: string,
  ): Promise<void> {
    const statusMessages: Record<string, string> = {
      confirmed: 'تم تأكيد طلبك',
      shipped: 'طلبك في الطريق',
      delivered: 'تم تسليم طلبك',
      cancelled: 'تم إلغاء طلبك',
    };

    await this.send({
      userId,
      type: 'order',
      title: statusMessages[status] || 'تحديث الطلب',
      body: `تم تحديث حالة طلبك إلى: ${status}`,
      data: { orderId, status },
      actionUrl: `/orders/${orderId}`,
      channels: ['in-app', 'push'],
    });
  }

  async notifyEventReminder(
    userId: string,
    eventId: string,
    eventTitle: string,
    startsIn: string,
  ): Promise<void> {
    await this.send({
      userId,
      type: 'reminder',
      title: 'تذكير بالحدث ⏰',
      body: `${eventTitle} سيبدأ ${startsIn}`,
      data: { eventId },
      actionUrl: `/events/${eventId}`,
      channels: ['in-app', 'push', 'email'],
      priority: 'high',
    });
  }

  async notifySecurityAlert(
    userId: string,
    alertType: string,
    description: string,
  ): Promise<void> {
    await this.send({
      userId,
      type: 'security',
      title: 'تنبيه أمني 🔒',
      body: description,
      data: { alertType },
      actionUrl: '/settings/security',
      channels: ['in-app', 'push', 'email'],
      priority: 'high',
    });
  }

  async notifyPaymentReceived(
    userId: string,
    amount: number,
    currency: string,
  ): Promise<void> {
    await this.send({
      userId,
      type: 'payment',
      title: 'تم استلام الدفعة 💰',
      body: `تم استلام ${amount.toLocaleString()} ${currency}`,
      data: { amount, currency },
      actionUrl: '/dashboard/payments',
      channels: ['in-app', 'email'],
    });
  }

  async notifySubscriptionExpiring(
    userId: string,
    daysLeft: number,
  ): Promise<void> {
    await this.send({
      userId,
      type: 'system',
      title: 'اشتراكك ينتهي قريباً',
      body: `متبقي ${daysLeft} أيام على انتهاء اشتراكك`,
      actionUrl: '/settings/subscription',
      channels: ['in-app', 'email'],
    });
  }
}
