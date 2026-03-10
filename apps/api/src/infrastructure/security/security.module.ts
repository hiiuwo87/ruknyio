import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { SecurityLogService } from './log.service';
import { SecurityDetectorService } from './detector.service';
import { SecurityGateway } from './security.gateway';
import { PrismaModule } from '../../core/database/prisma/prisma.module';
import { EmailModule } from '../../integrations/email/email.module';

@Module({
  imports: [
    PrismaModule,
    EmailModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET'),
      }),
      inject: [ConfigService],
    }),
  ],
  providers: [SecurityLogService, SecurityDetectorService, SecurityGateway],
  exports: [SecurityLogService, SecurityDetectorService, SecurityGateway],
})
export class SecurityModule {}
