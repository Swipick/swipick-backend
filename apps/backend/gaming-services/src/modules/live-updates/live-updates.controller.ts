import { Controller, Post, Get, Param, Body } from '@nestjs/common';
import { SimpleMatchPollingService } from './simple-match-polling.service';

@Controller('live-updates')
export class LiveUpdatesController {
  constructor(
    private readonly simpleMatchPollingService: SimpleMatchPollingService,
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
          const result = await this.simpleMatchPollingService.triggerManualCheck(checkpoint.id);
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
}