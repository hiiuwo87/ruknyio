import { Module } from '@nestjs/common';
import { VariantsRepository } from './variants.repository';
import { PrismaModule } from '../../../../core/database/prisma/prisma.module';

/**
 * Variants Module
 *
 * Provides repository pattern for product variants.
 * Controller and Service are handled in the parent stores module.
 */
@Module({
  imports: [PrismaModule],
  providers: [VariantsRepository],
  exports: [VariantsRepository],
})
export class VariantsModule {}
