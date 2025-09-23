import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FinalWeekScoresController } from './final-week-scores.controller';
import { FinalWeekScoresService } from './final-week-scores.service';
import { FinalWeekScore } from '../../entities/final-week-score.entity';

@Module({
  imports: [TypeOrmModule.forFeature([FinalWeekScore])],
  controllers: [FinalWeekScoresController],
  providers: [FinalWeekScoresService],
  exports: [FinalWeekScoresService],
})
export class FinalWeekScoresModule {}
