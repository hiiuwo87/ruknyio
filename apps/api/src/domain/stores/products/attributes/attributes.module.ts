import { Module } from '@nestjs/common';
import { AttributesRepository } from './attributes.repository';
import { PrismaModule } from '../../../../core/database/prisma/prisma.module';

/**
 * Attributes Module
 *
 * Provides repository pattern for product attributes.
 * Controller and Service are handled in the parent stores module.
 */
@Module({
  imports: [PrismaModule],
  providers: [AttributesRepository],
  exports: [AttributesRepository],
})
export class AttributesModule {}
