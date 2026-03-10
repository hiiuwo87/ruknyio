import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma/prisma.service';
import { TelegramService } from './telegram.service';
import { nanoid } from 'nanoid';

@Injectable()
export class TelegramSessionService {
  private readonly logger = new Logger(TelegramSessionService.name);
  private readonly SESSION_EXPIRY_MINUTES = 5;

  constructor(
    private prisma: PrismaService,
    private telegramService: TelegramService,
  ) {}

  /**
   * 🎫 إنشاء جلسة تحقق جديدة
   */
  async createVerificationSession(userId: string): Promise<{
    sessionId: string;
    botLink: string;
    expiresAt: Date;
  }> {
    // حذف الجلسات القديمة المنتهية الصلاحية
    await this.prisma.telegramSession.deleteMany({
      where: {
        userId,
        expiresAt: { lt: new Date() },
      },
    });

    // إنشاء جلسة جديدة أو تحديث القديمة
    const sessionId = `sess_${nanoid(24)}`;
    const expiresAt = new Date(
      Date.now() + this.SESSION_EXPIRY_MINUTES * 60000,
    );

    const session = await this.prisma.telegramSession.upsert({
      where: { userId },
      create: {
        sessionId,
        userId,
        expiresAt,
      },
      update: {
        sessionId,
        expiresAt,
      },
    });

    const botLink = `https://t.me/RuknyBot?start=${sessionId}`;

    this.logger.log(`Created/Updated verification session for user ${userId}`);

    return {
      sessionId,
      botLink,
      expiresAt,
    };
  }

  /**
   * 🔍 البحث عن جلسة وتحقق من صلاحيتها
   */
  async getValidSession(sessionId: string) {
    const session = await this.prisma.telegramSession.findUnique({
      where: { sessionId },
      include: { user: true },
    });

    if (!session) {
      throw new NotFoundException('جلسة التحقق غير موجودة');
    }

    if (session.expiresAt < new Date()) {
      await this.prisma.telegramSession.delete({ where: { id: session.id } });
      throw new NotFoundException('انتهت صلاحية جلسة التحقق');
    }

    if (session.verifiedAt) {
      throw new NotFoundException('تم استخدام هذه الجلسة بالفعل');
    }

    return session;
  }

  /**
   * ✅ تأكيد الجلسة (عند استقبال Webhook من الـ Bot)
   */
  async verifySession(
    sessionId: string,
    chatId: number,
    firstName?: string,
    lastName?: string,
    username?: string,
  ) {
    const session = await this.getValidSession(sessionId);

    // تحديث الجلسة
    const updatedSession = await this.prisma.telegramSession.update({
      where: { id: session.id },
      data: {
        verifiedAt: new Date(),
        verifiedChatId: chatId.toString(),
      },
    });

    // تحديث بيانات المستخدم
    const user = await this.prisma.user.update({
      where: { id: session.userId },
      data: {
        telegramChatId: chatId.toString(),
        telegramFirstName: firstName,
        telegramLastName: lastName,
        telegramUsername: username,
        telegramConnectedAt: new Date(),
        telegramEnabled: true,
      },
      select: {
        id: true,
        email: true,
        telegramChatId: true,
        telegramFirstName: true,
        telegramLastName: true,
        telegramUsername: true,
        telegramConnectedAt: true,
        telegramEnabled: true,
      },
    });

    this.logger.log(
      `Verified Telegram session for user ${session.userId}: Chat ID ${chatId}`,
    );

    return { user, session: updatedSession };
  }

  /**
   * 🚫 إلغاء جلسة
   */
  async cancelSession(sessionId: string) {
    const session = await this.getValidSession(sessionId);

    await this.prisma.telegramSession.delete({
      where: { id: session.id },
    });

    this.logger.log(`Cancelled verification session: ${sessionId}`);
  }

  /**
   * 🔌 فصل Telegram عن حساب المستخدم
   */
  async disconnectTelegram(userId: string) {
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        telegramChatId: null,
        telegramEnabled: false,
      },
      select: { id: true, telegramChatId: true, telegramEnabled: true },
    });

    // حذف الجلسات المتعلقة
    await this.prisma.telegramSession.deleteMany({
      where: { userId },
    });

    this.logger.log(`Disconnected Telegram for user ${userId}`);
  }

  /**
   * 🛠️ الحصول على حالة الربط للمستخدم
   */
  async getConnectionStatus(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        telegramChatId: true,
        telegramEnabled: true,
        telegramConnectedAt: true,
        telegramUsername: true,
        telegramFirstName: true,
      },
    });

    return {
      connected: !!user.telegramChatId,
      enabled: user.telegramEnabled,
      chatId: user.telegramChatId,
      username: user.telegramUsername,
      firstName: user.telegramFirstName,
      connectedAt: user.telegramConnectedAt,
    };
  }
}
