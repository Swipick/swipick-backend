import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FixturesController } from './fixtures.controller';
import { FixturesService } from './fixtures.service';
import { ApiFootballModule } from '../api-football/api-football.module';
import { ApiRateLimitModule } from '../api-rate-limit/api-rate-limit.module';
import { DatabasePersistenceModule } from '../database-persistence/database-persistence.module';
import { Fixture } from '../../entities/fixture.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Fixture]),
    ApiFootballModule,
    ApiRateLimitModule,
    DatabasePersistenceModule,
  ],
  controllers: [FixturesController],
  providers: [FixturesService],
  exports: [FixturesService],
})
export class FixturesModule {}
