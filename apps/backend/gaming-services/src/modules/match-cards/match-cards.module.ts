import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MatchCardsController } from './match-cards.controller';
import { MatchCardsService } from './match-cards.service';
import { Fixture } from '../../entities/fixture.entity';
import { Spec } from '../../entities/spec.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Fixture, Spec])],
  controllers: [MatchCardsController],
  providers: [MatchCardsService],
  exports: [MatchCardsService],
})
export class MatchCardsModule {}