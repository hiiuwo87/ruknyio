import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma/prisma.service';
import { CacheManager } from '../../core/cache/cache.manager';
import { CacheKeys, CACHE_TTL, CACHE_TAGS } from '../../core/cache/cache.constants';
import { NotificationType } from '@prisma/client';
import { randomUUID } from 'crypto';

// DTO for creating a notification
export interface CreateNotificationDto {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  data?: any;
  eventId?: string;
}

// DTO for notification response
export interface NotificationResponseDto {
  id: string;
  type: string;
  title: string;
  message: string;
  data?: any;
  eventId?: string;
  isRead: boolean;
  createdAt: Date;
}

// Sanitize sensitive data before storing
const sanitizeNotificationData = (data: any): any => {
  if (!data) return null;

  const sensitiveFields = ['ipAddress', 'ip', 'password', 'token', 'secret'];
  const sanitized = { ...data };

  sensitiveFields.forEach((field) => {
    if (sanitized[field]) {
      if (field === 'ipAddress' || field === 'ip') {
        // Keep only first two octets for reference
        const ip = sanitized[field];
        sanitized[field] = ip.includes('.')
          ? ip.split('.').slice(0, 2).join('.') + '.*.*'
          : '[hidden]';
      } else {
        delete sanitized[field];
      }
    }
  });

  return sanitized;
};

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private readonly MAX_NOTIFICATIONS_PER_USER = 100;
  private readonly NOTIFICATION_RETENTION_DAYS = 30;

  constructor(
    private readonly prisma: PrismaService,
    private readonly cacheManager: CacheManager,
  ) {}

  /**
   * Create a new notification
   */
  async create(dto: CreateNotificationDto): Promise<NotificationResponseDto> {
    this.logger.log(
      `Creating notification for user ${dto.userId}: ${dto.type}`,
    );

    // Sanitize data before storing
    const sanitizedData = sanitizeNotificationData(dto.data);

    // Create the notification
    const notification = await this.prisma.notifications.create({
      data: {
        id: randomUUID(),
        userId: dto.userId,
        type: dto.type,
        title: dto.title,
        message: dto.message,
        data: sanitizedData,
        // eventId will be available after running prisma migrate
      } as any,
    });

    // 🔥 Invalidate notifications cache
    await this.invalidateUserCache(dto.userId);

    // Cleanup old notifications (async, don't wait)
    this.cleanupOldNotifications(dto.userId).catch((err) =>
      this.logger.error(`Failed to cleanup notifications: ${err.message}`),
    );

    return this.toResponseDto(notification);
  }

  /**
   * 🔥 Invalidate user's notifications cache
   */
  private async invalidateUserCache(userId: string): Promise<void> {
    try {
      await this.cacheManager.invalidate(
        CacheKeys.notificationsList(userId),
        CacheKeys.notificationsUnreadCount(userId),
      );
    } catch (error) {
      this.logger.warn(`Failed to invalidate cache for user ${userId}: ${error.message}`);
    }
  }

  /**
   * Get all notifications for a user - ✅ Cached for 30 seconds
   */
  async findAllForUser(
    userId: string,
    options: {
      limit?: number;
      offset?: number;
      unreadOnly?: boolean;
      type?: NotificationType;
    } = {},
  ): Promise<{
    notifications: NotificationResponseDto[];
    total: number;
    unreadCount: number;
  }> {
    const { limit = 50, offset = 0, unreadOnly = false, type } = options;

    // Only cache default list (no filters, first page)
    const shouldCache = !unreadOnly && !type && offset === 0 && limit === 50;
    const cacheKey = CacheKeys.notificationsList(userId);

    if (shouldCache) {
      return this.cacheManager.wrap(
        cacheKey,
        CACHE_TTL.SHORT, // 30 seconds - notifications change frequently
        async () => this.fetchNotifications(userId, options),
        { tags: [CACHE_TAGS.NOTIFICATION] },
      );
    }

    return this.fetchNotifications(userId, options);
  }

  /**
   * Internal method to fetch notifications
   */
  private async fetchNotifications(
    userId: string,
    options: {
      limit?: number;
      offset?: number;
      unreadOnly?: boolean;
      type?: NotificationType;
    },
  ): Promise<{
    notifications: NotificationResponseDto[];
    total: number;
    unreadCount: number;
  }> {
    const { limit = 50, offset = 0, unreadOnly = false, type } = options;

    const where: any = { userId };
    if (unreadOnly) where.isRead = false;
    if (type) where.type = type;

    const [notifications, total, unreadCount] = await Promise.all([
      this.prisma.notifications.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      this.prisma.notifications.count({ where }),
      this.prisma.notifications.count({ where: { userId, isRead: false } }),
    ]);

    return {
      notifications: notifications.map((n) => this.toResponseDto(n)),
      total,
      unreadCount,
    };
  }

  /**
   * Get a single notification
   */
  async findOne(id: string, userId: string): Promise<NotificationResponseDto> {
    const notification = await this.prisma.notifications.findUnique({
      where: { id },
    });

    if (!notification) {
      throw new NotFoundException('الإشعار غير موجود');
    }

    if (notification.userId !== userId) {
      throw new ForbiddenException('لا يمكنك الوصول لهذا الإشعار');
    }

    return this.toResponseDto(notification);
  }

  /**
   * Mark a notification as read
   */
  async markAsRead(
    id: string,
    userId: string,
  ): Promise<NotificationResponseDto> {
    // Verify ownership first
    await this.findOne(id, userId);

    const notification = await this.prisma.notifications.update({
      where: { id },
      data: { isRead: true },
    });

    // 🔥 Invalidate cache
    await this.invalidateUserCache(userId);

    return this.toResponseDto(notification);
  }

  /**
   * Mark all notifications as read for a user
   */
  async markAllAsRead(userId: string): Promise<{ count: number }> {
    const result = await this.prisma.notifications.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });

    // 🔥 Invalidate cache
    await this.invalidateUserCache(userId);

    this.logger.log(
      `Marked ${result.count} notifications as read for user ${userId}`,
    );
    return { count: result.count };
  }

  /**
   * Delete a notification
   */
  async remove(id: string, userId: string): Promise<void> {
    // Verify ownership first
    await this.findOne(id, userId);

    await this.prisma.notifications.delete({
      where: { id },
    });

    // 🔥 Invalidate cache
    await this.invalidateUserCache(userId);

    this.logger.log(`Deleted notification ${id} for user ${userId}`);
  }

  /**
   * Delete all notifications for a user
   */
  async removeAll(userId: string): Promise<{ count: number }> {
    const result = await this.prisma.notifications.deleteMany({
      where: { userId },
    });

    // 🔥 Invalidate cache
    await this.invalidateUserCache(userId);

    this.logger.log(`Deleted ${result.count} notifications for user ${userId}`);
    return { count: result.count };
  }

  /**
   * Get unread count for a user - ✅ Cached for 30 seconds
   */
  async getUnreadCount(userId: string): Promise<number> {
    return this.cacheManager.wrap(
      CacheKeys.notificationsUnreadCount(userId),
      CACHE_TTL.SHORT,
      async () => {
        return this.prisma.notifications.count({
          where: { userId, isRead: false },
        });
      },
      { tags: [CACHE_TAGS.NOTIFICATION] },
    );
  }

  /**
   * Cleanup old notifications and enforce limit
   */
  private async cleanupOldNotifications(userId: string): Promise<void> {
    // Delete notifications older than retention period
    const retentionDate = new Date();
    retentionDate.setDate(
      retentionDate.getDate() - this.NOTIFICATION_RETENTION_DAYS,
    );

    await this.prisma.notifications.deleteMany({
      where: {
        userId,
        createdAt: { lt: retentionDate },
      },
    });

    // Enforce max notifications per user
    const count = await this.prisma.notifications.count({ where: { userId } });

    if (count > this.MAX_NOTIFICATIONS_PER_USER) {
      // Get IDs of notifications to delete (oldest ones)
      const toDelete = await this.prisma.notifications.findMany({
        where: { userId },
        orderBy: { createdAt: 'asc' },
        take: count - this.MAX_NOTIFICATIONS_PER_USER,
        select: { id: true },
      });

      await this.prisma.notifications.deleteMany({
        where: {
          id: { in: toDelete.map((n) => n.id) },
        },
      });

      this.logger.log(
        `Cleaned up ${toDelete.length} old notifications for user ${userId}`,
      );
    }
  }

  /**
   * Convert DB model to response DTO
   */
  private toResponseDto(notification: any): NotificationResponseDto {
    return {
      id: notification.id,
      type: notification.type,
      title: notification.title,
      message: notification.message,
      data: notification.data,
      eventId: notification.eventId,
      isRead: notification.isRead,
      createdAt: notification.createdAt,
    };
  }
}
