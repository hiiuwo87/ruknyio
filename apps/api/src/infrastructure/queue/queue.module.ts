import { Module, Global } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { ConfigService } from '@nestjs/config';
import { QueueService } from './queue.service';
import { EmailProcessor } from './processors/email.processor';
import { ImageProcessor } from './processors/image.processor';
import { NotificationProcessor } from './processors/notification.processor';
import { CleanupProcessor } from './processors/cleanup.processor';

/**
 * 📋 Queue Module
 *
 * نظام طوابير للمهام الثقيلة باستخدام Bull/Redis:
 * - Email sending
 * - Image processing
 * - Notifications
 * - Scheduled cleanup
 */
@Global()
@Module({
  imports: [
    // Email Queue
    BullModule.registerQueueAsync({
      name: 'email',
      useFactory: (config: ConfigService) => ({
        redis: {
          host: config.get('REDIS_HOST', 'localhost'),
          port: config.get('REDIS_PORT', 6379),
          password: config.get('REDIS_PASSWORD'),
        },
        defaultJobOptions: {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 2000,
          },
          removeOnComplete: 100,
          removeOnFail: 500,
        },
      }),
      inject: [ConfigService],
    }),

    // Image Processing Queue
    BullModule.registerQueueAsync({
      name: 'image',
      useFactory: (config: ConfigService) => ({
        redis: {
          host: config.get('REDIS_HOST', 'localhost'),
          port: config.get('REDIS_PORT', 6379),
          password: config.get('REDIS_PASSWORD'),
        },
        defaultJobOptions: {
          attempts: 2,
          backoff: {
            type: 'fixed',
            delay: 5000,
          },
          removeOnComplete: 50,
          removeOnFail: 100,
        },
      }),
      inject: [ConfigService],
    }),

    // Notification Queue
    BullModule.registerQueueAsync({
      name: 'notification',
      useFactory: (config: ConfigService) => ({
        redis: {
          host: config.get('REDIS_HOST', 'localhost'),
          port: config.get('REDIS_PORT', 6379),
          password: config.get('REDIS_PASSWORD'),
        },
        defaultJobOptions: {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 1000,
          },
          removeOnComplete: 200,
          removeOnFail: 500,
        },
      }),
      inject: [ConfigService],
    }),

    // Cleanup Queue
    BullModule.registerQueueAsync({
      name: 'cleanup',
      useFactory: (config: ConfigService) => ({
        redis: {
          host: config.get('REDIS_HOST', 'localhost'),
          port: config.get('REDIS_PORT', 6379),
          password: config.get('REDIS_PASSWORD'),
        },
        defaultJobOptions: {
          attempts: 1,
          removeOnComplete: 10,
          removeOnFail: 50,
        },
      }),
      inject: [ConfigService],
    }),
  ],
  providers: [
    QueueService,
    EmailProcessor,
    ImageProcessor,
    NotificationProcessor,
    CleanupProcessor,
  ],
  exports: [QueueService, BullModule],
})
export class QueueModule {}
