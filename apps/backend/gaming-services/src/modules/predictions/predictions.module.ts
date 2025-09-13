import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PredictionsController } from './predictions.controller';
import { PredictionsService } from './predictions.service';
import { Spec } from '../../entities/spec.entity';
import { Fixture } from '../../entities/fixture.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Spec, Fixture])],
  controllers: [PredictionsController],
  providers: [PredictionsService],
})
export class PredictionsModule {}
