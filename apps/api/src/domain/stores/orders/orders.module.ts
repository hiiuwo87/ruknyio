import { Module } from '@nestjs/common';
import { OrdersRepository } from './orders.repository';
import { PrismaModule } from '../../../core/database/prisma/prisma.module';
import { RedisModule } from '../../../core/cache/redis.module';

@Module({
  imports: [PrismaModule, RedisModule],
  providers: [OrdersRepository],
  exports: [OrdersRepository],
})
export class OrdersModule {}
