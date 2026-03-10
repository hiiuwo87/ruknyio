import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

/**
 * 🛡️ Checkout Session Guard
 *
 * يتحقق من صلاحية جلسة الشراء للمستخدمين الضيوف
 * يستخدم JWT token مع نوع 'checkout_session'
 */
@Injectable()
export class CheckoutSessionGuard implements CanActivate {
  constructor(
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const token = this.extractTokenFromHeader(request);

    if (!token) {
      throw new UnauthorizedException('جلسة الشراء غير صالحة');
    }

    try {
      const payload = await this.jwtService.verifyAsync(token, {
        secret: this.configService.get<string>('JWT_SECRET'),
      });

      // التحقق من نوع التوكن
      if (payload.type !== 'checkout_session' && payload.type !== 'checkout') {
        throw new UnauthorizedException('جلسة الشراء غير صالحة');
      }

      // إضافة بيانات الجلسة للطلب
      request.checkoutSession = {
        phoneNumber: payload.phoneNumber || payload.phone,
        email: payload.email,
        storeId: payload.storeId,
        sessionId: payload.sessionId,
        userId: payload.sub,
      };

      return true;
    } catch (error) {
      throw new UnauthorizedException('انتهت صلاحية جلسة الشراء');
    }
  }

  private extractTokenFromHeader(request: any): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }
}
