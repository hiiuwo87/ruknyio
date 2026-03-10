import { Module } from '@nestjs/common';
import { CartRepository } from './cart.repository';
import { PrismaModule } from '../../../core/database/prisma/prisma.module';

// Minimal module exposing repository only until migration completes
@Module({
  imports: [PrismaModule],
  providers: [CartRepository],
  exports: [CartRepository],
})
export class CartModule {}
