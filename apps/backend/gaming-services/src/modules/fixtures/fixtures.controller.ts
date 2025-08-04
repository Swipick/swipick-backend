import { Controller, Get, Query, Param, Post, Body } from '@nestjs/common';
import { FixturesService } from './fixtures.service';

@Controller('fixtures')
export class FixturesController {
  constructor(private readonly fixturesService: FixturesService) {}

  @Get()
  async getFixtures(
    @Query('date') date?: string,
    @Query('gameweek') gameweek?: number,
  ) {
    if (gameweek) {
      const targetDate = date ? new Date(date) : undefined;
      return this.fixturesService.getFixturesForGameweek(gameweek, targetDate);
    }

    if (date) {
      return this.fixturesService.syncFixturesForDate(date);
    }

    // Default to today's fixtures
    const today = new Date().toISOString().split('T')[0];
    return this.fixturesService.syncFixturesForDate(today);
  }

  @Get('live')
  async getLiveFixtures() {
    return this.fixturesService.getLiveMatches();
  }

  @Get(':id')
  async getFixture(@Param('id') id: number) {
    return this.fixturesService.getFixtureById(id);
  }

  @Post('sync')
  async syncFixtures(@Body() body: { date: string }) {
    const fixtures = await this.fixturesService.syncFixturesForDate(body.date);
    return {
      success: true,
      syncedCount: fixtures.length,
      date: body.date,
    };
  }
}
