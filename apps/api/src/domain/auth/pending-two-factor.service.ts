import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma/prisma.service';
import { randomUUID } from 'crypto';

const isProduction = process.env.NODE_ENV === 'production';

/**
 * 🔐 خدمة إدارة جلسات 2FA المعلقة
 *
 * عندما يسجل مستخدم الدخول ولديه 2FA مفعل،
 * نحفظ بياناته في جلسة معلقة حتى يتحقق من الرمز
 */
@Injectable()
export class PendingTwoFactorService {
  // مدة صلاحية الجلسة المعلقة (15 دقيقة - وقت كافٍ للمستخدم لإدخال رمز 2FA)
  private readonly SESSION_EXPIRY_MINUTES = 15;

  constructor(private prisma: PrismaService) {}

  /**
   * إنشاء جلسة معلقة جديدة
   */
  async create(userId: string, email: string): Promise<string> {
    const id = randomUUID();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + this.SESSION_EXPIRY_MINUTES * 60 * 1000);

    await this.prisma.pendingTwoFactorSession.create({
      data: {
        id,
        userId,
        email,
        expiresAt,
      },
    });

    return id;
  }

  /**
   * استرجاع جلسة معلقة
   */
  async get(sessionId: string): Promise<{
    userId: string;
    email: string;
  } | null> {
    const session = await this.prisma.pendingTwoFactorSession.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      return null;
    }

    // 🔒 التحقق من انتهاء الصلاحية بدقة
    const now = new Date();
    const expiresAt = new Date(session.expiresAt);
    const timeUntilExpiry = expiresAt.getTime() - now.getTime();

    if (timeUntilExpiry <= 0) {
      // حذف الجلسة المنتهية
      await this.delete(sessionId);
      return null;
    }

    return {
      userId: session.userId,
      email: session.email,
    };
  }

  /**
   * حذف جلسة معلقة
   */
  async delete(sessionId: string): Promise<void> {
    await this.prisma.pendingTwoFactorSession
      .delete({
        where: { id: sessionId },
      })
      .catch(() => {
        /* ignore if not found */
      });
  }

  /**
   * تنظيف الجلسات المنتهية
   */
  async cleanupExpired(): Promise<number> {
    const result = await this.prisma.pendingTwoFactorSession.deleteMany({
      where: {
        expiresAt: {
          lt: new Date(),
        },
      },
    });

    return result.count;
  }
}
