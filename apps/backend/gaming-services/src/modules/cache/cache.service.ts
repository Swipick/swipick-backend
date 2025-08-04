import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

export interface CacheOptions {
  ttl?: number;
  key?: string;
}

@Injectable()
export class CacheService {
  private readonly logger = new Logger(CacheService.name);
  private cache = new Map<string, { value: any; expires: number }>();

  constructor(private readonly configService: ConfigService) {}

  async get<T>(key: string): Promise<T | null> {
    const cached = this.cache.get(key);

    if (!cached) {
      return null;
    }

    if (Date.now() > cached.expires) {
      this.cache.delete(key);
      return null;
    }

    this.logger.debug(`Cache hit for key: ${key}`);
    return cached.value as T;
  }

  async set<T>(key: string, value: T, ttl: number = 300): Promise<void> {
    const expires = Date.now() + ttl * 1000;
    this.cache.set(key, { value, expires });
    this.logger.debug(`Cache set for key: ${key}, TTL: ${ttl}s`);
  }

  async del(key: string): Promise<void> {
    this.cache.delete(key);
    this.logger.debug(`Cache deleted for key: ${key}`);
  }

  async clear(): Promise<void> {
    this.cache.clear();
    this.logger.debug("Cache cleared");
  }

  async keys(pattern?: string): Promise<string[]> {
    const keys = Array.from(this.cache.keys());

    if (!pattern) {
      return keys;
    }

    // Simple pattern matching (supports * wildcard)
    const regex = new RegExp(pattern.replace(/\*/g, ".*"));
    return keys.filter((key) => regex.test(key));
  }
}
