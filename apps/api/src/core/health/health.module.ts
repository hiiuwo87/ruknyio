import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';

@Module({
  controllers: [HealthController],
  // PrismaService, RedisService, CacheManager are global (from PrismaModule and RedisModule)
})
export class HealthModule {}
