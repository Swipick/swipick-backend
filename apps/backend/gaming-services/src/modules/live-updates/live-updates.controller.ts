import { Controller, Post, Get, Param } from '@nestjs/common';
import { SimpleMatchPollingService } from './simple-match-polling.service';
import { ApiFootballService } from '../api-football/api-football.service';

@Controller('live-updates')
export class LiveUpdatesController {
  constructor(
    private readonly simpleMatchPollingService: SimpleMatchPollingService,
    private readonly apiFootballService: ApiFootballService,
  ) {}

  @Get('polling-stats')
  async getPollingStats() {
    return this.simpleMatchPollingService.getPollingStats();
  }

  @Post('manual-check/:fixtureId')
  async triggerManualCheck(@Param('fixtureId') fixtureId: string) {
    return this.simpleMatchPollingService.triggerManualCheck(fixtureId);
  }

  @Post('manual-check-all')
  async triggerManualCheckAll() {
    const stats = await this.simpleMatchPollingService.getPollingStats();
    const results = [];

    for (const checkpoint of stats.checkpoints) {
      if (!checkpoint.kickoffChecked || !checkpoint.endChecked) {
        try {
          const result =
            await this.simpleMatchPollingService.triggerManualCheck(
              checkpoint.id,
            );
          results.push({ fixtureId: checkpoint.id, ...result });
        } catch (error) {
          results.push({
            fixtureId: checkpoint.id,
            success: false,
            error: error.message,
          });
        }
      }
    }

    return {
      success: true,
      processed: results.length,
      results,
    };
  }

  @Get('debug/live-matches')
  async debugLiveMatches() {
    try {
      const liveMatches = await this.apiFootballService.getLiveMatches();
      return {
        success: true,
        count: liveMatches.length,
        matches: liveMatches.map((match) => ({
          homeTeam: match.teams?.home?.name || 'Unknown',
          awayTeam: match.teams?.away?.name || 'Unknown',
          status: match.status?.short,
          minute: (match as any).fixture?.status?.elapsed,
          goals: match.goals,
        })),
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  @Get('debug/daily-fixtures')
  async debugDailyFixtures() {
    try {
      const today = new Date().toISOString().split('T')[0];
      const dailyFixtures =
        await this.apiFootballService.getDailyFixtures(today);
      return {
        success: true,
        count: dailyFixtures.length,
        matches: dailyFixtures.map((match) => ({
          homeTeam: match.teams?.home?.name || 'Unknown',
          awayTeam: match.teams?.away?.name || 'Unknown',
          status: match.status?.short,
          minute: (match as any).fixture?.status?.elapsed,
          goals: match.goals,
          league: match.league,
        })),
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        stack: error.stack,
      };
    }
  }

  @Get('debug/test-connection')
  async testApiConnection() {
    try {
      // Test a simple API call to check connectivity
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const testDate = yesterday.toISOString().split('T')[0];

      const fixtures = await this.apiFootballService.getDailyFixtures(testDate);
      return {
        success: true,
        message: 'API connection working',
        testDate,
        fixturesFound: fixtures.length,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        stack: error.stack,
      };
    }
  }

  @Get('debug/test-raw-api')
  async testRawApi() {
    try {
      // Test without any filters to see what data we can access
      const fixtures = await this.apiFootballService[
        'apiFootballClient'
      ].getFixtures({
        date: '2025-09-19', // Yesterday
      });

      return {
        success: true,
        message: 'Raw API test',
        fixturesFound: fixtures.length,
        sampleFixture: fixtures[0] || null,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        stack: error.stack,
      };
    }
  }

  @Get('debug/leagues')
  async debugLeagues() {
    try {
      // Get all leagues to find Serie A and check coverage
      const leagues: any = await this.apiFootballService['apiFootballClient'][
        'makeRequest'
      ]('/leagues', {});

      const serieALeagues = (leagues.response || []).filter(
        (league: any) =>
          league.league?.name?.toLowerCase().includes('serie a') ||
          league.league?.name?.toLowerCase().includes('italy'),
      );

      return {
        success: true,
        message: 'Leagues API test',
        totalLeagues: (leagues.response || []).length,
        serieAMatches: serieALeagues.length,
        serieALeagues: serieALeagues.map((league) => ({
          id: league.league?.id,
          name: league.league?.name,
          country: league.country?.name,
          type: league.league?.type,
          logo: league.league?.logo,
          seasons: league.seasons?.map((s) => s.year),
          currentSeason: league.seasons?.find((s) => s.current)?.year,
          coverage: league.seasons?.find((s) => s.current)?.coverage,
          allSeasons: league.seasons?.map((s) => ({
            year: s.year,
            start: s.start,
            end: s.end,
            current: s.current,
            coverage: s.coverage,
          })),
        })),
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        stack: error.stack,
      };
    }
  }

  @Get('debug/find-serie-a-season')
  async findSerieASeason() {
    try {
      // Get Serie A leagues specifically
      const leagues: any = await this.apiFootballService['apiFootballClient'][
        'makeRequest'
      ]('/leagues', {
        id: 135, // Serie A league ID
      });

      const serieA = leagues.response?.[0];

      if (!serieA) {
        return {
          success: false,
          message: 'Serie A (ID 135) not found',
        };
      }

      // Find current season
      const currentSeason = serieA.seasons?.find((s: any) => s.current);
      const allSeasons = serieA.seasons?.map((s: any) => ({
        year: s.year,
        start: s.start,
        end: s.end,
        current: s.current,
        coverage: s.coverage,
      }));

      return {
        success: true,
        league: {
          id: serieA.league?.id,
          name: serieA.league?.name,
          country: serieA.country?.name,
        },
        currentSeason: currentSeason
          ? {
              year: currentSeason.year,
              start: currentSeason.start,
              end: currentSeason.end,
              current: currentSeason.current,
              coverage: currentSeason.coverage,
            }
          : null,
        allSeasons,
        recommendedApiCall: currentSeason
          ? {
              league: serieA.league?.id,
              season: currentSeason.year,
              date: '2025-09-20',
            }
          : null,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        stack: error.stack,
      };
    }
  }

  @Get('debug/api-status')
  async debugApiStatus() {
    try {
      // Check the API status endpoint
      const status = await this.apiFootballService['apiFootballClient'][
        'makeRequest'
      ]('/status', {});

      return {
        success: true,
        message: 'API Status check',
        status: status,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        stack: error.stack,
      };
    }
  }

  @Post('backfill-results/:date')
  async backfillResults(@Param('date') date: string) {
    try {
      // Try different season/league combinations to find the matches
      const results = [];
      const seasons = [2024, 2025];

      for (const season of seasons) {
        try {
          const fixtures = await this.apiFootballService[
            'apiFootballClient'
          ].getFixtures({
            date,
            league: 135,
            season,
          });

          if (fixtures.length > 0) {
            results.push({
              season,
              fixtures: fixtures.map((f) => ({
                id: f.id,
                homeTeam: f.teams?.home?.name,
                awayTeam: f.teams?.away?.name,
                status: f.status?.short,
                goals: f.goals,
                finished: ['FT', 'AET', 'PST'].includes(f.status?.short),
              })),
            });
          }
        } catch (err) {
          results.push({ season, error: err.message });
        }
      }

      return {
        success: true,
        date,
        message: 'Backfill results search',
        results,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        stack: error.stack,
      };
    }
  }
}
