import { Module } from '@nestjs/common';
import { FixturesController } from './fixtures.controller';
import { FixturesService } from './fixtures.service';
import { ApiFootballModule } from '../api-football/api-football.module';
import { ApiRateLimitModule } from '../api-rate-limit/api-rate-limit.module';
import { DatabasePersistenceModule } from '../database-persistence/database-persistence.module';

@Module({
  imports: [ApiFootballModule, ApiRateLimitModule, DatabasePersistenceModule],
  controllers: [FixturesController],
  providers: [FixturesService],
  exports: [FixturesService],
})
export class FixturesModule {}
