import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { EventsService } from './events-facade.service';
import { EventsCommandsService } from './services/events-commands.service';
import { EventsQueriesService } from './services/events-queries.service';
import { EventsRegistrationService } from './services/events-registration.service';
import { EventsController } from './events.controller';
import { RegistrationsController } from './registrations.controller';
import { RegistrationsService } from './registrations.service';
import { EventsGateway } from './events.gateway';
import { CategoriesService } from './categories.service';
import { CategoriesController } from './categories.controller';
import { PrismaModule } from '../../core/database/prisma/prisma.module';
import { RedisModule } from '../../core/cache/redis.module';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { EmailModule } from '../../integrations/email/email.module';
import { GoogleCalendarModule } from '../../integrations/google-calendar/google-calendar.module';
import { EventValidationMiddleware } from './middleware/event-validation.middleware';

@Module({
  imports: [
    PrismaModule,
    RedisModule,
    EmailModule,
    GoogleCalendarModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET'),
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [
    EventsController,
    CategoriesController,
    RegistrationsController,
  ],
  providers: [
    // Split services (CQRS-style)
    EventsCommandsService,
    EventsQueriesService,
    EventsRegistrationService,
    // Facade (main entry point)
    EventsService,
    // Other services
    EventsGateway,
    CategoriesService,
    RegistrationsService,
  ],
  exports: [
    EventsService,
    EventsGateway,
    CategoriesService,
    RegistrationsService,
  ],
})
export class EventsModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(EventValidationMiddleware)
      .forRoutes(
        EventsController,
        CategoriesController,
        RegistrationsController,
      );
  }
}
