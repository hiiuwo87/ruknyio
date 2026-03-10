import { Module, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { WhatsappService } from './whatsapp.service';

/**
 * 📱 WhatsApp Module
 *
 * وحدة واتساب للتكامل مع WhatsApp Personal API
 * تُستخدم لإرسال OTP وإشعارات الطلبات
 */
@Global()
@Module({
  imports: [ConfigModule],
  providers: [WhatsappService],
  exports: [WhatsappService],
})
export class WhatsappModule {}
