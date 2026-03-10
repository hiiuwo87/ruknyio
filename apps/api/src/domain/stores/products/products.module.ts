import { Module } from '@nestjs/common';
import { PrismaModule } from '../../../core/database/prisma/prisma.module';
import { RedisModule } from '../../../core/cache/redis.module';
import { ProductsRepository } from './products.repository';

// Note: Controllers/Services will be migrated here later.
// For now we only provide the repository to avoid unresolved imports.

@Module({
  imports: [PrismaModule, RedisModule],
  providers: [ProductsRepository],
  exports: [ProductsRepository],
})
export class ProductsModule {}
