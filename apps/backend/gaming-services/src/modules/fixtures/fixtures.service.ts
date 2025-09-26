import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ApiFootballService } from '../api-football/api-football.service';
import { ApiRateLimitService } from '../api-rate-limit/api-rate-limit.service';
import { DatabasePersistenceService } from '../database-persistence/database-persistence.service';
import {
  Fixture,
  LiveMatch,
} from '../api-football/interfaces/fixture.interface';
import { Fixture as FixtureEntity } from '../../entities/fixture.entity';

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

  constructor(
    @InjectRepository(FixtureEntity)
    private readonly fixtureRepository: Repository<FixtureEntity>,
    private readonly apiFootballService: ApiFootballService,
    private readonly rateLimitService: ApiRateLimitService,
    private readonly dbPersistenceService: DatabasePersistenceService,
  ) {}

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

  /**
   * Get fixtures by week number from local database
   */
  async getFixturesByWeek(weekNumber: number): Promise<FixtureEntity[]> {
    try {
      const fixtures = await this.fixtureRepository.find({
        where: { week: weekNumber },
        order: { match_date: 'ASC' },
      });

      this.logger.debug(
        `Retrieved ${fixtures.length} fixtures for week ${weekNumber} from database`,
      );

      return fixtures;
    } catch (error) {
      this.logger.error(`Failed to get fixtures for week ${weekNumber}`, error);
      throw error;
    }
  }

  /**
   * Get date range for a specific week from database fixtures
   */
  async getWeekDateRange(weekNumber: number): Promise<{
    week: number;
    startDate: string;
    endDate: string;
    startDateFormatted: string;
    endDateFormatted: string;
    fixtureCount: number;
  } | null> {
    try {
      const fixtures = await this.fixtureRepository.find({
        where: { week: weekNumber },
        order: { match_date: 'ASC' },
      });

      if (fixtures.length === 0) {
        this.logger.debug(`No fixtures found for week ${weekNumber}`);
        return null;
      }

      // Get min and max dates
      const dates = fixtures.map((f) => new Date(f.match_date));
      const startDate = new Date(Math.min(...dates.map((d) => d.getTime())));
      const endDate = new Date(Math.max(...dates.map((d) => d.getTime())));

      // Format dates for Italian display (dd/mm)
      const formatItalian = (date: Date) => {
        return date.toLocaleDateString('it-IT', {
          day: '2-digit',
          month: '2-digit',
          timeZone: 'Europe/Rome',
        });
      };

      this.logger.debug(
        `Week ${weekNumber} date range: ${startDate.toISOString()} to ${endDate.toISOString()}`,
      );

      return {
        week: weekNumber,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        startDateFormatted: formatItalian(startDate),
        endDateFormatted: formatItalian(endDate),
        fixtureCount: fixtures.length,
      };
    } catch (error) {
      this.logger.error(
        `Failed to get date range for week ${weekNumber}`,
        error,
      );
      throw error;
    }
  }

  async getUpcomingSerieAFixtures(days: number = 7): Promise<Fixture[]> {
    try {
      // 1. Check Redis cache first (fastest)
      const cachedFixtures = await this.rateLimitService.getCachedData<
        Fixture[]
      >('SERIE_A_FIXTURES', `days_${days}`);
      if (cachedFixtures && cachedFixtures.length > 0) {
        this.logger.log(
          `⚡ Retrieved ${cachedFixtures.length} Serie A fixtures from Redis cache`,
        );
        await this.dbPersistenceService.logApiUsage(
          '/api/fixtures/upcoming/serie-a',
          true,
          true,
        );
        return cachedFixtures;
      }

      // 2. Check database persistence (medium speed)
      const persistedFixtures =
        await this.dbPersistenceService.getPersistedSerieAFixtures(2025, days);
      if (persistedFixtures && persistedFixtures.length > 0) {
        this.logger.log(
          `📦 Retrieved ${persistedFixtures.length} Serie A fixtures from database`,
        );
        // Cache in Redis for next time
        await this.rateLimitService.setCachedData(
          'SERIE_A_FIXTURES',
          persistedFixtures,
          `days_${days}`,
        );
        await this.dbPersistenceService.logApiUsage(
          '/api/fixtures/upcoming/serie-a',
          true,
          true,
        );
        return persistedFixtures;
      }

      // 3. Check API quota before making external call
      const quotaCheck = await this.rateLimitService.canMakeApiCall();
      if (!quotaCheck.allowed) {
        this.logger.warn(
          `🚫 API quota exceeded, serving mock data. ${quotaCheck.reason}`,
        );
        return this.getSerieAMockData();
      }

      // 4. Try to fetch from external API (slowest, uses quota)
      this.logger.log(
        `🌐 Attempting to fetch Serie A fixtures from API (${quotaCheck.remaining} calls remaining)`,
      );

      try {
        // Temporarily enable real API calls for testing
        this.logger.log(
          '🔄 Making real API call to test API-Football service...',
        );
        const fixtures = await this.apiFootballService.getDailyFixtures(
          new Date().toISOString().split('T')[0],
        );

        this.logger.log(`📊 Real API returned ${fixtures.length} fixtures`);

        // If real API returns data, use it, otherwise fall back to mock
        const finalFixtures =
          fixtures.length > 0 ? fixtures : this.getSerieAMockData();

        // Record the API call (even though it's mock data for now)
        await this.rateLimitService.recordApiCall(
          '/api/fixtures/upcoming/serie-a',
          true,
        );
        await this.dbPersistenceService.logApiUsage(
          '/api/fixtures/upcoming/serie-a',
          true,
          false,
        );

        // Store in both caches
        await this.rateLimitService.setCachedData(
          'SERIE_A_FIXTURES',
          finalFixtures,
          `days_${days}`,
        );
        await this.dbPersistenceService.persistSerieAFixtures(
          finalFixtures,
          2025,
        );

        this.logger.log(
          `✅ Retrieved and cached ${finalFixtures.length} Serie A fixtures from API`,
        );
        return finalFixtures;
      } catch (apiError) {
        this.logger.error(
          'External API call failed, serving mock data',
          apiError,
        );
        await this.rateLimitService.recordApiCall(
          '/api/fixtures/upcoming/serie-a',
          false,
        );
        await this.dbPersistenceService.logApiUsage(
          '/api/fixtures/upcoming/serie-a',
          false,
          false,
        );
        return this.getSerieAMockData();
      }
    } catch (error) {
      this.logger.error(`Failed to get upcoming Serie A fixtures`, error);
      // Fallback to mock data
      return this.getSerieAMockData();
    }
  }

  /**
   * Get next real fixtures from the actual persisted fixtures table (not the cache/mock path).
   * Returns upcoming SCHEDULED/LIVE fixtures ordered by date, limited (default 10).
   * Optionally a fromDate (ISO date) can be provided; otherwise now is used.
   */
  async getNextRealFixtures(limit: number = 10, fromDate?: string) {
    try {
      const start = fromDate ? new Date(fromDate) : new Date();
      // Query TypeORM repository for upcoming fixtures (scheduled or live but not finished)
      const qb = this.fixtureRepository
        .createQueryBuilder('fx')
        .where('fx.match_date >= :start', { start })
        .andWhere('fx.status IN (:...statuses)', {
          statuses: ['SCHEDULED', 'LIVE'],
        })
        .orderBy('fx.match_date', 'ASC')
        .limit(limit);

      const entities = await qb.getMany();

      // If none in future, fallback to last finished (still return something) but flag empty state
      if (entities.length === 0) {
        const recent = await this.fixtureRepository
          .createQueryBuilder('fx')
          .orderBy('fx.match_date', 'DESC')
          .limit(Math.min(5, limit))
          .getMany();
        return {
          success: true,
          fromCache: false,
          source: 'fixtures_table',
          fixtures: recent.map((e) => this.mapEntityToApiFixture(e)),
          note: 'No future fixtures found; returning last finished fixtures',
        };
      }

      return {
        success: true,
        fromCache: false,
        source: 'fixtures_table',
        fixtures: entities.map((e) => this.mapEntityToApiFixture(e)),
        detectedWeek: entities[0]?.week || null,
      };
    } catch (error) {
      this.logger.error('Failed to get next real fixtures', error);
      return { success: false, error: 'FAILED_NEXT_FIXTURES' };
    }
  }

  /** Map DB fixture entity into the public (subset) Fixture API shape the frontend already expects */
  private mapEntityToApiFixture(e: FixtureEntity): Fixture {
    // Minimal mapping; fill league.round as Regular Season - {week}
    return {
      id:
        Number(e.external_api_id) ||
        undefined ||
        Date.parse(e.match_date.toISOString()),
      timezone: 'Europe/Rome',
      date: e.match_date.toISOString(),
      timestamp: Math.floor(e.match_date.getTime() / 1000),
      venue: { id: undefined, name: e.stadium || 'Stadio', city: '' },
      status: { long: e.status, short: this.mapDbStatusToApiShort(e.status) },
      league: {
        id: 135,
        name: 'Serie A',
        country: 'Italy',
        logo: 'https://media.api-sports.io/football/leagues/135.png',
        season: new Date().getFullYear(),
        round: `Regular Season - ${e.week}`,
      },
      teams: {
        home: { id: undefined, name: e.home_team, logo: '' },
        away: { id: undefined, name: e.away_team, logo: '' },
      },
      goals: { home: e.home_score ?? 0, away: e.away_score ?? 0 },
      score: {
        halftime: { home: e.home_score ?? 0, away: e.away_score ?? 0 },
        fulltime: { home: e.home_score ?? 0, away: e.away_score ?? 0 },
      },
    } as unknown as Fixture;
  }

  private mapDbStatusToApiShort(status: string): string {
    const map: Record<string, string> = {
      SCHEDULED: 'NS',
      LIVE: '1H',
      FINISHED: 'FT',
      POSTPONED: 'PST',
      CANCELLED: 'CANC',
    };
    return map[status] || 'NS';
  }

  /**
   * Get Serie A mock data as fallback
   */
  private getSerieAMockData(): Fixture[] {
    return [
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
  }

  /**
   * Sync all Serie A 2025 fixtures in bulk from API-Football using single API call
   */
  async syncAllSeasonFixtures(season: number = 2025): Promise<{
    success: boolean;
    message: string;
    syncedCount: number;
    existingCount: number;
  }> {
    try {
      this.logger.log(`🚀 Starting bulk Serie A ${season} fixtures sync...`);

      // Check existing fixtures count
      const existingCount = await this.fixtureRepository.count();
      this.logger.log(`📊 Found ${existingCount} existing fixtures in database`);

      if (existingCount > 300) {
        return {
          success: false,
          message: `Database already contains ${existingCount} fixtures. Use force parameter to clear and resync.`,
          syncedCount: 0,
          existingCount,
        };
      }

      // Clear existing fixtures if any exist
      if (existingCount > 0) {
        this.logger.log('🗑️  Clearing existing fixtures and dependent records...');

        // Delete dependent specs first
        await this.fixtureRepository.manager.query(
          'DELETE FROM specs WHERE fixture_id IN (SELECT id FROM fixtures)',
        );

        // Then delete fixtures
        await this.fixtureRepository.manager.query('DELETE FROM fixtures');

        this.logger.log('✅ Existing fixtures and dependent records cleared');
      }

      // Fetch all Serie A 2025 fixtures using the service method that makes one API call
      this.logger.log(`🌐 Fetching all Serie A ${season} fixtures from API-Football...`);

      const apiFixtures = await this.apiFootballService.getFixtures({
        league: 135,
        season,
      });

      this.logger.log(`📥 Retrieved ${apiFixtures.length} fixtures from API-Football`);

      if (apiFixtures.length === 0) {
        throw new Error(`No fixtures returned from API-Football for Serie A ${season}`);
      }

      // Transform and save fixtures to database
      this.logger.log('💾 Processing and inserting fixtures...');
      const savedFixtures = [];

      for (const apiFixture of apiFixtures) {
        // Extract week number from round (e.g., "Regular Season - 1" -> 1)
        const weekMatch = apiFixture.league.round.match(/(\d+)$/);
        const week = weekMatch ? parseInt(weekMatch[1], 10) : 1;

        // Determine result based on goals
        let result: '1' | 'X' | '2' | null = null;
        if (apiFixture.status.short === 'FT' && apiFixture.goals.home !== null && apiFixture.goals.away !== null) {
          if (apiFixture.goals.home > apiFixture.goals.away) {
            result = '1';
          } else if (apiFixture.goals.home < apiFixture.goals.away) {
            result = '2';
          } else {
            result = 'X';
          }
        }

        // Map API status to our status
        let status: 'SCHEDULED' | 'FINISHED' | 'LIVE' = 'SCHEDULED';
        if (apiFixture.status.short === 'FT') {
          status = 'FINISHED';
        } else if (['1H', '2H', 'HT', 'ET', 'BT', 'P'].includes(apiFixture.status.short)) {
          status = 'LIVE';
        }

        const fixture = this.fixtureRepository.create({
          home_team: apiFixture.teams.home.name,
          away_team: apiFixture.teams.away.name,
          match_date: new Date(apiFixture.date),
          stadium: apiFixture.venue.name || 'TBD',
          week: week,
          result: result,
          home_score: apiFixture.goals.home,
          away_score: apiFixture.goals.away,
          status: status,
          external_api_id: `api_football_${apiFixture.id}`,
          created_at: new Date(),
          updated_at: new Date(),
        });

        const saved = await this.fixtureRepository.save(fixture);
        savedFixtures.push(saved);

        // Log progress every 50 fixtures
        if (savedFixtures.length % 50 === 0) {
          this.logger.log(`📈 Processed ${savedFixtures.length}/${apiFixtures.length} fixtures...`);
        }
      }

      // Log completion
      this.logger.log(`🎉 Bulk sync complete! Inserted ${savedFixtures.length} fixtures from API-Football`);

      return {
        success: true,
        message: `Successfully synced ${savedFixtures.length} Serie A ${season} fixtures`,
        syncedCount: savedFixtures.length,
        existingCount: 0,
      };

    } catch (error) {
      this.logger.error(`❌ Bulk season fixtures sync failed: ${error.message}`, error);
      return {
        success: false,
        message: `Bulk sync failed: ${error.message}`,
        syncedCount: 0,
        existingCount: 0,
      };
    }
  }

  /**
   * Get active matches from database (SCHEDULED or LIVE) that need API polling
   */
  async getActiveMatches(): Promise<FixtureEntity[]> {
    try {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      // Get matches that are either:
      // 1. SCHEDULED for today/tomorrow (might start soon)
      // 2. Currently LIVE
      const activeMatches = await this.fixtureRepository
        .createQueryBuilder('fixture')
        .where(
          '(fixture.status = :scheduled AND fixture.match_date >= :today AND fixture.match_date < :tomorrow) OR fixture.status = :live',
          {
            scheduled: 'SCHEDULED',
            live: 'LIVE',
            today,
            tomorrow,
          },
        )
        .orderBy('fixture.match_date', 'ASC')
        .getMany();

      this.logger.debug(
        `Found ${activeMatches.length} active matches requiring API polling`,
      );

      return activeMatches;
    } catch (error) {
      this.logger.error('Failed to get active matches from database', error);
      return [];
    }
  }
}
