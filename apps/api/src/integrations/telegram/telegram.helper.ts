/**
 * Helper functions للتكامل مع Telegram من الـ Services الأخرى
 */

import { TelegramService } from './telegram.service';
import { TelegramMessageTemplates } from './telegram.templates';
import { PrismaService } from '../../core/database/prisma/prisma.service';

export class TelegramIntegrationHelper {
  constructor(
    private telegramService: TelegramService,
    private prisma: PrismaService,
  ) {}

  /**
   * 🔐 إرسال تنبيه تسجيل دخول جديد
   */
  async sendLoginNotification(
    userId: string,
    deviceInfo: {
      device?: string;
      browser?: string;
      os?: string;
    },
    securityInfo: {
      location?: string;
      ip?: string;
      country?: string;
    },
  ) {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: {
          telegramChatId: true,
          telegramEnabled: true,
          email: true,
        },
      });

      if (!user?.telegramChatId || !user.telegramEnabled) {
        return;
      }

      const device =
        deviceInfo.device || `${deviceInfo.browser} on ${deviceInfo.os}`;
      const location = securityInfo.location || 'Unknown';
      const time = new Date().toLocaleString('ar-SA');

      const message = TelegramMessageTemplates.getLoginNotification({
        device,
        location,
        ip: securityInfo.ip,
        time,
      });

      await this.telegramService.sendMessage({
        chat_id: user.telegramChatId,
        text: message,
        parse_mode: 'HTML',
      });
    } catch (error) {
      console.error('Error sending login notification', error);
      // لا نرمي خطأ - هذا ليس العملية الرئيسية
    }
  }

  /**
   * ⚠️ إرسال تنبيه محاولات دخول فاشلة
   */
  async sendFailedLoginAlert(
    userId: string,
    failureInfo: {
      attempts: number;
      location?: string;
      ip?: string;
      reason?: string;
    },
  ) {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: {
          telegramChatId: true,
          telegramEnabled: true,
        },
      });

      if (!user?.telegramChatId || !user.telegramEnabled) {
        return;
      }

      const message = TelegramMessageTemplates.getFailedLoginNotification({
        attempts: failureInfo.attempts,
        location: failureInfo.location,
        ip: failureInfo.ip,
        reason: failureInfo.reason,
      });

      await this.telegramService.sendMessage({
        chat_id: user.telegramChatId,
        text: message,
        parse_mode: 'HTML',
      });
    } catch (error) {
      console.error('Error sending failed login alert', error);
    }
  }

  /**
   * 🔑 إرسال تنبيه تغيير كلمة المرور
   */
  async sendPasswordChangeNotification(
    userId: string,
    deviceInfo?: {
      device?: string;
    },
  ) {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: {
          telegramChatId: true,
          telegramEnabled: true,
        },
      });

      if (!user?.telegramChatId || !user.telegramEnabled) {
        return;
      }

      const time = new Date().toLocaleString('ar-SA');
      const message = TelegramMessageTemplates.getPasswordChangeNotification({
        time,
        device: deviceInfo?.device,
      });

      await this.telegramService.sendMessage({
        chat_id: user.telegramChatId,
        text: message,
        parse_mode: 'HTML',
      });
    } catch (error) {
      console.error('Error sending password change notification', error);
    }
  }

  /**
   * 🔐 إرسال تنبيه تفعيل التحقق الثنائي
   */
  async sendTwoFactorEnabledNotification(userId: string) {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: {
          telegramChatId: true,
          telegramEnabled: true,
        },
      });

      if (!user?.telegramChatId || !user.telegramEnabled) {
        return;
      }

      const message =
        TelegramMessageTemplates.getTwoFactorEnabledNotification();

      await this.telegramService.sendMessage({
        chat_id: user.telegramChatId,
        text: message,
        parse_mode: 'HTML',
      });
    } catch (error) {
      console.error('Error sending 2FA notification', error);
    }
  }

  /**
   * 📊 إرسال ملخص النشاط اليومي
   */
  async sendDailySummary(
    userId: string,
    stats: {
      totalLogins?: number;
      newDevices?: number;
      failedAttempts?: number;
      location?: string;
    },
  ) {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: {
          telegramChatId: true,
          telegramEnabled: true,
        },
      });

      if (!user?.telegramChatId || !user.telegramEnabled) {
        return;
      }

      const message = TelegramMessageTemplates.getDailySummary(stats);

      await this.telegramService.sendMessage({
        chat_id: user.telegramChatId,
        text: message,
        parse_mode: 'HTML',
      });
    } catch (error) {
      console.error('Error sending daily summary', error);
    }
  }

  /**
   * 🔓 إرسال تنبيه عام
   */
  async sendCustomNotification(userId: string, title: string, message: string) {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: {
          telegramChatId: true,
          telegramEnabled: true,
        },
      });

      if (!user?.telegramChatId || !user.telegramEnabled) {
        return;
      }

      const fullMessage = `
<b>${title}</b>

${message}
      `.trim();

      await this.telegramService.sendMessage({
        chat_id: user.telegramChatId,
        text: fullMessage,
        parse_mode: 'HTML',
      });
    } catch (error) {
      console.error('Error sending custom notification', error);
    }
  }

  /**
   * ✅ التحقق من أن المستخدم متصل مع Telegram
   */
  async isUserConnected(userId: string): Promise<boolean> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: {
          telegramChatId: true,
          telegramEnabled: true,
        },
      });

      return !!(user?.telegramChatId && user.telegramEnabled);
    } catch (error) {
      return false;
    }
  }

  /**
   * 🎨 إرسال رسالة مع أزرار
   */
  async sendMessageWithButtons(
    userId: string,
    text: string,
    buttons: Array<Array<{ text: string; callback_data: string }>>,
  ) {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: {
          telegramChatId: true,
          telegramEnabled: true,
        },
      });

      if (!user?.telegramChatId || !user.telegramEnabled) {
        return;
      }

      await this.telegramService.sendMessageWithButtons(
        user.telegramChatId,
        text,
        buttons,
      );
    } catch (error) {
      console.error('Error sending message with buttons', error);
    }
  }
}
