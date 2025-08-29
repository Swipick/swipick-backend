import { Controller, Get, Query, Param, Post, Body } from '@nestjs/common';
import { FixturesService } from './fixtures.service';
import { ApiRateLimitService } from '../api-rate-limit/api-rate-limit.service';
import { DatabasePersistenceService } from '../database-persistence/database-persistence.service';

@Controller('fixtures')
export class FixturesController {
  constructor(
    private readonly fixturesService: FixturesService,
    private readonly rateLimitService: ApiRateLimitService,
    private readonly dbPersistenceService: DatabasePersistenceService,
  ) {}

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

  @Get('upcoming/serie-a')
  async getUpcomingSerieAFixtures(@Query('days') days?: number) {
    const daysToFetch = days || 7; // Default to 7 days
    return this.fixturesService.getUpcomingSerieAFixtures(daysToFetch);
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

  @Get('quota/status')
  async getQuotaStatus() {
    const quotaStatus = await this.rateLimitService.getDailyQuotaStatus();
    const usageStats = await this.dbPersistenceService.getApiUsageStats(7);

    return {
      quota: quotaStatus,
      usage: usageStats,
      canMakeCall: await this.rateLimitService.canMakeApiCall(),
    };
  }

  @Post('quota/clear-cache')
  async clearCache() {
    await this.rateLimitService.clearAllCache();
    return {
      success: true,
      message: 'All cache cleared successfully',
    };
  }

  @Post('populate-season')
  async populateSerieASeason() {
    const result = await this.fixturesService.populateSerieASeason();
    return {
      success: true,
      message: 'Serie A 2024-25 season populated successfully',
      ...result,
    };
  }
}
