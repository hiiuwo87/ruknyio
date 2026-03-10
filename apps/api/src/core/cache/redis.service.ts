import { Injectable, OnModuleDestroy, Logger } from '@nestjs/common';
import { Redis } from 'ioredis';

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client: Redis;
  private isConnected: boolean = false;

  constructor() {
    const redisUrl = process.env.REDIS_URL || `redis://localhost:6379`;

    // ⚡ Performance: Enhanced Redis configuration with connection pooling
    this.client = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      enableOfflineQueue: true,
      // Connection pool settings
      lazyConnect: false,
      keepAlive: 30000, // Keep connection alive for 30s
      retryStrategy: (times: number) => {
        // Exponential backoff: reconnect after delay
        const delay = Math.min(times * 100, 3000);
        this.logger.warn(`Redis reconnecting in ${delay}ms (attempt ${times})`);
        return delay;
      },
      reconnectOnError: (err) => {
        const targetErrors = ['READONLY', 'ECONNREFUSED'];
        if (
          targetErrors.some((targetError) => err.message.includes(targetError))
        ) {
          // Reconnect on specific errors
          return true;
        }
        return false;
      },
    });

    this.client.on('connect', () => {
      this.isConnected = true;
      this.logger.log(`✅ Connected to Redis: ${redisUrl}`);
    });

    this.client.on('ready', () => {
      this.logger.log('✅ Redis client ready');
    });

    this.client.on('error', (err) => {
      this.isConnected = false;
      this.logger.error('❌ Redis error:', err.message);
    });

    this.client.on('close', () => {
      this.isConnected = false;
      this.logger.warn('⚠️ Redis connection closed');
    });

    this.client.on('reconnecting', () => {
      this.logger.log('🔄 Redis reconnecting...');
    });
  }

  async get<T = any>(key: string): Promise<T | null> {
    // ⚡ Performance: Graceful degradation if Redis is down
    if (!this.isConnected) {
      this.logger.warn(`Redis not connected, cache miss for: ${key}`);
      return null;
    }

    try {
      const raw = await this.client.get(key);
      if (!raw) return null;
      try {
        return JSON.parse(raw) as T;
      } catch (e) {
        return raw as unknown as T;
      }
    } catch (error) {
      this.logger.error(`Error getting key ${key}:`, error.message);
      return null;
    }
  }

  async set(key: string, value: unknown, ttlSeconds?: number): Promise<void> {
    if (!this.isConnected) {
      this.logger.warn(`Redis not connected, skipping cache set for: ${key}`);
      return;
    }

    try {
      const raw = typeof value === 'string' ? value : JSON.stringify(value);
      if (ttlSeconds && ttlSeconds > 0) {
        await this.client.set(key, raw, 'EX', ttlSeconds);
      } else {
        await this.client.set(key, raw);
      }
    } catch (error) {
      this.logger.error(`Error setting key ${key}:`, error.message);
    }
  }

  async del(key: string): Promise<void> {
    if (!this.isConnected) return;

    try {
      await this.client.del(key);
    } catch (error) {
      this.logger.error(`Error deleting key ${key}:`, error.message);
    }
  }

  // ⚡ Performance: Delete multiple keys at once
  async delMany(keys: string[]): Promise<number> {
    if (!this.isConnected || keys.length === 0) return 0;

    try {
      return await this.client.del(...keys);
    } catch (error) {
      this.logger.error(`Error deleting multiple keys:`, error.message);
      return 0;
    }
  }

  // ⚡ Performance: Batch delete with pattern matching
  async delPattern(pattern: string): Promise<number> {
    if (!this.isConnected) return 0;

    try {
      const keys = await this.client.keys(pattern);
      if (keys.length === 0) return 0;

      // Delete in batches of 100
      const batchSize = 100;
      let deleted = 0;
      for (let i = 0; i < keys.length; i += batchSize) {
        const batch = keys.slice(i, i + batchSize);
        deleted += await this.client.del(...batch);
      }
      this.logger.log(`Deleted ${deleted} keys matching pattern: ${pattern}`);
      return deleted;
    } catch (error) {
      this.logger.error(`Error deleting pattern ${pattern}:`, error.message);
      return 0;
    }
  }

  // ⚡ Performance: Pipeline for batch operations (reduces RTT)
  async pipeline() {
    return this.client.pipeline();
  }

  // ⚡ Performance: Batch get multiple keys
  async mget<T = any>(keys: string[]): Promise<(T | null)[]> {
    if (!this.isConnected || keys.length === 0) return [];

    try {
      const values = await this.client.mget(keys);
      return values.map((v) => {
        if (!v) return null;
        try {
          return JSON.parse(v) as T;
        } catch {
          return v as unknown as T;
        }
      });
    } catch (error) {
      this.logger.error(`Error getting multiple keys:`, error.message);
      return keys.map(() => null);
    }
  }

  // ⚡ Performance: Batch set multiple keys with pipeline
  async mset(
    entries: Array<{ key: string; value: unknown; ttl?: number }>,
  ): Promise<void> {
    if (!this.isConnected || entries.length === 0) return;

    try {
      const pipeline = this.client.pipeline();

      for (const { key, value, ttl } of entries) {
        const raw = typeof value === 'string' ? value : JSON.stringify(value);
        if (ttl && ttl > 0) {
          pipeline.set(key, raw, 'EX', ttl);
        } else {
          pipeline.set(key, raw);
        }
      }

      await pipeline.exec();
    } catch (error) {
      this.logger.error(`Error setting multiple keys:`, error.message);
    }
  }

  // Increment a numeric key
  async incr(key: string): Promise<number> {
    if (!this.isConnected) return 0;
    try {
      return await this.client.incr(key);
    } catch (error) {
      this.logger.error(`Error incrementing key ${key}:`, error.message);
      return 0;
    }
  }

  // Hash operations for simple metrics
  async hincrby(hash: string, field: string, by = 1): Promise<number> {
    if (!this.isConnected) return 0;
    try {
      return await this.client.hincrby(hash, field, by);
    } catch (error) {
      this.logger.error(
        `Error incrementing hash ${hash} field ${field}:`,
        error.message,
      );
      return 0;
    }
  }

  async hset(hash: string, field: string, value: string): Promise<void> {
    if (!this.isConnected) return;
    try {
      await this.client.hset(hash, field, value);
    } catch (error) {
      this.logger.error(
        `Error setting hash ${hash} field ${field}:`,
        error.message,
      );
    }
  }

  async hget(hash: string, field: string): Promise<string | null> {
    if (!this.isConnected) return null;
    try {
      return await this.client.hget(hash, field);
    } catch (error) {
      this.logger.error(
        `Error getting hash ${hash} field ${field}:`,
        error.message,
      );
      return null;
    }
  }

  // ⚡ Performance: Batch hash increment with pipeline
  async hincrbyBatch(
    operations: Array<{ hash: string; field: string; by?: number }>,
  ): Promise<void> {
    if (!this.isConnected || operations.length === 0) return;

    try {
      const pipeline = this.client.pipeline();
      for (const { hash, field, by = 1 } of operations) {
        pipeline.hincrby(hash, field, by);
      }
      await pipeline.exec();
    } catch (error) {
      this.logger.error(`Error in batch hash increment:`, error.message);
    }
  }

  // ⚡ Performance: Check connection health
  async ping(): Promise<boolean> {
    try {
      const result = await this.client.ping();
      return result === 'PONG';
    } catch (error) {
      return false;
    }
  }

  // Get connection status
  getConnectionStatus(): { connected: boolean; ready: boolean } {
    return {
      connected: this.isConnected,
      ready: this.client.status === 'ready',
    };
  }

  // Get raw Redis client for advanced operations
  getClient(): Redis {
    return this.client;
  }

  // ============ Additional Redis Operations ============

  async setex(key: string, seconds: number, value: string): Promise<void> {
    if (!this.isConnected) return;
    try {
      await this.client.setex(key, seconds, value);
    } catch (error) {
      this.logger.error(`Error setex ${key}:`, error.message);
    }
  }

  // Set if Not eXists - atomic operation for locking
  async setNX(key: string, value: string, ttlSeconds?: number): Promise<boolean> {
    if (!this.isConnected) return false;
    try {
      let result: 'OK' | null;
      if (ttlSeconds && ttlSeconds > 0) {
        // SET key value EX seconds NX - atomic set with expiry only if not exists
        result = await this.client.set(key, value, 'EX', ttlSeconds, 'NX');
      } else {
        result = await this.client.set(key, value, 'NX');
      }
      return result === 'OK';
    } catch (error) {
      this.logger.error(`Error setNX ${key}:`, error.message);
      return false;
    }
  }

  async expire(key: string, seconds: number): Promise<boolean> {
    if (!this.isConnected) return false;
    try {
      const result = await this.client.expire(key, seconds);
      return result === 1;
    } catch (error) {
      this.logger.error(`Error expire ${key}:`, error.message);
      return false;
    }
  }

  async ttl(key: string): Promise<number> {
    if (!this.isConnected) return -1;
    try {
      return await this.client.ttl(key);
    } catch (error) {
      this.logger.error(`Error ttl ${key}:`, error.message);
      return -1;
    }
  }

  async decr(key: string): Promise<number> {
    if (!this.isConnected) return 0;
    try {
      return await this.client.decr(key);
    } catch (error) {
      this.logger.error(`Error decr ${key}:`, error.message);
      return 0;
    }
  }

  async keys(pattern: string): Promise<string[]> {
    if (!this.isConnected) return [];
    try {
      return await this.client.keys(pattern);
    } catch (error) {
      this.logger.error(`Error keys ${pattern}:`, error.message);
      return [];
    }
  }

  // Hash operations
  async hgetall(hash: string): Promise<Record<string, string> | null> {
    if (!this.isConnected) return null;
    try {
      const result = await this.client.hgetall(hash);
      return Object.keys(result).length > 0 ? result : null;
    } catch (error) {
      this.logger.error(`Error hgetall ${hash}:`, error.message);
      return null;
    }
  }

  async hmset(hash: string, data: Record<string, string>): Promise<void> {
    if (!this.isConnected) return;
    try {
      await this.client.hmset(hash, data);
    } catch (error) {
      this.logger.error(`Error hmset ${hash}:`, error.message);
    }
  }

  async hexists(hash: string, field: string): Promise<number> {
    if (!this.isConnected) return 0;
    try {
      return await this.client.hexists(hash, field);
    } catch (error) {
      this.logger.error(`Error hexists ${hash}:`, error.message);
      return 0;
    }
  }

  // Set operations
  async sadd(key: string, ...members: string[]): Promise<number> {
    if (!this.isConnected) return 0;
    try {
      return await this.client.sadd(key, ...members);
    } catch (error) {
      this.logger.error(`Error sadd ${key}:`, error.message);
      return 0;
    }
  }

  async scard(key: string): Promise<number> {
    if (!this.isConnected) return 0;
    try {
      return await this.client.scard(key);
    } catch (error) {
      this.logger.error(`Error scard ${key}:`, error.message);
      return 0;
    }
  }

  async smembers(key: string): Promise<string[]> {
    if (!this.isConnected) return [];
    try {
      return await this.client.smembers(key);
    } catch (error) {
      this.logger.error(`Error smembers ${key}:`, error.message);
      return [];
    }
  }

  // List operations
  async lpush(key: string, ...values: string[]): Promise<number> {
    if (!this.isConnected) return 0;
    try {
      return await this.client.lpush(key, ...values);
    } catch (error) {
      this.logger.error(`Error lpush ${key}:`, error.message);
      return 0;
    }
  }

  async lrange(key: string, start: number, stop: number): Promise<string[]> {
    if (!this.isConnected) return [];
    try {
      return await this.client.lrange(key, start, stop);
    } catch (error) {
      this.logger.error(`Error lrange ${key}:`, error.message);
      return [];
    }
  }

  async ltrim(key: string, start: number, stop: number): Promise<void> {
    if (!this.isConnected) return;
    try {
      await this.client.ltrim(key, start, stop);
    } catch (error) {
      this.logger.error(`Error ltrim ${key}:`, error.message);
    }
  }

  async onModuleDestroy() {
    try {
      await this.client.quit();
      this.logger.log('🔌 Redis connection closed gracefully');
    } catch (e) {
      this.logger.warn('Error closing Redis client', e);
    }
  }
}
