import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma/prisma.service';
import * as webpush from 'web-push';

@Injectable()
export class PushSubscriptionService {
  private readonly logger = new Logger(PushSubscriptionService.name);

  constructor(private prisma: PrismaService) {
    // Initialize web-push with VAPID keys from environment
    const vapidPublicKey = process.env.VAPID_PUBLIC_KEY;
    const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
    const vapidSubject = process.env.VAPID_SUBJECT || 'mailto:notifications@rukny.work';

    // Only set VAPID details if keys are properly configured (not placeholders)
    if (
      vapidPublicKey &&
      vapidPrivateKey &&
      !vapidPublicKey.includes('YOUR_VAPID') &&
      !vapidPrivateKey.includes('YOUR_VAPID') &&
      vapidPublicKey.length > 20 &&
      vapidPrivateKey.length > 20
    ) {
      try {
        webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
        this.logger.log('Web Push notifications initialized successfully');
      } catch (error) {
        this.logger.warn(`Invalid VAPID keys - push notifications disabled: ${error.message}`);
      }
    } else {
      this.logger.warn('⚠️ VAPID keys not configured - Web Push notifications disabled. Run: npx web-push generate-vapid-keys');
    }
  }

  /**
   * Subscribe user to push notifications
   */
  async subscribeToPush(
    userId: string,
    subscription: PushSubscriptionInput,
    userAgent?: string
  ) {
    try {
      const existing = await this.prisma.pushSubscription.findUnique({
        where: { endpoint: subscription.endpoint },
      });

      if (existing) {
        // Update existing subscription
        return await this.prisma.pushSubscription.update({
          where: { id: existing.id },
          data: {
            auth: subscription.keys.auth,
            p256dh: subscription.keys.p256dh,
            userAgent,
            isActive: true,
            updatedAt: new Date(),
          },
        });
      }

      // Create new subscription
      return await this.prisma.pushSubscription.create({
        data: {
          userId,
          endpoint: subscription.endpoint,
          auth: subscription.keys.auth,
          p256dh: subscription.keys.p256dh,
          userAgent,
          isActive: true,
        },
      });
    } catch (error) {
      this.logger.error(`Error subscribing to push: ${error.message}`);
      throw error;
    }
  }

  /**
   * Unsubscribe user from push notifications
   */
  async unsubscribeFromPush(endpoint: string) {
    try {
      const subscription = await this.prisma.pushSubscription.findUnique({
        where: { endpoint },
      });

      if (!subscription) {
        return null;
      }

      return await this.prisma.pushSubscription.delete({
        where: { id: subscription.id },
      });
    } catch (error) {
      this.logger.error(`Error unsubscribing from push: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get all active subscriptions for a user
   */
  async getUserSubscriptions(userId: string) {
    return await this.prisma.pushSubscription.findMany({
      where: {
        userId,
        isActive: true,
      },
      select: {
        id: true,
        endpoint: true,
        createdAt: true,
        lastUsedAt: true,
        userAgent: true,
      },
    });
  }

  /**
   * Send push notification to user
   */
  async sendPushToUser(
    userId: string,
    notification: PushNotificationPayload
  ) {
    // Check if VAPID keys are configured
    if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY ||
        process.env.VAPID_PUBLIC_KEY.includes('YOUR_VAPID') ||
        process.env.VAPID_PRIVATE_KEY.includes('YOUR_VAPID')) {
      this.logger.warn('VAPID keys not configured - cannot send push notifications');
      return { sent: 0, failed: 0 };
    }

    try {
      const subscriptions = await this.prisma.pushSubscription.findMany({
        where: {
          userId,
          isActive: true,
        },
      });

      if (subscriptions.length === 0) {
        this.logger.debug(`No push subscriptions found for user ${userId}`);
        return { sent: 0, failed: 0 };
      }

      const payload = JSON.stringify(notification);
      let sent = 0;
      let failed = 0;

      for (const subscription of subscriptions) {
        try {
          await webpush.sendNotification(
            {
              endpoint: subscription.endpoint,
              keys: {
                auth: subscription.auth,
                p256dh: subscription.p256dh,
              },
            },
            payload
          );

          // Update last used time
          await this.prisma.pushSubscription.update({
            where: { id: subscription.id },
            data: { lastUsedAt: new Date() },
          });

          sent++;
        } catch (error: any) {
          this.logger.warn(`Failed to send push notification: ${error.message}`);

          // Mark subscription as inactive if endpoint is invalid
          if (error.statusCode === 410 || error.statusCode === 404) {
            await this.prisma.pushSubscription.update({
              where: { id: subscription.id },
              data: { isActive: false },
            });
          }

          failed++;
        }
      }

      return { sent, failed };
    } catch (error) {
      this.logger.error(`Error sending push notification: ${error.message}`);
      throw error;
    }
  }

  /**
   * Send push notification to all users (broadcast)
   */
  async broadcastPush(notification: PushNotificationPayload) {
    // Check if VAPID keys are configured
    if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY ||
        process.env.VAPID_PUBLIC_KEY.includes('YOUR_VAPID') ||
        process.env.VAPID_PRIVATE_KEY.includes('YOUR_VAPID')) {
      this.logger.warn('VAPID keys not configured - cannot broadcast push notifications');
      return { sent: 0, failed: 0, total: 0 };
    }

    try {
      const subscriptions = await this.prisma.pushSubscription.findMany({
        where: { isActive: true },
        select: {
          id: true,
          userId: true,
          endpoint: true,
          auth: true,
          p256dh: true,
        },
      });

      const payload = JSON.stringify(notification);
      let sent = 0;
      let failed = 0;

      for (const subscription of subscriptions) {
        try {
          await webpush.sendNotification(
            {
              endpoint: subscription.endpoint,
              keys: {
                auth: subscription.auth,
                p256dh: subscription.p256dh,
              },
            },
            payload
          );

          await this.prisma.pushSubscription.update({
            where: { id: subscription.id },
            data: { lastUsedAt: new Date() },
          });

          sent++;
        } catch (error: any) {
          if (error.statusCode === 410 || error.statusCode === 404) {
            await this.prisma.pushSubscription.update({
              where: { id: subscription.id },
              data: { isActive: false },
            });
          }
          failed++;
        }
      }

      return { sent, failed, total: subscriptions.length };
    } catch (error) {
      this.logger.error(`Error broadcasting push notification: ${error.message}`);
      throw error;
    }
  }

  /**
   * Clean up inactive subscriptions
   */
  async cleanupInactiveSubscriptions() {
    try {
      const result = await this.prisma.pushSubscription.deleteMany({
        where: {
          isActive: false,
          lastUsedAt: {
            lt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days
          },
        },
      });

      this.logger.debug(`Cleaned up ${result.count} inactive push subscriptions`);
      return result.count;
    } catch (error) {
      this.logger.error(`Error cleaning up inactive subscriptions: ${error.message}`);
      throw error;
    }
  }
}

export interface PushSubscriptionInput {
  endpoint: string;
  keys: {
    auth: string;
    p256dh: string;
  };
}

export interface PushNotificationPayload {
  title: string;
  body?: string;
  icon?: string;
  badge?: string;
  tag?: string;
  data?: Record<string, any>;
}
