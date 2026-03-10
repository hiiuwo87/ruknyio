import { Module } from '@nestjs/common';
import { ReviewsRepository } from './reviews.repository';
import { PrismaModule } from '../../../core/database/prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [ReviewsRepository],
  exports: [ReviewsRepository],
})
export class ReviewsModule {}
