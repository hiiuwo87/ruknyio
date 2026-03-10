import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { RedisService } from '../../core/cache/redis.service';

export interface RateLimitConfig {
  /** الحد الأقصى للطلبات */
  limit: number;
  /** النافذة الزمنية بالثواني */
  window: number;
  /** معرف النقطة النهائية */
  endpoint?: string;
  /** استراتيجية التحديد */
  strategy?: 'sliding-window' | 'fixed-window' | 'token-bucket';
}

export interface RateLimitResult {
  /** هل مسموح؟ */
  allowed: boolean;
  /** عدد الطلبات المتبقية */
  remaining: number;
  /** وقت إعادة التعيين (Unix timestamp) */
  resetAt: number;
  /** عدد الطلبات الحالي */
  current: number;
  /** الحد الأقصى */
  limit: number;
  /** وقت الانتظار بالثواني (إذا تم تجاوز الحد) */
  retryAfter?: number;
}

export interface RateLimitTier {
  name: string;
  limits: {
    default: RateLimitConfig;
    auth: RateLimitConfig;
    upload: RateLimitConfig;
    api: RateLimitConfig;
  };
}

/**
 * 🚦 Rate Limiting Service
 *
 * تحديد معدل الطلبات باستخدام خوارزميات متقدمة
 */
@Injectable()
export class RateLimitingService implements OnModuleInit {
  private readonly logger = new Logger(RateLimitingService.name);
  private readonly PREFIX = 'rate_limit:';

  // تعريف الطبقات المختلفة
  private readonly tiers: Record<string, RateLimitTier> = {
    anonymous: {
      name: 'Anonymous',
      limits: {
        default: { limit: 100, window: 60 },
        auth: { limit: 5, window: 60 },
        upload: { limit: 10, window: 3600 },
        api: { limit: 50, window: 60 },
      },
    },
    free: {
      name: 'Free User',
      limits: {
        default: { limit: 500, window: 60 },
        auth: { limit: 10, window: 60 },
        upload: { limit: 50, window: 3600 },
        api: { limit: 200, window: 60 },
      },
    },
    premium: {
      name: 'Premium User',
      limits: {
        default: { limit: 2000, window: 60 },
        auth: { limit: 20, window: 60 },
        upload: { limit: 500, window: 3600 },
        api: { limit: 1000, window: 60 },
      },
    },
    enterprise: {
      name: 'Enterprise',
      limits: {
        default: { limit: 10000, window: 60 },
        auth: { limit: 50, window: 60 },
        upload: { limit: 5000, window: 3600 },
        api: { limit: 5000, window: 60 },
      },
    },
  };

  // حدود خاصة بنقاط نهائية محددة
  private readonly endpointLimits: Record<string, RateLimitConfig> = {
    'POST:/auth/login': { limit: 5, window: 300 },
    'POST:/auth/register': { limit: 3, window: 3600 },
    'POST:/auth/forgot-password': { limit: 3, window: 3600 },
    'POST:/auth/verify-otp': { limit: 10, window: 300 },
    'POST:/upload': { limit: 20, window: 3600 },
    'POST:/stores': { limit: 5, window: 3600 },
    'POST:/events': { limit: 10, window: 3600 },
    'POST:/contact': { limit: 5, window: 3600 },
  };

  constructor(private readonly redis: RedisService) {}

  onModuleInit() {
    this.logger.log('🚦 Rate limiting service initialized');
  }

  /**
   * فحص معدل الطلبات باستخدام Sliding Window
   */
  async checkRateLimit(
    identifier: string,
    config: RateLimitConfig,
  ): Promise<RateLimitResult> {
    const key = `${this.PREFIX}${config.endpoint || 'global'}:${identifier}`;
    const now = Date.now();
    const windowStart = now - config.window * 1000;

    const client = this.redis.getClient();

    // استخدام Lua script للذرية
    const script = `
      local key = KEYS[1]
      local now = tonumber(ARGV[1])
      local window_start = tonumber(ARGV[2])
      local limit = tonumber(ARGV[3])
      local window = tonumber(ARGV[4])

      -- إزالة الطلبات القديمة
      redis.call('ZREMRANGEBYSCORE', key, '-inf', window_start)
      
      -- عدد الطلبات الحالي
      local current = redis.call('ZCARD', key)
      
      if current < limit then
        -- إضافة الطلب الجديد
        redis.call('ZADD', key, now, now .. '-' .. math.random())
        redis.call('EXPIRE', key, window)
        return {1, limit - current - 1, current + 1}
      else
        -- تجاوز الحد
        local oldest = redis.call('ZRANGE', key, 0, 0, 'WITHSCORES')
        local retry_after = 0
        if #oldest > 0 then
          retry_after = math.ceil((tonumber(oldest[2]) + window * 1000 - now) / 1000)
        end
        return {0, 0, current, retry_after}
      end
    `;

    try {
      const result = await client.eval(
        script,
        1,
        key,
        now.toString(),
        windowStart.toString(),
        config.limit.toString(),
        config.window.toString(),
      ) as number[];

      return {
        allowed: result[0] === 1,
        remaining: result[1],
        current: result[2],
        limit: config.limit,
        resetAt: Math.floor((now + config.window * 1000) / 1000),
        retryAfter: result[3] || undefined,
      };
    } catch (error) {
      this.logger.error(`Rate limit check failed: ${error.message}`);
      // في حالة الخطأ، نسمح بالطلب
      return {
        allowed: true,
        remaining: config.limit,
        current: 0,
        limit: config.limit,
        resetAt: Math.floor((now + config.window * 1000) / 1000),
      };
    }
  }

  /**
   * فحص معدل الطلبات حسب المستخدم
   */
  async checkUserRateLimit(
    userId: string,
    endpoint: string,
    tier: string = 'free',
  ): Promise<RateLimitResult> {
    const tierConfig = this.tiers[tier] || this.tiers.free;
    const endpointType = this.getEndpointType(endpoint);
    const config = tierConfig.limits[endpointType];

    return this.checkRateLimit(`user:${userId}`, {
      ...config,
      endpoint,
    });
  }

  /**
   * فحص معدل الطلبات حسب IP
   */
  async checkIpRateLimit(
    ip: string,
    endpoint: string,
  ): Promise<RateLimitResult> {
    // استخدام الحد الخاص بالنقطة النهائية إن وجد
    const endpointConfig = this.endpointLimits[endpoint];
    const config = endpointConfig || this.tiers.anonymous.limits.default;

    return this.checkRateLimit(`ip:${ip}`, {
      ...config,
      endpoint,
    });
  }

  /**
   * فحص مجمع (IP + User)
   */
  async checkCombinedRateLimit(
    ip: string,
    userId: string | null,
    endpoint: string,
    tier: string = 'free',
  ): Promise<RateLimitResult> {
    // فحص IP أولاً
    const ipResult = await this.checkIpRateLimit(ip, endpoint);
    if (!ipResult.allowed) {
      return ipResult;
    }

    // إذا كان هناك مستخدم، فحص حسب المستخدم
    if (userId) {
      const userResult = await this.checkUserRateLimit(userId, endpoint, tier);
      return userResult;
    }

    return ipResult;
  }

  /**
   * إعادة تعيين حد المستخدم
   */
  async resetUserLimit(userId: string, endpoint?: string): Promise<void> {
    const pattern = endpoint
      ? `${this.PREFIX}${endpoint}:user:${userId}`
      : `${this.PREFIX}*:user:${userId}`;

    const client = this.redis.getClient();
    const keys = await client.keys(pattern);

    if (keys.length > 0) {
      await client.del(...keys);
      this.logger.log(`Reset rate limits for user ${userId}`);
    }
  }

  /**
   * إعادة تعيين حد IP
   */
  async resetIpLimit(ip: string, endpoint?: string): Promise<void> {
    const pattern = endpoint
      ? `${this.PREFIX}${endpoint}:ip:${ip}`
      : `${this.PREFIX}*:ip:${ip}`;

    const client = this.redis.getClient();
    const keys = await client.keys(pattern);

    if (keys.length > 0) {
      await client.del(...keys);
      this.logger.log(`Reset rate limits for IP ${ip.substring(0, 8)}***`);
    }
  }

  /**
   * الحصول على حالة معدل الطلبات
   */
  async getRateLimitStatus(identifier: string): Promise<{
    endpoints: Record<string, RateLimitResult>;
  }> {
    const client = this.redis.getClient();
    const pattern = `${this.PREFIX}*:${identifier}`;
    const keys = await client.keys(pattern);

    const endpoints: Record<string, RateLimitResult> = {};

    for (const key of keys) {
      const endpoint = key.replace(`${this.PREFIX}`, '').replace(`:${identifier}`, '');
      const count = await client.zcard(key);
      const config = this.endpointLimits[endpoint] || this.tiers.free.limits.default;

      endpoints[endpoint] = {
        allowed: count < config.limit,
        remaining: Math.max(0, config.limit - count),
        current: count,
        limit: config.limit,
        resetAt: Math.floor((Date.now() + config.window * 1000) / 1000),
      };
    }

    return { endpoints };
  }

  /**
   * إضافة إلى القائمة البيضاء
   */
  async addToWhitelist(identifier: string, duration?: number): Promise<void> {
    const key = `${this.PREFIX}whitelist:${identifier}`;
    const client = this.redis.getClient();

    if (duration) {
      await client.setex(key, duration, '1');
    } else {
      await client.set(key, '1');
    }

    this.logger.log(`Added ${identifier} to rate limit whitelist`);
  }

  /**
   * إزالة من القائمة البيضاء
   */
  async removeFromWhitelist(identifier: string): Promise<void> {
    const key = `${this.PREFIX}whitelist:${identifier}`;
    await this.redis.getClient().del(key);
    this.logger.log(`Removed ${identifier} from rate limit whitelist`);
  }

  /**
   * التحقق من القائمة البيضاء
   */
  async isWhitelisted(identifier: string): Promise<boolean> {
    const key = `${this.PREFIX}whitelist:${identifier}`;
    const result = await this.redis.getClient().get(key);
    return result === '1';
  }

  /**
   * الحصول على إحصائيات Rate Limiting
   */
  async getStatistics(): Promise<{
    activeKeys: number;
    topLimited: { identifier: string; count: number }[];
  }> {
    const client = this.redis.getClient();
    const keys = await client.keys(`${this.PREFIX}*`);

    const stats: { identifier: string; count: number }[] = [];

    for (const key of keys.slice(0, 100)) {
      if (!key.includes('whitelist')) {
        const count = await client.zcard(key);
        stats.push({ identifier: key, count });
      }
    }

    stats.sort((a, b) => b.count - a.count);

    return {
      activeKeys: keys.length,
      topLimited: stats.slice(0, 10),
    };
  }

  // ==================== Private Methods ====================

  private getEndpointType(endpoint: string): 'default' | 'auth' | 'upload' | 'api' {
    if (endpoint.includes('/auth')) return 'auth';
    if (endpoint.includes('/upload') || endpoint.includes('/files')) return 'upload';
    if (endpoint.includes('/api')) return 'api';
    return 'default';
  }
}
