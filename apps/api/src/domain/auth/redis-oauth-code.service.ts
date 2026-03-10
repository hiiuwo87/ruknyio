import {
  Injectable,
  BadRequestException,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

type CodePayload = {
  access_token: string;
  refresh_token: string;
  user: {
    id: string;
    name: string;
    email: string;
    role?: any;
    avatar?: string | null;
    profileCompleted?: boolean;
  };
  needsProfileCompletion?: boolean;
};

/**
 * 🔒 Redis-based OAuth Code Service
 *
 * Stores one-time OAuth authorization codes in Redis with:
 * - 5-minute TTL
 * - Single-use enforcement
 * - Distributed/scalable storage
 * - Automatic expiry cleanup
 *
 * Replaces in-memory Map implementation for production safety
 */
@Injectable()
export class RedisOAuthCodeService implements OnModuleInit, OnModuleDestroy {
  private redis: Redis;
  private readonly TTL_SECONDS = 5 * 60; // 5 minutes
  private readonly KEY_PREFIX = 'oauth:code:';

  constructor(private configService: ConfigService) {}

  async onModuleInit() {
    // Initialize Redis connection - prefer REDIS_URL for Railway/production
    const redisUrl = this.configService.get<string>('REDIS_URL');
    
    if (redisUrl) {
      // Use REDIS_URL if available (Railway, production)
      this.redis = new Redis(redisUrl, {
        retryStrategy: (times) => {
          const delay = Math.min(times * 50, 2000);
          return delay;
        },
        maxRetriesPerRequest: 3,
      });
    } else {
      // Fallback to individual settings (local development)
      const host = this.configService.get<string>('REDIS_HOST') || 'localhost';
      const port = this.configService.get<number>('REDIS_PORT') || 6379;
      const password = this.configService.get<string>('REDIS_PASSWORD');
      const db = this.configService.get<number>('REDIS_DB') || 0;

      this.redis = new Redis({
        host,
        port,
        password,
        db,
        retryStrategy: (times) => {
          const delay = Math.min(times * 50, 2000);
          return delay;
        },
        maxRetriesPerRequest: 3,
      });
    }

    this.redis.on('error', (err) => {
      console.error('❌ Redis connection error:', err);
    });

    this.redis.on('connect', () => {
      console.log('✅ Redis connected for OAuth code storage');
    });
  }

  async onModuleDestroy() {
    await this.redis.quit();
  }

  /**
   * Generate and store a one-time OAuth code
   */
  async generate(payload: CodePayload): Promise<string> {
    const code = this.randomCode();
    const key = this.KEY_PREFIX + code;

    try {
      // Store with automatic expiry
      await this.redis.setex(
        key,
        this.TTL_SECONDS,
        JSON.stringify({
          ...payload,
          createdAt: Date.now(),
        }),
      );

      return code;
    } catch (error) {
      console.error('❌ Failed to store OAuth code in Redis:', error);
      throw new BadRequestException('Failed to generate authorization code');
    }
  }

  /**
   * Exchange code for tokens (single-use)
   */
  async exchange(code: string): Promise<CodePayload> {
    const key = this.KEY_PREFIX + code;

    try {
      // Atomically GET and DEL the code using Lua for broad Redis compatibility
      // Note: GETDEL requires Redis >= 6.2, so we use a Lua fallback here.
      const script = `
        local val = redis.call('GET', KEYS[1])
        if not val then return nil end
        redis.call('DEL', KEYS[1])
        return val
      `;
      const data = (await this.redis.eval(script, 1, key)) as string | null;

      if (!data) {
        throw new BadRequestException('Invalid or expired authorization code');
      }

      const record = JSON.parse(data);

      // Additional validation: check if code is too old (shouldn't happen with TTL)
      const age = Date.now() - record.createdAt;
      if (age > this.TTL_SECONDS * 1000) {
        throw new BadRequestException('Authorization code expired');
      }

      return {
        access_token: record.access_token,
        refresh_token: record.refresh_token,
        user: record.user,
        needsProfileCompletion: record.needsProfileCompletion,
      };
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      console.error(
        '❌ Failed to exchange OAuth code via Redis (key: ' + key + '):',
        error,
      );
      throw new BadRequestException('Failed to exchange authorization code');
    }
  }

  /**
   * Generate cryptographically secure random code
   */
  private randomCode(): string {
    const crypto = require('crypto');
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Health check: verify Redis connection
   */
  async healthCheck(): Promise<boolean> {
    try {
      await this.redis.ping();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get statistics (for monitoring)
   */
  async getStats(): Promise<{
    activeCodeCount: number;
    redisConnected: boolean;
  }> {
    try {
      const keys = await this.redis.keys(`${this.KEY_PREFIX}*`);
      const connected = await this.healthCheck();

      return {
        activeCodeCount: keys.length,
        redisConnected: connected,
      };
    } catch {
      return {
        activeCodeCount: 0,
        redisConnected: false,
      };
    }
  }
}
