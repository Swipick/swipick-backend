import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';

interface ApiCallLog {
  timestamp: number;
  endpoint: string;
  success: boolean;
  cached: boolean;
}

export interface DailyQuota {
  date: string;
  totalCalls: number;
  remainingCalls: number;
  cached: number;
  failed: number;
}

@Injectable()
export class ApiRateLimitService {
  private readonly logger = new Logger(ApiRateLimitService.name);
  private redis: Redis;
  private readonly MAX_DAILY_CALLS = 80; // Keep 20 calls as buffer
  private readonly CACHE_PRIORITIES = {
    SERIE_A_FIXTURES: { ttl: 4 * 60 * 60 * 1000, priority: 1 }, // 4 hours
    LIVE_MATCHES: { ttl: 2 * 60 * 1000, priority: 2 }, // 2 minutes
    DAILY_FIXTURES: { ttl: 15 * 60 * 1000, priority: 3 }, // 15 minutes
    TEAM_DATA: { ttl: 24 * 60 * 60 * 1000, priority: 4 }, // 24 hours
  };

  constructor(private readonly configService: ConfigService) {
    this.initializeRedis();
  }

  private initializeRedis() {
    const redisUrl = this.configService.get<string>('REDIS_URL');
    if (redisUrl) {
      this.redis = new Redis(redisUrl, {
        maxRetriesPerRequest: 3,
        lazyConnect: true,
      });
      this.logger.log('✅ Redis connection initialized for rate limiting');
    } else {
      this.logger.warn('⚠️ No Redis URL provided, rate limiting disabled');
    }
  }

  /**
   * Check if we can make an API call based on daily quota
   */
  async canMakeApiCall(): Promise<{
    allowed: boolean;
    remaining: number;
    reason?: string;
  }> {
    if (!this.redis) {
      return { allowed: true, remaining: this.MAX_DAILY_CALLS };
    }

    try {
      const today = new Date().toISOString().split('T')[0];
      const quotaKey = `api_quota:${today}`;

      const currentCount = await this.redis.get(quotaKey);
      const callsToday = currentCount ? parseInt(currentCount) : 0;
      const remaining = this.MAX_DAILY_CALLS - callsToday;

      if (callsToday >= this.MAX_DAILY_CALLS) {
        this.logger.warn(
          `🚫 Daily API quota exceeded: ${callsToday}/${this.MAX_DAILY_CALLS}`,
        );
        return {
          allowed: false,
          remaining: 0,
          reason: `Daily quota exceeded (${callsToday}/${this.MAX_DAILY_CALLS})`,
        };
      }

      return { allowed: true, remaining };
    } catch (error) {
      this.logger.error('Error checking API quota', error);
      return { allowed: true, remaining: this.MAX_DAILY_CALLS };
    }
  }

  /**
   * Record an API call (increment daily counter)
   */
  async recordApiCall(
    endpoint: string,
    success: boolean = true,
  ): Promise<void> {
    if (!this.redis) return;

    try {
      const today = new Date().toISOString().split('T')[0];
      const quotaKey = `api_quota:${today}`;
      const logKey = `api_log:${today}`;

      // Increment daily counter
      const newCount = await this.redis.incr(quotaKey);
      await this.redis.expire(quotaKey, 24 * 60 * 60); // Expire at end of day

      // Log the call
      const logEntry: ApiCallLog = {
        timestamp: Date.now(),
        endpoint,
        success,
        cached: false,
      };

      await this.redis.lpush(logKey, JSON.stringify(logEntry));
      await this.redis.ltrim(logKey, 0, 99); // Keep last 100 calls
      await this.redis.expire(logKey, 24 * 60 * 60);

      this.logger.log(
        `📊 API call recorded: ${endpoint} (${newCount}/${this.MAX_DAILY_CALLS})`,
      );
    } catch (error) {
      this.logger.error('Error recording API call', error);
    }
  }

  /**
   * Get current daily quota status
   */
  async getDailyQuotaStatus(): Promise<DailyQuota> {
    const today = new Date().toISOString().split('T')[0];

    if (!this.redis) {
      return {
        date: today,
        totalCalls: 0,
        remainingCalls: this.MAX_DAILY_CALLS,
        cached: 0,
        failed: 0,
      };
    }

    try {
      const quotaKey = `api_quota:${today}`;
      const logKey = `api_log:${today}`;

      const totalCalls = parseInt((await this.redis.get(quotaKey)) || '0');
      const logs = await this.redis.lrange(logKey, 0, -1);

      let cached = 0;
      let failed = 0;

      logs.forEach((logStr) => {
        try {
          const log: ApiCallLog = JSON.parse(logStr);
          if (log.cached) cached++;
          if (!log.success) failed++;
        } catch (e) {
          // Ignore malformed log entries
        }
      });

      return {
        date: today,
        totalCalls,
        remainingCalls: Math.max(0, this.MAX_DAILY_CALLS - totalCalls),
        cached,
        failed,
      };
    } catch (error) {
      this.logger.error('Error getting quota status', error);
      return {
        date: today,
        totalCalls: 0,
        remainingCalls: this.MAX_DAILY_CALLS,
        cached: 0,
        failed: 0,
      };
    }
  }

  /**
   * Smart cache key generator with priority
   */
  generateCacheKey(
    type: keyof typeof this.CACHE_PRIORITIES,
    params?: string,
  ): string {
    const baseKey = `api_cache:${type}`;
    return params ? `${baseKey}:${params}` : baseKey;
  }

  /**
   * Get cache TTL based on data type priority
   */
  getCacheTTL(type: keyof typeof this.CACHE_PRIORITIES): number {
    return this.CACHE_PRIORITIES[type].ttl;
  }

  /**
   * Store data in cache with appropriate TTL
   */
  async setCachedData<T>(
    type: keyof typeof this.CACHE_PRIORITIES,
    data: T,
    params?: string,
  ): Promise<void> {
    if (!this.redis) return;

    try {
      const key = this.generateCacheKey(type, params);
      const ttl = this.getCacheTTL(type);

      await this.redis.setex(key, Math.floor(ttl / 1000), JSON.stringify(data));
      this.logger.debug(`💾 Cached ${type} data for ${ttl / 1000}s`);
    } catch (error) {
      this.logger.error(`Error caching ${type} data`, error);
    }
  }

  /**
   * Retrieve data from cache
   */
  async getCachedData<T>(
    type: keyof typeof this.CACHE_PRIORITIES,
    params?: string,
  ): Promise<T | null> {
    if (!this.redis) return null;

    try {
      const key = this.generateCacheKey(type, params);
      const cached = await this.redis.get(key);

      if (cached) {
        this.logger.debug(`💾 Cache hit for ${type}`);
        return JSON.parse(cached) as T;
      }

      return null;
    } catch (error) {
      this.logger.error(`Error retrieving cached ${type} data`, error);
      return null;
    }
  }

  /**
   * Clear all cached data (emergency use)
   */
  async clearAllCache(): Promise<void> {
    if (!this.redis) return;

    try {
      const keys = await this.redis.keys('api_cache:*');
      if (keys.length > 0) {
        await this.redis.del(...keys);
        this.logger.log(`🗑️ Cleared ${keys.length} cache entries`);
      }
    } catch (error) {
      this.logger.error('Error clearing cache', error);
    }
  }
}
