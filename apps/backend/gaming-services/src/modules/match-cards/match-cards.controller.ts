import { Controller, Get, Param, Query } from '@nestjs/common';
import { MatchCardsService } from './match-cards.service';

@Controller('match-cards')
export class MatchCardsController {
  constructor(private readonly matchCardsService: MatchCardsService) {}

  @Get('week/:weekNumber')
  async getMatchCardsByWeek(
    @Param('weekNumber') weekNumber: number,
    @Query('userId') userId?: string,
  ) {
    return this.matchCardsService.getMatchCardsByWeek(weekNumber, userId);
  }
}