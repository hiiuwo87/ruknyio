/**
 * ⚡ Cache Module Exports
 * Centralized cache utilities for the API
 */

// Core services
export { RedisService } from './redis.service';
export { CacheManager, CacheWrapOptions } from './cache.manager';

// Constants and keys
export {
  CACHE_TTL,
  CACHE_PREFIX,
  CacheKeys,
  CACHE_TAGS,
} from './cache.constants';

// Decorators
export {
  Cacheable,
  CacheInvalidate,
  CacheOptions,
  CacheInvalidateOptions,
  CACHE_KEY_METADATA,
  CACHE_TTL_METADATA,
  CACHE_TAGS_METADATA,
  CACHE_INVALIDATE_METADATA,
} from './cache.decorator';
