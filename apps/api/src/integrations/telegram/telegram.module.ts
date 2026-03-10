import { Module, OnModuleInit } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TelegramService } from './telegram.service';
import { TelegramSessionService } from './telegram-session.service';
import { TelegramController } from './telegram.controller';
import { TelegramWebhookController } from './telegram-webhook.controller';
import { PrismaService } from '../../core/database/prisma/prisma.service';

@Module({
  imports: [ConfigModule],
  providers: [TelegramService, TelegramSessionService, PrismaService],
  controllers: [TelegramController, TelegramWebhookController],
  exports: [TelegramService],
})
export class TelegramModule implements OnModuleInit {
  constructor(private telegramService: TelegramService) {}

  /**
   * 🚀 تعيين الـ Webhook عند بدء التطبيق
   * ⚠️ تعطيل مؤقت للتطوير المحلي - استخدم ngrok أو Webhook حقيقي في Production
   */
  async onModuleInit() {
    try {
      // تعطيل الـ webhook في التطوير المحلي
      // if (process.env.TELEGRAM_ENABLED === 'true') {
      //   await this.telegramService.setWebhook();
      // }
      console.log('ℹ️ Telegram webhook disabled for local development');
    } catch (error) {
      console.error('Failed to set Telegram webhook', error);
    }
  }
}
