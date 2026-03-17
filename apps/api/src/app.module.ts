import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { APP_GUARD, APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { HttpExceptionFilter } from './core/common/filters/http-exception.filter';
import { ThrottlerUserGuard } from './core/common/guards/throttler-user.guard';
import { PerformanceInterceptor } from './core/common/interceptors/performance.interceptor';

// Core
import { HealthModule } from './core/health/health.module';
import { PrismaModule } from './core/database/prisma/prisma.module';
import { RedisModule } from './core/cache/redis.module';

// Domain - Authentication & Users
import { AuthModule } from './domain/auth/auth.module';
import { UserModule } from './domain/users/user.module';
import { ProfilesModule } from './domain/profiles/profiles.module';

// Domain - Events & Forms
import { EventsModule } from './domain/events/events.module';
import { FormsModule } from './domain/forms/forms.module';

// Domain - Notifications
import { NotificationsModule } from './domain/notifications/notifications.module';

// Domain - Social Features
import { SocialModule } from './domain/social/social.module';

// Domain - Links Management
import { LinksModule } from './domain/links/links.module';

// Domain - Todos (Task Management) - DISABLED
// import { TodosModule } from './domain/todos/todos.module';

// Domain - Admin
import { AdminModule } from './domain/admin/admin.module';

// Domain - Stores & Products
import { StoresModule } from './domain/stores/stores.module';

// Domain - Storage (S3)
import { StorageModule } from './domain/storage/storage.module';

// Domain - Utils
import { UtilsModule } from './domain/utils/utils.module';

// Integrations
import { GoogleCalendarModule } from './integrations/google-calendar/google-calendar.module';
import { GoogleSheetsModule } from './integrations/google-sheets/google-sheets.module';
import { GoogleDriveModule } from './integrations/google-drive/google-drive.module';
import { TelegramModule } from './integrations/telegram/telegram.module';
import { WhatsappModule } from './integrations/whatsapp';
import { InstagramModule } from './integrations/instagram/instagram.module';
// import { PushNotificationsModule } from './integrations/push-notifications/push-notifications.module'; // Disabled - needs configuration
import { DevModule } from './dev/dev.module';

// Infrastructure
// Use the UploadModule under `modules` which provides presign/confirm endpoints
import { UploadModule } from './modules/upload/upload.module';
import { SecurityModule } from './infrastructure/security/security.module';

// Shared
import { SharedModule } from './shared/modules/shared.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot([
      {
        ttl: 60000, // Time window: 60 seconds
        limit: process.env.NODE_ENV === 'production' ? 30 : 100, // More lenient in development
      },
    ]),
    // Core
    PrismaModule,
    RedisModule,
    HealthModule,

    // Shared (Global S3Service)
    SharedModule,

    // Infrastructure
    SecurityModule,
    UploadModule,

    // Domain - Auth & Users
    AuthModule,
    UserModule,
    ProfilesModule,

    // Domain - Events & Forms
    EventsModule,
    FormsModule,

    // Domain - Notifications
    NotificationsModule,

    // Domain - Social
    SocialModule,

    // Domain - Links
    LinksModule,

    // Domain - Todos (Task Management) - DISABLED
    // TodosModule,

    // Domain - Stores & Products
    StoresModule,

    // Domain - Admin
    AdminModule,

    // Domain - Storage (S3)
    StorageModule,

    // Domain - Utils
    UtilsModule,

    // Integrations
    GoogleCalendarModule,
    GoogleSheetsModule,
    GoogleDriveModule,
    TelegramModule,
    WhatsappModule, // 📱 WhatsApp Checkout System
    InstagramModule,
    // PushNotificationsModule, // 🔔 Web Push Notifications - Disabled (needs configuration)
    ...(process.env.NODE_ENV !== 'production' ? [DevModule] : []),
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      // 🔒 استخدام ThrottlerUserGuard للـ rate limiting بناءً على user ID
      useClass:
        process.env.NODE_ENV === 'production'
          ? ThrottlerUserGuard
          : ThrottlerGuard,
    },
    {
      provide: APP_FILTER,
      useClass: HttpExceptionFilter,
    },
    {
      provide: APP_INTERCEPTOR,
      // ⚡ Performance monitoring for all endpoints
      useClass: PerformanceInterceptor,
    },
  ],
})
export class AppModule {}
