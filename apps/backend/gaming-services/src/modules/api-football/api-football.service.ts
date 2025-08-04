import { Injectable, Logger } from '@nestjs/common';
import { ApiFootballClient } from './api-football.client';
import { CacheService } from '../cache/cache.service';

// Interfaces
import { Fixture, LiveMatch } from './interfaces/fixture.interface';
import { Team, TeamStatistics } from './interfaces/team.interface';

// DTOs
// import { GetFixturesDto } from './dto/fixture.dto'; // Unused for now
import { GetTeamsDto } from './dto/team.dto';

@Injectable()
export class ApiFootballService {
  private readonly logger = new Logger(ApiFootballService.name);

  constructor(
    private readonly apiFootballClient: ApiFootballClient,
    private readonly cacheService: CacheService,
  ) {}

  async getDailyFixtures(date: string): Promise<Fixture[]> {
    const cacheKey = `fixtures:daily:${date}`;

    // Try cache first
    const cached = await this.cacheService.get<Fixture[]>(cacheKey);
    if (cached) {
      this.logger.debug(`Cache hit for daily fixtures: ${date}`);
      return cached;
    }

    // Fetch from API
    const fixtures = await this.apiFootballClient.getFixtures({ date });

    // Cache for 24 hours
    await this.cacheService.set(cacheKey, fixtures, 24 * 60 * 60);

    this.logger.log(`Fetched ${fixtures.length} fixtures for ${date}`);
    return fixtures;
  }

  async getLiveMatches(): Promise<LiveMatch[]> {
    const cacheKey = 'fixtures:live';

    // Try cache first (short TTL)
    const cached = await this.cacheService.get<LiveMatch[]>(cacheKey);
    if (cached) {
      return cached;
    }

    // Fetch from API
    const liveMatches = await this.apiFootballClient.getLiveFixtures();

    // Cache for 15 seconds
    await this.cacheService.set(cacheKey, liveMatches, 15);

    this.logger.log(`Fetched ${liveMatches.length} live matches`);
    return liveMatches;
  }

  async getTeams(params: GetTeamsDto): Promise<Team[]> {
    const cacheKey = `teams:${JSON.stringify(params)}`;

    // Try cache first
    const cached = await this.cacheService.get<Team[]>(cacheKey);
    if (cached) {
      return cached;
    }

    // Fetch from API
    const teams = await this.apiFootballClient.getTeams(params);

    // Cache for 7 days
    await this.cacheService.set(cacheKey, teams, 7 * 24 * 60 * 60);

    this.logger.log(`Fetched ${teams.length} teams`);
    return teams;
  }

  async getTeamStatistics(
    teamId: number,
    leagueId: number,
    season: number,
  ): Promise<TeamStatistics> {
    const cacheKey = `team-stats:${teamId}:${leagueId}:${season}`;

    // Try cache first
    const cached = await this.cacheService.get<TeamStatistics>(cacheKey);
    if (cached) {
      return cached;
    }

    // Fetch from API
    const stats = await this.apiFootballClient.getTeamStatistics(
      teamId,
      leagueId,
      season,
    );

    // Cache for 24 hours
    await this.cacheService.set(cacheKey, stats, 24 * 60 * 60);

    this.logger.log(`Fetched team statistics for team ${teamId}`);
    return stats;
  }

  async getHeadToHead(team1Id: number, team2Id: number): Promise<Fixture[]> {
    const cacheKey = `h2h:${team1Id}:${team2Id}`;

    // Try cache first
    const cached = await this.cacheService.get<Fixture[]>(cacheKey);
    if (cached) {
      return cached;
    }

    // Fetch from API
    const fixtures = await this.apiFootballClient.getHeadToHead(
      team1Id,
      team2Id,
    );

    // Cache for 7 days
    await this.cacheService.set(cacheKey, fixtures, 7 * 24 * 60 * 60);

    this.logger.log(
      `Fetched ${fixtures.length} head-to-head fixtures for teams ${team1Id} vs ${team2Id}`,
    );
    return fixtures;
  }

  async validateApiConnection(): Promise<boolean> {
    try {
      return await this.apiFootballClient.validateApiKey();
    } catch (error) {
      this.logger.error('API connection validation failed', error);
      return false;
    }
  }

  async clearCache(pattern?: string): Promise<void> {
    if (pattern) {
      const keys = await this.cacheService.keys(pattern);
      for (const key of keys) {
        await this.cacheService.del(key);
      }
      this.logger.log(`Cleared cache for pattern: ${pattern}`);
    } else {
      await this.cacheService.clear();
      this.logger.log('Cleared all cache');
    }
  }
}
