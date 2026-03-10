import { Module } from '@nestjs/common';
import { CouponsRepository } from './coupons.repository';
import { PrismaModule } from '../../../core/database/prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [CouponsRepository],
  exports: [CouponsRepository],
})
export class CouponsModule {}
