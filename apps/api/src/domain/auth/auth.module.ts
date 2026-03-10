import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { QuickSignController } from './quicksign.controller';
import { QuickSignService } from './quicksign.service';
import { IpVerificationService } from './ip-verification.service';
import { WebSocketTokenService } from './websocket-token.service';
import { TokenService } from './token.service';
import { TwoFactorService } from './two-factor.service';
import { TwoFactorController } from './two-factor.controller';
import { PendingTwoFactorService } from './pending-two-factor.service';
import { AccountLockoutService } from './account-lockout.service';
import { AccountLockoutController } from './account-lockout.controller';
import { JwtStrategy } from './strategies/jwt.strategy';
import { GoogleStrategy } from './strategies/google.strategy';
import { LinkedInStrategy } from './strategies/linkedin.strategy';
import { PrismaModule } from '../../core/database/prisma/prisma.module';
import { SecurityModule } from '../../infrastructure/security/security.module';
import { EmailModule } from '../../integrations/email/email.module';
import { OAuthCodeService } from './oauth-code.service';
import { RedisOAuthCodeService } from './redis-oauth-code.service';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    PrismaModule,
    SecurityModule,
    EmailModule,
    NotificationsModule,
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        // Do not allow fallback secrets in production
        secret: configService.get<string>('JWT_SECRET') ?? undefined,
        signOptions: {
          expiresIn: '30m', // 🔒 Access Token - موحد مع token.service.ts و auth.service.ts
        },
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [
    AuthController,
    QuickSignController,
    TwoFactorController,
    AccountLockoutController,
  ],
  providers: [
    AuthService,
    QuickSignService,
    IpVerificationService,
    WebSocketTokenService,
    TokenService,
    TwoFactorService,
    PendingTwoFactorService,
    AccountLockoutService,
    JwtStrategy,
    GoogleStrategy,
    LinkedInStrategy,
    OAuthCodeService, // Keep for backward compatibility
    RedisOAuthCodeService, // Production-ready Redis implementation
  ],
  exports: [
    AuthService,
    QuickSignService,
    IpVerificationService,
    WebSocketTokenService,
    TokenService,
    TwoFactorService,
    PendingTwoFactorService,
    AccountLockoutService,
  ],
})
export class AuthModule {}
