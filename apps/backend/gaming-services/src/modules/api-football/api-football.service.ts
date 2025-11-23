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

    // Fetch from API - filter for Serie A (league ID 135)
    const fixtures = await this.apiFootballClient.getFixtures({
      date,
      league: 135,
      season: 2025,
    });

    // Cache for 2 minutes (matches polling frequency for real-time score updates)
    await this.cacheService.set(cacheKey, fixtures, 2 * 60);

    this.logger.log(`Fetched ${fixtures.length} Serie A fixtures for ${date}`);
    return fixtures;
  }

  async getLiveMatches(): Promise<LiveMatch[]> {
    const cacheKey = 'fixtures:live:serie-a';

    // Try cache first (short TTL)
    const cached = await this.cacheService.get<LiveMatch[]>(cacheKey);
    if (cached) {
      return cached;
    }

    // Fetch from API
    const allLiveMatches = await this.apiFootballClient.getLiveFixtures();

    // Filter for Serie A only (league ID 135)
    const serieALiveMatches = allLiveMatches.filter(
      (match) => match.league?.id === 135,
    );

    // Cache for 15 seconds
    await this.cacheService.set(cacheKey, serieALiveMatches, 15);

    this.logger.log(
      `Fetched ${serieALiveMatches.length} Serie A live matches out of ${allLiveMatches.length} total`,
    );
    return serieALiveMatches;
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

  async getFixtures(params: {
    league?: number;
    season?: number;
    date?: string;
  }): Promise<Fixture[]> {
    this.logger.log(
      `Calling API-Football getFixtures with params: ${JSON.stringify(params)}`,
    );
    try {
      const fixtures = await this.apiFootballClient.getFixtures(params);
      this.logger.log(`API-Football returned ${fixtures.length} fixtures`);
      return fixtures;
    } catch (error) {
      this.logger.error('Failed to fetch fixtures from API-Football', error);
      throw error;
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
