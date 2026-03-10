import { Module, forwardRef } from '@nestjs/common';
import { UserController } from './user.controller';
import { UserService } from './user.service';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { PrismaModule } from '../../core/database/prisma/prisma.module';
import { SecurityModule } from '../../infrastructure/security/security.module';
import { EmailModule } from '../../integrations/email/email.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    PrismaModule, 
    SecurityModule, 
    EmailModule, 
    NotificationsModule,
    forwardRef(() => AuthModule), // لاستخدام IpVerificationService
  ],
  controllers: [UserController, DashboardController],
  providers: [UserService, DashboardService],
  exports: [UserService, DashboardService],
})
export class UserModule {}
