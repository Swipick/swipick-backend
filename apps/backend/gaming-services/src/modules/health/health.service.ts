import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import axios from 'axios';

type CheckResult = 'healthy' | 'unhealthy' | 'not_configured';

const CHECK_TIMEOUT_MS = 3000;
// /status di API-Football non consuma quota, ma evitiamo comunque una
// chiamata esterna a ogni polling dell'health check di Railway.
const API_FOOTBALL_CACHE_MS = 5 * 60 * 1000;

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);
  private apiFootballCache: { result: CheckResult; checkedAt: number } | null =
    null;

  constructor(
    private readonly configService: ConfigService,
    private readonly dataSource: DataSource,
  ) {}

  async getHealthStatus() {
    const [database, redis, apiFootball] = await Promise.all([
      this.checkDatabase(),
      this.checkRedis(),
      this.checkApiFootball(),
    ]);

    const unhealthy = [database, redis, apiFootball].includes('unhealthy');

    const status = {
      status: unhealthy ? 'degraded' : 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: this.configService.get('NODE_ENV'),
      version: '1.0.0',
      services: {
        api: 'healthy' as CheckResult,
        database,
        redis,
        apiFootball,
      },
    };

    this.logger.debug('Health check requested', status);
    return status;
  }

  async getReadinessStatus() {
    const [database, redis] = await Promise.all([
      this.checkDatabase(),
      this.checkRedis(),
    ]);

    return {
      // Solo il database è bloccante per servire traffico: redis è usato
      // unicamente dal rate limiting delle chiamate API esterne.
      status: database === 'healthy' ? 'ready' : 'not_ready',
      timestamp: new Date().toISOString(),
      checks: { database, redis },
    };
  }

  async getLivenessStatus() {
    return {
      status: 'alive',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    };
  }

  private async withTimeout<T>(promise: Promise<T>): Promise<T> {
    let timer: NodeJS.Timeout;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(
        () => reject(new Error(`health check timeout (${CHECK_TIMEOUT_MS}ms)`)),
        CHECK_TIMEOUT_MS,
      );
    });
    try {
      return await Promise.race([promise, timeout]);
    } finally {
      clearTimeout(timer!);
    }
  }

  private async checkDatabase(): Promise<CheckResult> {
    try {
      await this.withTimeout(this.dataSource.query('SELECT 1'));
      return 'healthy';
    } catch (error) {
      this.logger.error('Database health check failed', error);
      return 'unhealthy';
    }
  }

  private async checkRedis(): Promise<CheckResult> {
    const redisUrl = this.configService.get<string>('REDIS_URL');
    if (!redisUrl) {
      return 'not_configured';
    }

    try {
      // Import lazy: ioredis è usato solo dal rate limiting; l'health check
      // apre una connessione usa-e-getta con timeout stretto.
      const { Redis } = await import('ioredis');
      const client = new Redis(redisUrl, {
        lazyConnect: true,
        connectTimeout: CHECK_TIMEOUT_MS,
        maxRetriesPerRequest: 0,
      });
      try {
        await this.withTimeout(client.connect().then(() => client.ping()));
        return 'healthy';
      } finally {
        client.disconnect();
      }
    } catch (error) {
      this.logger.error('Redis health check failed', error);
      return 'unhealthy';
    }
  }

  private async checkApiFootball(): Promise<CheckResult> {
    const now = Date.now();
    if (
      this.apiFootballCache &&
      now - this.apiFootballCache.checkedAt < API_FOOTBALL_CACHE_MS
    ) {
      return this.apiFootballCache.result;
    }

    const apiKey = this.configService.get<string>('API_FOOTBALL_KEY');
    if (!apiKey) {
      return 'not_configured';
    }

    // Stessa env var e default del client reale (api-football.config.ts).
    // NB: API_FOOTBALL_URL (gateway RapidAPI) presente in .env è config morta
    // non usata dal client — non leggerla qui.
    const baseUrl = this.configService.get<string>(
      'API_FOOTBALL_BASE_URL',
      'https://v3.football.api-sports.io',
    );

    let result: CheckResult;
    try {
      // Stessa convenzione header del resto del codebase (chiave RapidAPI)
      const response = await axios.get(`${baseUrl}/status`, {
        headers: {
          'X-RapidAPI-Key': apiKey,
          'X-RapidAPI-Host': 'v3.football.api-sports.io',
        },
        timeout: CHECK_TIMEOUT_MS,
      });
      result = response.status === 200 ? 'healthy' : 'unhealthy';
    } catch (error) {
      this.logger.error('API-FOOTBALL health check failed', error);
      result = 'unhealthy';
    }

    this.apiFootballCache = { result, checkedAt: now };
    return result;
  }
}
