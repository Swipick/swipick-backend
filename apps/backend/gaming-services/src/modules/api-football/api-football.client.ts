import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { AxiosResponse } from 'axios';

// Interfaces
import { Fixture, LiveMatch } from './interfaces/fixture.interface';
import { Team, TeamStatistics } from './interfaces/team.interface';
// import { Player } from './interfaces/player.interface'; // Unused for now

// DTOs
import { GetFixturesDto } from './dto/fixture.dto';
import { GetTeamsDto } from './dto/team.dto';

export enum CircuitState {
  CLOSED = 'closed',
  OPEN = 'open',
  HALF_OPEN = 'half_open',
}

@Injectable()
export class ApiFootballClient {
  private readonly logger = new Logger(ApiFootballClient.name);
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly backupApiKey?: string;

  // Circuit breaker state
  private circuitState = CircuitState.CLOSED;
  private failureCount = 0;
  private lastFailureTime?: Date;
  private readonly failureThreshold = 5;
  private readonly resetTimeout = 30000; // 30 seconds

  // Rate limiting
  private dailyRequestCount = 0;
  private minuteRequestCount = 0;
  private lastDailyReset = new Date();
  private lastMinuteReset = new Date();

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    const config = this.configService.get('apiFootball');
    this.baseUrl = config.baseUrl;
    this.apiKey = config.apiKey;
    this.backupApiKey = config.backupApiKey;

    if (!this.apiKey) {
      throw new Error('API_FOOTBALL_KEY is required');
    }
  }

  async getFixtures(params: GetFixturesDto): Promise<Fixture[]> {
    const endpoint = '/fixtures';
    const response = await this.makeRequest<{ response: Fixture[] }>(
      endpoint,
      params,
    );
    return response.response;
  }

  async getLiveFixtures(): Promise<LiveMatch[]> {
    const endpoint = '/fixtures';
    const params = { live: 'all' };
    const response = await this.makeRequest<{ response: LiveMatch[] }>(
      endpoint,
      params,
    );
    return response.response;
  }

  async getTeams(params: GetTeamsDto): Promise<Team[]> {
    const endpoint = '/teams';
    const response = await this.makeRequest<{ response: Team[] }>(
      endpoint,
      params,
    );
    return response.response;
  }

  async getTeamStatistics(
    teamId: number,
    leagueId: number,
    season: number,
  ): Promise<TeamStatistics> {
    const endpoint = '/teams/statistics';
    const params = { team: teamId, league: leagueId, season };
    const response = await this.makeRequest<{ response: TeamStatistics }>(
      endpoint,
      params,
    );
    return response.response;
  }

  async getHeadToHead(team1Id: number, team2Id: number): Promise<Fixture[]> {
    const endpoint = '/fixtures';
    const params = { h2h: `${team1Id}-${team2Id}` };
    const response = await this.makeRequest<{ response: Fixture[] }>(
      endpoint,
      params,
    );
    return response.response;
  }

  async getApiStatus(): Promise<any> {
    const endpoint = '/status';
    const response = await this.makeRequest<any>(endpoint);
    return response;
  }

  private async makeRequest<T>(endpoint: string, params?: any): Promise<T> {
    return this.retryWithBackoff(async () => {
      return this.executeWithCircuitBreaker(async () => {
        this.checkRateLimit();

        const apiKey = this.getCurrentApiKey();
        const url = `${this.baseUrl}${endpoint}`;

        this.logger.debug(`Making request to ${url}`, { params });

        const response: AxiosResponse<T> = await firstValueFrom(
          this.httpService.get(url, {
            headers: {
              'x-apisports-key': apiKey,
              'x-rapidapi-host': 'v3.football.api-sports.io',
            },
            params,
            timeout: 10000,
          }),
        );

        this.recordRequest();
        return response.data;
      });
    });
  }

  private async executeWithCircuitBreaker<T>(
    operation: () => Promise<T>,
  ): Promise<T> {
    if (this.circuitState === CircuitState.OPEN) {
      if (this.shouldAttemptReset()) {
        this.circuitState = CircuitState.HALF_OPEN;
        this.logger.log('Circuit breaker state changed to HALF_OPEN');
      } else {
        throw new Error('Circuit breaker is OPEN - API requests blocked');
      }
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private async retryWithBackoff<T>(
    operation: () => Promise<T>,
    maxRetries = 3,
  ): Promise<T> {
    let lastError: any;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;

        if (attempt === maxRetries) {
          break;
        }

        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000); // Max 10s delay
        this.logger.warn(
          `Request failed, retrying in ${delay}ms (attempt ${attempt}/${maxRetries})`,
          error.message,
        );

        await this.sleep(delay);
      }
    }

    throw lastError;
  }

  private onSuccess(): void {
    this.failureCount = 0;
    if (this.circuitState === CircuitState.HALF_OPEN) {
      this.circuitState = CircuitState.CLOSED;
      this.logger.log('Circuit breaker state changed to CLOSED');
    }
  }

  private onFailure(): void {
    this.failureCount++;
    this.lastFailureTime = new Date();

    if (
      this.failureCount >= this.failureThreshold &&
      this.circuitState === CircuitState.CLOSED
    ) {
      this.circuitState = CircuitState.OPEN;
      this.logger.error(
        `Circuit breaker opened after ${this.failureCount} failures`,
      );
    }
  }

  private shouldAttemptReset(): boolean {
    if (!this.lastFailureTime) return false;
    return Date.now() - this.lastFailureTime.getTime() > this.resetTimeout;
  }

  private getCurrentApiKey(): string {
    // For MVP, just return the primary key
    // In the future, this could implement key rotation logic
    return this.apiKey;
  }

  private checkRateLimit(): void {
    this.resetCountersIfNeeded();

    const config = this.configService.get('apiFootball');
    const limits = config.rateLimits;

    if (this.dailyRequestCount >= limits.requestsPerDay) {
      throw new Error('Daily API quota exceeded');
    }

    if (this.minuteRequestCount >= limits.requestsPerMinute) {
      throw new Error('Minute API quota exceeded');
    }
  }

  private recordRequest(): void {
    this.dailyRequestCount++;
    this.minuteRequestCount++;

    this.logger.debug(
      `API request recorded. Daily: ${this.dailyRequestCount}, Minute: ${this.minuteRequestCount}`,
    );
  }

  private resetCountersIfNeeded(): void {
    const now = new Date();

    // Reset daily counter at midnight
    if (now.getDate() !== this.lastDailyReset.getDate()) {
      this.dailyRequestCount = 0;
      this.lastDailyReset = now;
      this.logger.log('Daily API quota counter reset');
    }

    // Reset minute counter every minute
    if (now.getMinutes() !== this.lastMinuteReset.getMinutes()) {
      this.minuteRequestCount = 0;
      this.lastMinuteReset = now;
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // Health check method
  async validateApiKey(): Promise<boolean> {
    try {
      await this.getApiStatus();
      return true;
    } catch (error) {
      this.logger.error('API key validation failed', error);
      return false;
    }
  }
}
