import { Module } from '@nestjs/common';
import { LiveUpdatesService } from './live-updates.service';
import { LiveUpdatesGateway } from './live-updates.gateway';
import { LiveUpdatesScheduler } from './live-updates.scheduler';
import { SimpleMatchPollingService } from './simple-match-polling.service';
import { PollingStatsController } from './polling-stats.controller';
import { FixturesModule } from '../fixtures/fixtures.module';
import { ApiFootballModule } from '../api-football/api-football.module';
import { CacheServiceModule } from '../cache/cache.module';

@Module({
  imports: [FixturesModule, ApiFootballModule, CacheServiceModule],
  providers: [
    LiveUpdatesService,
    LiveUpdatesGateway,
    LiveUpdatesScheduler,
    SimpleMatchPollingService,
  ],
  controllers: [PollingStatsController],
  exports: [LiveUpdatesService, LiveUpdatesGateway, SimpleMatchPollingService],
})
export class LiveUpdatesModule {}
