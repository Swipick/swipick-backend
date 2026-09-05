import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CacheModule } from '@nestjs/cache-manager';
import { ScheduleModule } from '@nestjs/schedule';

// Configuration
import { DatabaseConfig } from './config/database.config';
import { ApiFootballConfig } from './config/api-football.config';
import { WebSocketConfig } from './config/websocket.config';
import { SeasonConfig } from './config/season.config';

// Modules
import { ApiFootballModule } from './modules/api-football/api-football.module';
import { FixturesModule } from './modules/fixtures/fixtures.module';
import { TeamsModule } from './modules/teams/teams.module';
import { LiveUpdatesModule } from './modules/live-updates/live-updates.module';
import { CacheServiceModule } from './modules/cache/cache.module';
import { HealthModule } from './modules/health/health.module';
import { SpecsModule } from './modules/specs/specs.module';
import { TestModeModule } from './modules/test-mode/test-mode.module';
import { MatchCardsModule } from './modules/match-cards/match-cards.module';
import { FinalWeekScoresModule } from './modules/final-week-scores/final-week-scores.module';
import { SeasonModule } from './modules/season/season.module';
import { CalendarSyncModule } from './modules/calendar-sync/calendar-sync.module';

@Module({
  imports: [
    // Core modules
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '../../../.env', // Path to root .env file
      load: [DatabaseConfig, ApiFootballConfig, WebSocketConfig, SeasonConfig],
    }),

    // Database
    TypeOrmModule.forRootAsync({
      useFactory: () => DatabaseConfig(),
    }),

    // Cache
    CacheModule.register({
      isGlobal: true,
      ttl: 300, // 5 minutes default
    }),

    // Scheduler
    ScheduleModule.forRoot(),

    // Application modules
    SeasonModule,
    ApiFootballModule,
    FixturesModule,
    TeamsModule,
    LiveUpdatesModule,
    CalendarSyncModule,
    CacheServiceModule,
    HealthModule,
    SpecsModule,
    TestModeModule,
    MatchCardsModule,
    FinalWeekScoresModule,
  ],
})
export class AppModule {
  constructor() {
    // SANITY CHECK: Verify deployment of updated Gaming Services
    console.log('🚀🚀🚀 [GAMING_SERVICES_INIT] ='.repeat(30));
    console.log(
      '🚀🚀🚀 [GAMING_SERVICES_INIT] *** GAMING SERVICES APP MODULE INITIALIZED OCT 6TH ***',
    );
    console.log(
      '🚀🚀🚀 [GAMING_SERVICES_INIT] Timestamp:',
      new Date().toISOString(),
    );
    console.log(
      '🚀🚀🚀 [GAMING_SERVICES_INIT] Version: PERCENTILE_RANKINGS_OCT_6TH_V1',
    );
    console.log('🚀🚀🚀 [GAMING_SERVICES_INIT] Build timestamp:', Date.now());
    console.log('🚀🚀🚀 [GAMING_SERVICES_INIT] SpecsModule loaded: YES');
    console.log('🚀🚀🚀 [GAMING_SERVICES_INIT] TestModeModule loaded: YES');
    console.log(
      '🚀🚀🚀 [GAMING_SERVICES_INIT] FinalWeekScoresModule loaded: YES',
    );
    console.log(
      '🚀🚀🚀 [GAMING_SERVICES_INIT] FinalWeekScoresController endpoints:',
    );
    console.log('🚀🚀🚀 [GAMING_SERVICES_INIT] - POST /api/final-week-scores');
    console.log(
      '🚀🚀🚀 [GAMING_SERVICES_INIT] - GET /api/final-week-scores/:userId/week/:week',
    );
    console.log(
      '🚀🚀🚀 [GAMING_SERVICES_INIT] - GET /api/final-week-scores/:userId',
    );
    console.log(
      '🚀🚀🚀 [GAMING_SERVICES_INIT] - DELETE /api/final-week-scores/:userId/week/:week',
    );
    console.log(
      '🚀🚀🚀 [GAMING_SERVICES_INIT] *** NEW PERCENTILE ENDPOINTS OCT 6TH ***',
    );
    console.log(
      '🚀🚀🚀 [GAMING_SERVICES_INIT] - GET /api/final-week-scores/:userId/week/:week/percentile',
    );
    console.log(
      '🚀🚀🚀 [GAMING_SERVICES_INIT] - GET /api/final-week-scores/:userId/statistics',
    );
    console.log('🚀🚀🚀 [GAMING_SERVICES_INIT] ='.repeat(30));
  }
}
