import { Injectable, Logger } from '@nestjs/common';
import { ApiFootballService } from '../api-football/api-football.service';
import {
  Fixture,
  LiveMatch,
} from '../api-football/interfaces/fixture.interface';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number; // Time to live in milliseconds
}

@Injectable()
export class FixturesService {
  private readonly logger = new Logger(FixturesService.name);
  private readonly cache = new Map<string, CacheEntry<any>>();
  private readonly LIVE_MATCHES_CACHE_TTL = 2 * 60 * 1000; // 2 minutes
  private readonly DAILY_FIXTURES_CACHE_TTL = 15 * 60 * 1000; // 15 minutes
  private readonly CACHE_KEY_LIVE_MATCHES = 'live_matches';

  constructor(private readonly apiFootballService: ApiFootballService) {}

  async syncFixturesForDate(date: string): Promise<Fixture[]> {
    try {
      const cacheKey = `daily_fixtures_${date}`;

      // Check cache first
      const cached = this.getCachedData<Fixture[]>(cacheKey);
      if (cached) {
        this.logger.debug(
          `Retrieved ${cached.length} fixtures for ${date} from cache`,
        );
        return cached;
      }

      // If not in cache, fetch from API
      this.logger.debug(`Cache miss, fetching fixtures for ${date} from API`);
      const fixtures = await this.apiFootballService.getDailyFixtures(date);

      // Cache the result
      this.setCachedData(cacheKey, fixtures, this.DAILY_FIXTURES_CACHE_TTL);

      this.logger.log(
        `Synced ${fixtures.length} fixtures for ${date} and cached`,
      );
      return fixtures;
    } catch (error) {
      this.logger.error(`Failed to sync fixtures for ${date}`, error);

      // Try to return stale cache data if API fails
      const cacheKey = `daily_fixtures_${date}`;
      const staleCache = this.getStaleCache<Fixture[]>(cacheKey);
      if (staleCache) {
        this.logger.warn(
          `API failed, returning ${staleCache.length} stale cached fixtures for ${date}`,
        );
        return staleCache;
      }

      throw error;
    }
  }

  async getLiveMatches(): Promise<LiveMatch[]> {
    try {
      // Check cache first
      const cached = this.getCachedData<LiveMatch[]>(
        this.CACHE_KEY_LIVE_MATCHES,
      );
      if (cached) {
        this.logger.debug(`Retrieved ${cached.length} live matches from cache`);
        return cached;
      }

      // If not in cache or expired, fetch from API
      this.logger.debug('Cache miss, fetching live matches from API');
      const liveMatches = await this.apiFootballService.getLiveMatches();

      // Cache the result
      this.setCachedData(
        this.CACHE_KEY_LIVE_MATCHES,
        liveMatches,
        this.LIVE_MATCHES_CACHE_TTL,
      );

      this.logger.debug(
        `Retrieved ${liveMatches.length} live matches from API and cached`,
      );
      return liveMatches;
    } catch (error) {
      this.logger.error('Failed to get live matches', error);

      // Try to return stale cache data if API fails
      const staleCache = this.getStaleCache<LiveMatch[]>(
        this.CACHE_KEY_LIVE_MATCHES,
      );
      if (staleCache) {
        this.logger.warn(
          `API failed, returning ${staleCache.length} stale cached live matches`,
        );
        return staleCache;
      }

      throw error;
    }
  }

  private getCachedData<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    const now = Date.now();
    if (now - entry.timestamp > entry.ttl) {
      // Cache expired
      this.cache.delete(key);
      return null;
    }

    return entry.data as T;
  }

  private setCachedData<T>(key: string, data: T, ttl: number): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl,
    });
  }

  private getStaleCache<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    return entry.data as T;
  }

  async getFixtureById(fixtureId: number): Promise<Fixture | null> {
    try {
      // For now, this is a placeholder implementation
      // In a full implementation, this would check the database first
      // then fallback to API if needed
      const fixtures = await this.apiFootballService.getDailyFixtures(
        new Date().toISOString().split('T')[0],
      );

      return fixtures.find((f) => f.id === fixtureId) || null;
    } catch (error) {
      this.logger.error(`Failed to get fixture ${fixtureId}`, error);
      return null;
    }
  }

  async getFixturesForGameweek(
    gameweek: number,
    date?: Date,
  ): Promise<Fixture[]> {
    try {
      const targetDate = date || new Date();
      const dateString = targetDate.toISOString().split('T')[0];

      const fixtures =
        await this.apiFootballService.getDailyFixtures(dateString);

      // Filter by gameweek if available in fixture data
      return fixtures.filter((fixture) =>
        fixture.league.round.includes(gameweek.toString()),
      );
    } catch (error) {
      this.logger.error(
        `Failed to get fixtures for gameweek ${gameweek}`,
        error,
      );
      throw error;
    }
  }

  async getUpcomingSerieAFixtures(days: number = 7): Promise<Fixture[]> {
    try {
      const cacheKey = `serie_a_upcoming_${days}_days`;

      // Check cache first
      const cached = this.getCachedData<Fixture[]>(cacheKey);
      if (cached) {
        this.logger.debug(
          `Retrieved ${cached.length} upcoming Serie A fixtures from cache`,
        );
        return cached;
      }

      // For development/demo purposes, return mock Serie A 2025/2026 fixtures
      // First matchday is August 24, 2025
      const mockSerieAFixtures: Fixture[] = [
        {
          id: 1001,
          timezone: 'Europe/Rome',
          date: '2025-08-24T15:00:00Z',
          timestamp: new Date('2025-08-24T15:00:00Z').getTime() / 1000,
          venue: { id: 1, name: 'Gewiss Stadium', city: 'Bergamo' },
          status: { long: 'Not Started', short: 'NS' },
          league: {
            id: 135,
            name: 'Serie A',
            country: 'Italy',
            logo: 'https://media.api-sports.io/football/leagues/135.png',
            season: 2025,
            round: 'Regular Season - 1',
          },
          teams: {
            home: {
              id: 499,
              name: 'Atalanta',
              logo: 'https://media.api-sports.io/football/teams/499.png',
            },
            away: {
              id: 1150,
              name: 'Pisa',
              logo: 'https://media.api-sports.io/football/teams/1150.png',
            },
          },
          goals: { home: 0, away: 0 },
          score: {
            halftime: { home: 0, away: 0 },
            fulltime: { home: 0, away: 0 },
          },
        },
        {
          id: 1002,
          timezone: 'Europe/Rome',
          date: '2025-08-24T18:00:00Z',
          timestamp: new Date('2025-08-24T18:00:00Z').getTime() / 1000,
          venue: { id: 2, name: 'Unipol Domus', city: 'Cagliari' },
          status: { long: 'Not Started', short: 'NS' },
          league: {
            id: 135,
            name: 'Serie A',
            country: 'Italy',
            logo: 'https://media.api-sports.io/football/leagues/135.png',
            season: 2025,
            round: 'Regular Season - 1',
          },
          teams: {
            home: {
              id: 490,
              name: 'Cagliari',
              logo: 'https://media.api-sports.io/football/teams/490.png',
            },
            away: {
              id: 502,
              name: 'Fiorentina',
              logo: 'https://media.api-sports.io/football/teams/502.png',
            },
          },
          goals: { home: 0, away: 0 },
          score: {
            halftime: { home: 0, away: 0 },
            fulltime: { home: 0, away: 0 },
          },
        },
        {
          id: 1003,
          timezone: 'Europe/Rome',
          date: '2025-08-24T20:45:00Z',
          timestamp: new Date('2025-08-24T20:45:00Z').getTime() / 1000,
          venue: { id: 3, name: 'Stadio Giuseppe Sinigaglia', city: 'Como' },
          status: { long: 'Not Started', short: 'NS' },
          league: {
            id: 135,
            name: 'Serie A',
            country: 'Italy',
            logo: 'https://media.api-sports.io/football/leagues/135.png',
            season: 2025,
            round: 'Regular Season - 1',
          },
          teams: {
            home: {
              id: 1579,
              name: 'Como',
              logo: 'https://media.api-sports.io/football/teams/1579.png',
            },
            away: {
              id: 487,
              name: 'Lazio',
              logo: 'https://media.api-sports.io/football/teams/487.png',
            },
          },
          goals: { home: 0, away: 0 },
          score: {
            halftime: { home: 0, away: 0 },
            fulltime: { home: 0, away: 0 },
          },
        },
        {
          id: 1004,
          timezone: 'Europe/Rome',
          date: '2025-08-25T15:00:00Z',
          timestamp: new Date('2025-08-25T15:00:00Z').getTime() / 1000,
          venue: { id: 4, name: 'Stadio Luigi Ferraris', city: 'Genova' },
          status: { long: 'Not Started', short: 'NS' },
          league: {
            id: 135,
            name: 'Serie A',
            country: 'Italy',
            logo: 'https://media.api-sports.io/football/leagues/135.png',
            season: 2025,
            round: 'Regular Season - 1',
          },
          teams: {
            home: {
              id: 488,
              name: 'Genoa',
              logo: 'https://media.api-sports.io/football/teams/488.png',
            },
            away: {
              id: 867,
              name: 'Lecce',
              logo: 'https://media.api-sports.io/football/teams/867.png',
            },
          },
          goals: { home: 0, away: 0 },
          score: {
            halftime: { home: 0, away: 0 },
            fulltime: { home: 0, away: 0 },
          },
        },
        {
          id: 1005,
          timezone: 'Europe/Rome',
          date: '2025-08-25T18:00:00Z',
          timestamp: new Date('2025-08-25T18:00:00Z').getTime() / 1000,
          venue: { id: 5, name: 'San Siro', city: 'Milano' },
          status: { long: 'Not Started', short: 'NS' },
          league: {
            id: 135,
            name: 'Serie A',
            country: 'Italy',
            logo: 'https://media.api-sports.io/football/leagues/135.png',
            season: 2025,
            round: 'Regular Season - 1',
          },
          teams: {
            home: {
              id: 505,
              name: 'Inter',
              logo: 'https://media.api-sports.io/football/teams/505.png',
            },
            away: {
              id: 503,
              name: 'Torino',
              logo: 'https://media.api-sports.io/football/teams/503.png',
            },
          },
          goals: { home: 0, away: 0 },
          score: {
            halftime: { home: 0, away: 0 },
            fulltime: { home: 0, away: 0 },
          },
        },
        {
          id: 1006,
          timezone: 'Europe/Rome',
          date: '2025-08-25T20:45:00Z',
          timestamp: new Date('2025-08-25T20:45:00Z').getTime() / 1000,
          venue: { id: 6, name: 'Allianz Stadium', city: 'Torino' },
          status: { long: 'Not Started', short: 'NS' },
          league: {
            id: 135,
            name: 'Serie A',
            country: 'Italy',
            logo: 'https://media.api-sports.io/football/leagues/135.png',
            season: 2025,
            round: 'Regular Season - 1',
          },
          teams: {
            home: {
              id: 496,
              name: 'Juventus',
              logo: 'https://media.api-sports.io/football/teams/496.png',
            },
            away: {
              id: 1150,
              name: 'Parma',
              logo: 'https://media.api-sports.io/football/teams/1150.png',
            },
          },
          goals: { home: 0, away: 0 },
          score: {
            halftime: { home: 0, away: 0 },
            fulltime: { home: 0, away: 0 },
          },
        },
        {
          id: 1007,
          timezone: 'Europe/Rome',
          date: '2025-08-26T15:00:00Z',
          timestamp: new Date('2025-08-26T15:00:00Z').getTime() / 1000,
          venue: { id: 7, name: 'San Siro', city: 'Milano' },
          status: { long: 'Not Started', short: 'NS' },
          league: {
            id: 135,
            name: 'Serie A',
            country: 'Italy',
            logo: 'https://media.api-sports.io/football/leagues/135.png',
            season: 2025,
            round: 'Regular Season - 1',
          },
          teams: {
            home: {
              id: 489,
              name: 'Milan',
              logo: 'https://media.api-sports.io/football/teams/489.png',
            },
            away: {
              id: 1150,
              name: 'Cremonese',
              logo: 'https://media.api-sports.io/football/teams/1150.png',
            },
          },
          goals: { home: 0, away: 0 },
          score: {
            halftime: { home: 0, away: 0 },
            fulltime: { home: 0, away: 0 },
          },
        },
        {
          id: 1008,
          timezone: 'Europe/Rome',
          date: '2025-08-26T18:00:00Z',
          timestamp: new Date('2025-08-26T18:00:00Z').getTime() / 1000,
          venue: { id: 8, name: 'Stadio Olimpico', city: 'Roma' },
          status: { long: 'Not Started', short: 'NS' },
          league: {
            id: 135,
            name: 'Serie A',
            country: 'Italy',
            logo: 'https://media.api-sports.io/football/leagues/135.png',
            season: 2025,
            round: 'Regular Season - 1',
          },
          teams: {
            home: {
              id: 497,
              name: 'Roma',
              logo: 'https://media.api-sports.io/football/teams/497.png',
            },
            away: {
              id: 500,
              name: 'Bologna',
              logo: 'https://media.api-sports.io/football/teams/500.png',
            },
          },
          goals: { home: 0, away: 0 },
          score: {
            halftime: { home: 0, away: 0 },
            fulltime: { home: 0, away: 0 },
          },
        },
        {
          id: 1009,
          timezone: 'Europe/Rome',
          date: '2025-08-26T20:45:00Z',
          timestamp: new Date('2025-08-26T20:45:00Z').getTime() / 1000,
          venue: { id: 9, name: 'Mapei Stadium', city: 'Reggio Emilia' },
          status: { long: 'Not Started', short: 'NS' },
          league: {
            id: 135,
            name: 'Serie A',
            country: 'Italy',
            logo: 'https://media.api-sports.io/football/leagues/135.png',
            season: 2025,
            round: 'Regular Season - 1',
          },
          teams: {
            home: {
              id: 1150,
              name: 'Sassuolo',
              logo: 'https://media.api-sports.io/football/teams/1150.png',
            },
            away: {
              id: 492,
              name: 'Napoli',
              logo: 'https://media.api-sports.io/football/teams/492.png',
            },
          },
          goals: { home: 0, away: 0 },
          score: {
            halftime: { home: 0, away: 0 },
            fulltime: { home: 0, away: 0 },
          },
        },
      ];

      // Take only the first 10 matches (we have 9 for the first matchday)
      const first10Fixtures = mockSerieAFixtures.slice(0, 10);

      // Cache the result for 30 minutes
      this.setCachedData(cacheKey, first10Fixtures, 30 * 60 * 1000);

      this.logger.log(
        `Retrieved ${first10Fixtures.length} upcoming Serie A fixtures starting from August 24th (mock data)`,
      );
      return first10Fixtures;
    } catch (error) {
      this.logger.error(`Failed to get upcoming Serie A fixtures`, error);

      // Try to return stale cache data if API fails
      const cacheKey = `serie_a_upcoming_${days}_days`;
      const staleCache = this.getStaleCache<Fixture[]>(cacheKey);
      if (staleCache) {
        this.logger.warn(
          `API failed, returning ${staleCache.length} stale cached Serie A fixtures`,
        );
        return staleCache;
      }

      throw error;
    }
  }
}
