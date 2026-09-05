import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CalendarSyncService } from './calendar-sync.service';
import { ApiFootballModule } from '../api-football/api-football.module';
import { Fixture } from '../../entities/fixture.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Fixture]), ApiFootballModule],
  providers: [CalendarSyncService],
  exports: [CalendarSyncService],
})
export class CalendarSyncModule {}
