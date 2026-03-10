import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from './redis.service';

/**
 * ⚡ Cache Options for wrap method
 */
export interface CacheWrapOptions {
  /** Tags for grouped invalidation */
  tags?: string[];
  /** Skip cache read (force refresh) */
  forceRefresh?: boolean;
  /** Custom condition to skip caching (e.g., skip if result is null) */
  skipIf?: (result: any) => boolean;
}

@Injectable()
export class CacheManager {
  private readonly logger = new Logger(CacheManager.name);
  private readonly METRICS_HASH = 'cache:metrics';
  private readonly TAGS_PREFIX = 'cache:tags:';

  constructor(private readonly redis: RedisService) {}

  /**
   * ⚡ Performance: Wrap a compute function with cache lookup and metrics.
   * Uses batched Redis operations to minimize RTT.
   * - key: redis key
   * - ttlSeconds: expiration
   * - compute: function that returns the value when cache miss
   * - options: additional cache options (tags, forceRefresh, skipIf)
   */
  async wrap<T>(
    key: string,
    ttlSeconds: number,
    compute: () => Promise<T>,
    options?: CacheWrapOptions,
  ): Promise<T> {
    const start = Date.now();

    // Try to get from cache (unless forceRefresh)
    if (!options?.forceRefresh) {
      try {
        const cached = await this.redis.get<T>(key);
        if (cached !== null) {
          // ⚡ Use batch increment for hit metrics (fire and forget)
          this.redis
            .hincrbyBatch([
              { hash: this.METRICS_HASH, field: 'hits' },
              { hash: this.METRICS_HASH, field: `hits:${this.getKeyPrefix(key)}` },
            ])
            .catch(() => {}); // Non-blocking metrics
          return cached;
        }
      } catch (err) {
        this.logger.warn(`Cache get error for ${key}: ${err?.message || err}`);
      }
    }

    // Miss: compute
    const computeStart = Date.now();
    const result = await compute();
    const computeLatency = Date.now() - computeStart;

    // Check if we should skip caching this result
    if (options?.skipIf && options.skipIf(result)) {
      return result;
    }

    try {
      // ⚡ Set cache value first (blocking)
      await this.redis.set(key, result, ttlSeconds);

      // ⚡ Track tags for grouped invalidation (non-blocking)
      if (options?.tags && options.tags.length > 0) {
        this.trackTags(key, options.tags, ttlSeconds).catch(() => {});
      }

      // ⚡ Batch metrics update (fire and forget for performance)
      const total = Date.now() - start;
      Promise.all([
        this.redis.hincrbyBatch([
          { hash: this.METRICS_HASH, field: 'misses' },
          { hash: this.METRICS_HASH, field: `misses:${this.getKeyPrefix(key)}` },
        ]),
        this.redis.hset('cache:latency', this.getKeyPrefix(key), String(computeLatency)),
        this.redis.hset('cache:wrap_latency', this.getKeyPrefix(key), String(total)),
      ]).catch(() => {}); // Non-blocking metrics
    } catch (err) {
      this.logger.warn(`Cache set error for ${key}: ${err?.message || err}`);
    }

    return result;
  }

  /**
   * ⚡ Get cached value without compute fallback
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      return await this.redis.get<T>(key);
    } catch (err) {
      this.logger.warn(`Cache get error for ${key}: ${err?.message || err}`);
      return null;
    }
  }

  /**
   * ⚡ Set cache value directly
   */
  async set<T>(key: string, value: T, ttlSeconds: number, tags?: string[]): Promise<void> {
    try {
      await this.redis.set(key, value, ttlSeconds);
      if (tags && tags.length > 0) {
        await this.trackTags(key, tags, ttlSeconds);
      }
    } catch (err) {
      this.logger.warn(`Cache set error for ${key}: ${err?.message || err}`);
    }
  }

  /**
   * ⚡ Invalidate multiple cache keys at once
   */
  async invalidate(...keys: string[]): Promise<void> {
    if (keys.length === 0) return;
    try {
      await this.redis.delMany(keys);
      this.logger.debug(`Invalidated ${keys.length} cache keys`);
    } catch (err) {
      this.logger.warn(`Cache invalidate error: ${err?.message || err}`);
    }
  }

  /**
   * ⚡ Invalidate all keys matching a pattern
   */
  async invalidatePattern(pattern: string): Promise<number> {
    try {
      const count = await this.redis.delPattern(pattern);
      this.logger.debug(`Invalidated ${count} keys matching pattern: ${pattern}`);
      return count;
    } catch (err) {
      this.logger.warn(`Cache invalidate pattern error: ${err?.message || err}`);
      return 0;
    }
  }

  /**
   * ⚡ Invalidate all keys associated with specific tags
   */
  async invalidateByTags(...tags: string[]): Promise<number> {
    if (tags.length === 0) return 0;

    let totalInvalidated = 0;

    try {
      for (const tag of tags) {
        const tagKey = `${this.TAGS_PREFIX}${tag}`;
        const keys = await this.redis.get<string[]>(tagKey);

        if (keys && keys.length > 0) {
          await this.redis.delMany(keys);
          await this.redis.del(tagKey);
          totalInvalidated += keys.length;
          this.logger.debug(`Invalidated ${keys.length} keys for tag: ${tag}`);
        }
      }
    } catch (err) {
      this.logger.warn(`Cache invalidate by tags error: ${err?.message || err}`);
    }

    return totalInvalidated;
  }

  /**
   * ⚡ Batch get multiple keys at once
   */
  async getMany<T>(keys: string[]): Promise<(T | null)[]> {
    if (keys.length === 0) return [];
    try {
      return await this.redis.mget<T>(keys);
    } catch (err) {
      this.logger.warn(`Cache getMany error: ${err?.message || err}`);
      return keys.map(() => null);
    }
  }

  /**
   * ⚡ Batch set multiple keys at once
   */
  async setMany(entries: Array<{ key: string; value: unknown; ttl?: number }>): Promise<void> {
    if (entries.length === 0) return;
    try {
      await this.redis.mset(entries);
    } catch (err) {
      this.logger.warn(`Cache setMany error: ${err?.message || err}`);
    }
  }

  /**
   * ⚡ Cache warming - preload frequently accessed data
   */
  async warm<T>(
    keys: string[],
    fetcher: (key: string) => Promise<T>,
    ttlSeconds: number,
  ): Promise<void> {
    const start = Date.now();
    let warmed = 0;

    await Promise.all(
      keys.map(async (key) => {
        try {
          const cached = await this.redis.get(key);
          if (cached === null) {
            const value = await fetcher(key);
            if (value !== null && value !== undefined) {
              await this.redis.set(key, value, ttlSeconds);
              warmed++;
            }
          }
        } catch (err) {
          this.logger.warn(`Cache warm error for ${key}: ${err?.message || err}`);
        }
      }),
    );

    const duration = Date.now() - start;
    this.logger.log(`Cache warmed: ${warmed}/${keys.length} keys in ${duration}ms`);
  }

  /**
   * ⚡ Get comprehensive cache metrics
   */
  async getMetrics(): Promise<{
    hits: number;
    misses: number;
    hitRate: number;
    topKeys: { key: string; hits: number }[];
  }> {
    try {
      const hitsStr = await this.redis.hget(this.METRICS_HASH, 'hits');
      const missesStr = await this.redis.hget(this.METRICS_HASH, 'misses');

      const hits = parseInt(hitsStr || '0', 10);
      const misses = parseInt(missesStr || '0', 10);
      const total = hits + misses;
      const hitRate = total > 0 ? (hits / total) * 100 : 0;

      return {
        hits,
        misses,
        hitRate: Math.round(hitRate * 100) / 100,
        topKeys: [], // Could be extended to track per-key metrics
      };
    } catch (err) {
      return { hits: 0, misses: 0, hitRate: 0, topKeys: [] };
    }
  }

  /**
   * ⚡ Reset cache metrics
   */
  async resetMetrics(): Promise<void> {
    try {
      await this.redis.del(this.METRICS_HASH);
      await this.redis.del('cache:latency');
      await this.redis.del('cache:wrap_latency');
    } catch (err) {
      this.logger.warn(`Cache reset metrics error: ${err?.message || err}`);
    }
  }

  /**
   * Track keys by tags for grouped invalidation
   */
  private async trackTags(key: string, tags: string[], ttlSeconds: number): Promise<void> {
    for (const tag of tags) {
      const tagKey = `${this.TAGS_PREFIX}${tag}`;
      const existingKeys = (await this.redis.get<string[]>(tagKey)) || [];

      if (!existingKeys.includes(key)) {
        existingKeys.push(key);
        // Set with slightly longer TTL to ensure tag outlives cached items
        await this.redis.set(tagKey, existingKeys, ttlSeconds + 60);
      }
    }
  }

  /**
   * Extract key prefix for metrics grouping
   */
  private getKeyPrefix(key: string): string {
    const parts = key.split(':');
    return parts.length > 1 ? `${parts[0]}:${parts[1]}` : key;
  }
}
