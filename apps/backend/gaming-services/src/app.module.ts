import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CacheModule } from '@nestjs/cache-manager';
import { ScheduleModule } from '@nestjs/schedule';

// Configuration
import { DatabaseConfig } from './config/database.config';
import { ApiFootballConfig } from './config/api-football.config';
import { WebSocketConfig } from './config/websocket.config';

// Modules
import { ApiFootballModule } from './modules/api-football/api-football.module';
import { FixturesModule } from './modules/fixtures/fixtures.module';
import { TeamsModule } from './modules/teams/teams.module';
import { LiveUpdatesModule } from './modules/live-updates/live-updates.module';
import { CacheServiceModule } from './modules/cache/cache.module';
import { HealthModule } from './modules/health/health.module';

@Module({
  imports: [
    // Core modules
    ConfigModule.forRoot({
      isGlobal: true,
      load: [DatabaseConfig, ApiFootballConfig, WebSocketConfig],
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
    ApiFootballModule,
    FixturesModule,
    TeamsModule,
    LiveUpdatesModule,
    CacheServiceModule,
    HealthModule,
  ],
})
export class AppModule {}
