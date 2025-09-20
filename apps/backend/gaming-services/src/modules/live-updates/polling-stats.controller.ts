import { Controller, Get, Post, Param } from '@nestjs/common';
import { SimpleMatchPollingService } from './simple-match-polling.service';

@Controller('admin/polling')
export class PollingStatsController {
  constructor(private readonly pollingService: SimpleMatchPollingService) {}

  /**
   * Basic health check for the controller
   */
  @Get('health')
  getHealth() {
    return { status: 'ok', message: 'Polling stats controller is working' };
  }

  /**
   * Get current polling statistics and active match checkpoints
   */
  @Get('stats')
  async getPollingStats() {
    try {
      return await this.pollingService.getPollingStats();
    } catch (error) {
      return { error: error.message };
    }
  }

  /**
   * Manually trigger a check for a specific fixture (admin testing)
   */
  @Post('check/:fixtureId')
  async manualCheck(@Param('fixtureId') fixtureId: string) {
    try {
      return await this.pollingService.triggerManualCheck(fixtureId);
    } catch (error) {
      return { error: error.message };
    }
  }

  /**
   * Get detailed breakdown of API usage efficiency
   */
  @Get('efficiency')
  async getEfficiencyStats() {
    try {
      const stats = await this.pollingService.getPollingStats();

      return {
        ...stats,
        efficiency: {
          callsPerMatch:
            stats.activeMatches > 0
              ? stats.dailyApiCalls / stats.activeMatches
              : 0,
          utilizationPercent: (stats.dailyApiCalls / stats.maxDailyCalls) * 100,
          estimatedMatchesCanHandle: Math.floor(stats.remainingCalls / 3), // 3 calls per match average
          budgetStatus: this.getBudgetStatus(
            stats.dailyApiCalls,
            stats.maxDailyCalls,
          ),
        },
      };
    } catch (error) {
      return { error: error.message };
    }
  }

  private getBudgetStatus(used: number, max: number): string {
    const percent = (used / max) * 100;
    if (percent < 50) return 'HEALTHY';
    if (percent < 80) return 'MODERATE';
    if (percent < 95) return 'HIGH';
    return 'CRITICAL';
  }
}
