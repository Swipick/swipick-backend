import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MatchCardsController } from './match-cards.controller';
import { MatchCardsService } from './match-cards.service';
import { Fixture } from '../../entities/fixture.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Fixture])],
  controllers: [MatchCardsController],
  providers: [MatchCardsService],
  exports: [MatchCardsService],
})
export class MatchCardsModule {}