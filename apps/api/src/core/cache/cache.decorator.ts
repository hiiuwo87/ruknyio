import { SetMetadata } from '@nestjs/common';

/**
 * ⚡ Cache Decorator Metadata Keys
 */
export const CACHE_KEY_METADATA = 'cache:key';
export const CACHE_TTL_METADATA = 'cache:ttl';
export const CACHE_TAGS_METADATA = 'cache:tags';

/**
 * ⚡ Cache Options Interface
 */
export interface CacheOptions {
  /**
   * Cache key or key builder function
   * Can use method arguments: (userId) => `user:${userId}`
   */
  key: string | ((...args: any[]) => string);

  /**
   * Time to live in seconds
   */
  ttl: number;

  /**
   * Optional tags for grouped invalidation
   */
  tags?: string[];
}

/**
 * ⚡ Cacheable Decorator
 *
 * Marks a method for automatic caching.
 * Used with CacheInterceptor for automatic cache management.
 *
 * @example
 * ```typescript
 * @Cacheable({
 *   key: (userId: string) => `profile:${userId}`,
 *   ttl: CACHE_TTL.PROFILE,
 *   tags: [CACHE_TAGS.USER]
 * })
 * async getProfile(userId: string) {
 *   return this.prisma.profile.findUnique({ where: { userId } });
 * }
 * ```
 */
export function Cacheable(options: CacheOptions): MethodDecorator {
  return (target, propertyKey, descriptor) => {
    SetMetadata(CACHE_KEY_METADATA, options.key)(target, propertyKey, descriptor);
    SetMetadata(CACHE_TTL_METADATA, options.ttl)(target, propertyKey, descriptor);
    if (options.tags) {
      SetMetadata(CACHE_TAGS_METADATA, options.tags)(target, propertyKey, descriptor);
    }
    return descriptor;
  };
}

/**
 * ⚡ CacheInvalidate Decorator
 *
 * Marks a method to invalidate cache after execution.
 *
 * @example
 * ```typescript
 * @CacheInvalidate({
 *   keys: [(userId: string) => `profile:${userId}`],
 *   patterns: ['profile:*']
 * })
 * async updateProfile(userId: string, data: UpdateProfileDto) {
 *   // ... update logic
 * }
 * ```
 */
export const CACHE_INVALIDATE_METADATA = 'cache:invalidate';

export interface CacheInvalidateOptions {
  /**
   * Specific keys or key builders to invalidate
   */
  keys?: (string | ((...args: any[]) => string))[];

  /**
   * Patterns to match for bulk invalidation
   */
  patterns?: string[];

  /**
   * Tags to invalidate
   */
  tags?: string[];
}

export function CacheInvalidate(options: CacheInvalidateOptions): MethodDecorator {
  return (target, propertyKey, descriptor) => {
    SetMetadata(CACHE_INVALIDATE_METADATA, options)(target, propertyKey, descriptor);
    return descriptor;
  };
}
