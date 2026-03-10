import {
  Controller,
  Post,
  Get,
  Delete,
  UseGuards,
  Req,
  Logger,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../core/common/guards/auth/jwt-auth.guard';
import { TelegramService } from './telegram.service';
import { TelegramSessionService } from './telegram-session.service';
import { PrismaService } from '../../core/database/prisma/prisma.service';

interface RequestWithUser extends Request {
  user: { id: string; email: string };
}

@ApiTags('telegram')
@Controller('telegram')
export class TelegramController {
  private readonly logger = new Logger(TelegramController.name);

  constructor(
    private telegramService: TelegramService,
    private telegramSessionService: TelegramSessionService,
    private prisma: PrismaService,
  ) {}

  /**
   * 🎫 إنشاء جلسة تحقق جديدة
   * POST /api/telegram/generate-session
   */
  @Post('generate-session')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'إنشاء جلسة تحقق جديدة' })
  async generateSession(@Req() req: RequestWithUser) {
    const { sessionId, botLink, expiresAt } =
      await this.telegramSessionService.createVerificationSession(req.user.id);

    return {
      success: true,
      data: {
        sessionId,
        botLink,
        expiresAt,
        qrCode: null,
      },
    };
  }

  /**
   * ✅ الحصول على حالة الربط
   * GET /api/telegram/status
   */
  @Get('status')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'الحصول على حالة الربط' })
  async getStatus(@Req() req: RequestWithUser) {
    const status = await this.telegramSessionService.getConnectionStatus(
      req.user.id,
    );

    return {
      success: true,
      data: status,
    };
  }

  /**
   * � التحقق من جلسة التحقق (للتطوير المحلي)
   * POST /api/telegram/verify-session
   * بديل مؤقت بدلاً من Webhook للتطوير
   */
  @Post('verify-session')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'التحقق من جلسة التحقق' })
  async verifySession(@Req() req: RequestWithUser) {
    const user = await this.prisma.user.findUnique({
      where: { id: req.user.id },
    });

    if (!user) {
      throw new Error('User not found');
    }

    // في الواقع، سيتم هذا عبر الـ webhook من Telegram
    // لكن للتطوير المحلي، هذا بديل مؤقت

    return {
      success: true,
      message:
        'في بيئة الإنتاج، يتم التحقق عبر Telegram webhook. للتطوير المحلي، استخدم ngrok لتوصيل webhook حقيقي.',
      data: {
        connected: !!user.telegramChatId,
        telegramChatId: user.telegramChatId,
        telegramUsername: user.telegramUsername,
      },
    };
  }

  /**
   * �🔌 فصل Telegram
   * DELETE /api/telegram/disconnect
   */
  @Delete('disconnect')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'فصل حساب Telegram' })
  async disconnect(@Req() req: RequestWithUser) {
    await this.telegramSessionService.disconnectTelegram(req.user.id);

    return {
      success: true,
      message: 'تم فصل حساب Telegram بنجاح',
    };
  }

  /**
   * 🧪 اختبار الإرسال
   * POST /api/telegram/test
   */
  @Post('test')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'اختبار إرسال رسالة' })
  async test(@Req() req: RequestWithUser) {
    const user = await this.prisma.user.findUnique({
      where: { id: req.user.id },
    });

    if (!user.telegramChatId) {
      return {
        success: false,
        message: 'لم يتم ربط حساب Telegram',
      };
    }

    await this.telegramService.sendMessage({
      chat_id: user.telegramChatId,
      text: '<b>✅ اختبار الاتصال</b>\n\nإذا رأيت هذه الرسالة، فالاتصال يعمل بشكل صحيح!',
      parse_mode: 'HTML',
    });

    return {
      success: true,
      message: 'تم إرسال رسالة الاختبار',
    };
  }
}
