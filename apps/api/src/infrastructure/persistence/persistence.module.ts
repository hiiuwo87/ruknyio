import { Module } from '@nestjs/common';
import { PrismaModule } from '../../core/database/prisma/prisma.module';
import { EVENTS_REPOSITORY, PrismaEventsRepository } from './repositories';

/**
 * 🔌 Persistence Module
 *
 * Provides repository implementations for data access.
 * Services can inject repositories via interfaces for better testability.
 *
 * Usage:
 * ```typescript
 * constructor(@Inject(EVENTS_REPOSITORY) private eventsRepo: IEventsRepository) {}
 * ```
 */
@Module({
  imports: [PrismaModule],
  providers: [
    {
      provide: EVENTS_REPOSITORY,
      useClass: PrismaEventsRepository,
    },
    // Add more repositories here as needed:
    // { provide: STORES_REPOSITORY, useClass: PrismaStoresRepository },
    // { provide: PROFILES_REPOSITORY, useClass: PrismaProfilesRepository },
  ],
  exports: [EVENTS_REPOSITORY],
})
export class PersistenceModule {}
