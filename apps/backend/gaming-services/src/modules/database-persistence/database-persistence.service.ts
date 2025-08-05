import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool } from 'pg';
import { Fixture } from '../api-football/interfaces/fixture.interface';

interface FixtureRecord {
  id: number;
  data: any;
  created_at: Date;
  updated_at: Date;
  league_id: number;
  match_date: Date;
  season: number;
}

@Injectable()
export class DatabasePersistenceService {
  private readonly logger = new Logger(DatabasePersistenceService.name);
  private pool: Pool;

  constructor(private readonly configService: ConfigService) {
    this.initializeDatabase();
  }

  private initializeDatabase() {
    const databaseUrl = this.configService.get<string>('DATABASE_URL');
    if (databaseUrl) {
      this.pool = new Pool({
        connectionString: databaseUrl,
        ssl: { rejectUnauthorized: false },
        max: 5, // Limit connections for free tier
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 10000,
      });
      this.logger.log('✅ Neon PostgreSQL connection initialized');
      this.createTablesIfNotExists();
    } else {
      this.logger.warn('⚠️ No DATABASE_URL provided, persistence disabled');
    }
  }

  private async createTablesIfNotExists() {
    if (!this.pool) return;

    try {
      await this.pool.query(`
        CREATE TABLE IF NOT EXISTS fixtures_cache (
          id SERIAL PRIMARY KEY,
          fixture_id INTEGER UNIQUE NOT NULL,
          league_id INTEGER NOT NULL,
          season INTEGER NOT NULL,
          match_date TIMESTAMP NOT NULL,
          data JSONB NOT NULL,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        );

        CREATE INDEX IF NOT EXISTS idx_fixtures_league_season 
        ON fixtures_cache(league_id, season);
        
        CREATE INDEX IF NOT EXISTS idx_fixtures_match_date 
        ON fixtures_cache(match_date);

        CREATE TABLE IF NOT EXISTS api_usage_log (
          id SERIAL PRIMARY KEY,
          date DATE NOT NULL,
          endpoint VARCHAR(255) NOT NULL,
          calls_count INTEGER DEFAULT 1,
          cached_responses INTEGER DEFAULT 0,
          failed_calls INTEGER DEFAULT 0,
          created_at TIMESTAMP DEFAULT NOW(),
          UNIQUE(date, endpoint)
        );

        CREATE INDEX IF NOT EXISTS idx_api_usage_date 
        ON api_usage_log(date);
      `);

      this.logger.log('📦 Database tables initialized');
    } catch (error) {
      this.logger.error('Error creating database tables', error);
    }
  }

  /**
   * Store Serie A fixtures in database for long-term caching
   */
  async persistSerieAFixtures(
    fixtures: Fixture[],
    season: number = 2025,
  ): Promise<void> {
    if (!this.pool || fixtures.length === 0) return;

    try {
      const client = await this.pool.connect();

      try {
        await client.query('BEGIN');

        for (const fixture of fixtures) {
          await client.query(
            `
            INSERT INTO fixtures_cache (fixture_id, league_id, season, match_date, data)
            VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT (fixture_id) 
            DO UPDATE SET 
              data = EXCLUDED.data,
              updated_at = NOW()
          `,
            [
              fixture.id,
              fixture.league.id,
              season,
              new Date(fixture.date),
              JSON.stringify(fixture),
            ],
          );
        }

        await client.query('COMMIT');
        this.logger.log(
          `💾 Persisted ${fixtures.length} Serie A fixtures to database`,
        );
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    } catch (error) {
      this.logger.error('Error persisting fixtures to database', error);
    }
  }

  /**
   * Retrieve Serie A fixtures from database
   */
  async getPersistedSerieAFixtures(
    season: number = 2025,
    days: number = 7,
  ): Promise<Fixture[]> {
    if (!this.pool) return [];

    try {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + days);

      const result = await this.pool.query(
        `
        SELECT data FROM fixtures_cache 
        WHERE league_id = 135 
          AND season = $1 
          AND match_date >= NOW() 
          AND match_date <= $2 
        ORDER BY match_date ASC
        LIMIT 10
      `,
        [season, futureDate],
      );

      const fixtures = result.rows.map((row) => row.data as Fixture);

      if (fixtures.length > 0) {
        this.logger.log(
          `📦 Retrieved ${fixtures.length} Serie A fixtures from database`,
        );
      }

      return fixtures;
    } catch (error) {
      this.logger.error('Error retrieving fixtures from database', error);
      return [];
    }
  }

  /**
   * Log API usage for analytics
   */
  async logApiUsage(
    endpoint: string,
    success: boolean = true,
    cached: boolean = false,
  ): Promise<void> {
    if (!this.pool) return;

    try {
      const today = new Date().toISOString().split('T')[0];

      await this.pool.query(
        `
        INSERT INTO api_usage_log (date, endpoint, calls_count, cached_responses, failed_calls)
        VALUES ($1, $2, 1, $3, $4)
        ON CONFLICT (date, endpoint) 
        DO UPDATE SET 
          calls_count = api_usage_log.calls_count + 1,
          cached_responses = api_usage_log.cached_responses + $3,
          failed_calls = api_usage_log.failed_calls + $4
      `,
        [today, endpoint, cached ? 1 : 0, success ? 0 : 1],
      );
    } catch (error) {
      this.logger.error('Error logging API usage', error);
    }
  }

  /**
   * Get API usage statistics
   */
  async getApiUsageStats(days: number = 7): Promise<any[]> {
    if (!this.pool) return [];

    try {
      const result = await this.pool.query(`
        SELECT 
          date,
          endpoint,
          calls_count,
          cached_responses,
          failed_calls,
          ROUND((cached_responses::float / calls_count::float) * 100, 2) as cache_hit_rate
        FROM api_usage_log 
        WHERE date >= CURRENT_DATE - INTERVAL '${days} days'
        ORDER BY date DESC, calls_count DESC
      `);

      return result.rows;
    } catch (error) {
      this.logger.error('Error getting API usage stats', error);
      return [];
    }
  }

  /**
   * Clean old fixtures data (keep last 30 days)
   */
  async cleanOldData(): Promise<void> {
    if (!this.pool) return;

    try {
      const result = await this.pool.query(`
        DELETE FROM fixtures_cache 
        WHERE created_at < NOW() - INTERVAL '30 days'
      `);

      await this.pool.query(`
        DELETE FROM api_usage_log 
        WHERE date < CURRENT_DATE - INTERVAL '90 days'
      `);

      this.logger.log(`🗑️ Cleaned ${result.rowCount} old fixture records`);
    } catch (error) {
      this.logger.error('Error cleaning old data', error);
    }
  }
}
