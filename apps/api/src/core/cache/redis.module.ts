import { Module, Global } from '@nestjs/common';
import { RedisService } from './redis.service';
import { CacheManager } from './cache.manager';

// Re-export cache utilities for easy imports
export * from './cache.constants';
export * from './cache.decorator';
export * from './cache.manager';

@Global()
@Module({
  providers: [RedisService, CacheManager],
  exports: [RedisService, CacheManager],
})
export class RedisModule {}
