import { Module } from '@nestjs/common';
import { LiveUpdatesService } from './live-updates.service';
import { LiveUpdatesGateway } from './live-updates.gateway';
import { LiveUpdatesScheduler } from './live-updates.scheduler';
import { FixturesModule } from '../fixtures/fixtures.module';

@Module({
  imports: [FixturesModule],
  providers: [LiveUpdatesService, LiveUpdatesGateway, LiveUpdatesScheduler],
  exports: [LiveUpdatesService, LiveUpdatesGateway],
})
export class LiveUpdatesModule {}
