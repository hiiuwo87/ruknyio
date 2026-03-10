import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue, Job } from 'bull';

/**
 * 📋 Queue Service
 *
 * خدمة موحدة لإدارة طوابير المهام
 */
@Injectable()
export class QueueService {
  private readonly logger = new Logger(QueueService.name);

  constructor(
    @InjectQueue('email') private readonly emailQueue: Queue,
    @InjectQueue('image') private readonly imageQueue: Queue,
    @InjectQueue('notification') private readonly notificationQueue: Queue,
    @InjectQueue('cleanup') private readonly cleanupQueue: Queue,
  ) {}

  // ==================== Email Jobs ====================

  /**
   * إضافة مهمة إرسال بريد
   */
  async addEmailJob(
    type: string,
    data: {
      to: string;
      subject?: string;
      template?: string;
      context?: Record<string, any>;
    },
    options?: {
      delay?: number;
      priority?: number;
    },
  ): Promise<Job> {
    return this.emailQueue.add(
      type,
      data,
      {
        delay: options?.delay,
        priority: options?.priority,
      },
    );
  }

  /**
   * إرسال بريد ترحيب
   */
  async sendWelcomeEmail(to: string, name: string): Promise<Job> {
    return this.addEmailJob('welcome', {
      to,
      template: 'welcome',
      context: { name },
    });
  }

  /**
   * إرسال بريد تأكيد
   */
  async sendVerificationEmail(
    to: string,
    code: string,
    name: string,
  ): Promise<Job> {
    return this.addEmailJob('verification', {
      to,
      template: 'verification',
      context: { code, name },
    });
  }

  /**
   * إرسال بريد تنبيه أمني
   */
  async sendSecurityAlert(
    to: string,
    alertType: string,
    details: Record<string, any>,
  ): Promise<Job> {
    return this.addEmailJob(
      'security-alert',
      {
        to,
        template: 'security-alert',
        context: { alertType, ...details },
      },
      { priority: 1 }, // أولوية عالية
    );
  }

  // ==================== Image Jobs ====================

  /**
   * إضافة مهمة معالجة صورة
   */
  async addImageJob(
    type: string,
    data: {
      key: string;
      bucket: string;
      userId?: string;
      options?: Record<string, any>;
    },
  ): Promise<Job> {
    return this.imageQueue.add(type, data);
  }

  /**
   * تحسين صورة
   */
  async optimizeImage(
    key: string,
    bucket: string,
    userId: string,
  ): Promise<Job> {
    return this.addImageJob('optimize', { key, bucket, userId });
  }

  /**
   * إنشاء صور مصغرة
   */
  async generateThumbnails(
    key: string,
    bucket: string,
    sizes: number[],
  ): Promise<Job> {
    return this.addImageJob('thumbnails', {
      key,
      bucket,
      options: { sizes },
    });
  }

  // ==================== Notification Jobs ====================

  /**
   * إضافة مهمة إشعار
   */
  async addNotificationJob(
    type: string,
    data: {
      userId: string;
      title: string;
      body: string;
      data?: Record<string, any>;
      channels?: ('push' | 'email' | 'sms' | 'in-app')[];
    },
  ): Promise<Job> {
    return this.notificationQueue.add(type, {
      ...data,
      channels: data.channels || ['in-app'],
    });
  }

  /**
   * إرسال إشعار حدث
   */
  async notifyEventReminder(
    userId: string,
    eventId: string,
    eventTitle: string,
    startDate: Date,
  ): Promise<Job> {
    return this.addNotificationJob('event-reminder', {
      userId,
      title: 'تذكير بالحدث',
      body: `${eventTitle} سيبدأ قريباً`,
      data: { eventId, startDate: startDate.toISOString() },
      channels: ['push', 'email', 'in-app'],
    });
  }

  /**
   * إرسال إشعار طلب جديد
   */
  async notifyNewOrder(
    userId: string,
    orderId: string,
    amount: number,
  ): Promise<Job> {
    return this.addNotificationJob('new-order', {
      userId,
      title: 'طلب جديد 🎉',
      body: `لديك طلب جديد بقيمة ${amount} د.ع`,
      data: { orderId, amount },
      channels: ['push', 'email', 'in-app'],
    });
  }

  // ==================== Cleanup Jobs ====================

  /**
   * إضافة مهمة تنظيف
   */
  async addCleanupJob(
    type: string,
    data?: Record<string, any>,
    options?: {
      delay?: number;
      repeat?: { cron: string };
    },
  ): Promise<Job> {
    return this.cleanupQueue.add(type, data || {}, {
      delay: options?.delay,
      repeat: options?.repeat,
    });
  }

  /**
   * تنظيف الجلسات المنتهية
   */
  async scheduleSessionCleanup(): Promise<Job> {
    return this.addCleanupJob(
      'expired-sessions',
      {},
      { repeat: { cron: '0 2 * * *' } }, // كل يوم الساعة 2 صباحاً
    );
  }

  /**
   * تنظيف الملفات المؤقتة
   */
  async scheduleTempFilesCleanup(): Promise<Job> {
    return this.addCleanupJob(
      'temp-files',
      {},
      { repeat: { cron: '0 3 * * *' } }, // كل يوم الساعة 3 صباحاً
    );
  }

  // ==================== Queue Management ====================

  /**
   * الحصول على حالة الطوابير
   */
  async getQueuesStatus(): Promise<{
    email: any;
    image: any;
    notification: any;
    cleanup: any;
  }> {
    const [emailStats, imageStats, notificationStats, cleanupStats] =
      await Promise.all([
        this.getQueueStats(this.emailQueue),
        this.getQueueStats(this.imageQueue),
        this.getQueueStats(this.notificationQueue),
        this.getQueueStats(this.cleanupQueue),
      ]);

    return {
      email: emailStats,
      image: imageStats,
      notification: notificationStats,
      cleanup: cleanupStats,
    };
  }

  private async getQueueStats(queue: Queue): Promise<{
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
  }> {
    const [waiting, active, completed, failed, delayed] = await Promise.all([
      queue.getWaitingCount(),
      queue.getActiveCount(),
      queue.getCompletedCount(),
      queue.getFailedCount(),
      queue.getDelayedCount(),
    ]);

    return { waiting, active, completed, failed, delayed };
  }

  /**
   * تنظيف المهام المكتملة/الفاشلة
   */
  async cleanQueues(olderThan: number = 86400000): Promise<void> {
    await Promise.all([
      this.emailQueue.clean(olderThan, 'completed'),
      this.emailQueue.clean(olderThan, 'failed'),
      this.imageQueue.clean(olderThan, 'completed'),
      this.imageQueue.clean(olderThan, 'failed'),
      this.notificationQueue.clean(olderThan, 'completed'),
      this.notificationQueue.clean(olderThan, 'failed'),
      this.cleanupQueue.clean(olderThan, 'completed'),
      this.cleanupQueue.clean(olderThan, 'failed'),
    ]);

    this.logger.log('Queues cleaned successfully');
  }

  /**
   * إيقاف جميع الطوابير
   */
  async pauseAll(): Promise<void> {
    await Promise.all([
      this.emailQueue.pause(),
      this.imageQueue.pause(),
      this.notificationQueue.pause(),
      this.cleanupQueue.pause(),
    ]);
    this.logger.warn('All queues paused');
  }

  /**
   * استئناف جميع الطوابير
   */
  async resumeAll(): Promise<void> {
    await Promise.all([
      this.emailQueue.resume(),
      this.imageQueue.resume(),
      this.notificationQueue.resume(),
      this.cleanupQueue.resume(),
    ]);
    this.logger.log('All queues resumed');
  }
}
