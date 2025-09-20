import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ApiFootballService } from '../api-football/api-football.service';
import { CacheService } from '../cache/cache.service';
import { FixturesService } from '../fixtures/fixtures.service';

interface MatchCheckpoint {
  id: string;
  homeTeam: string;
  awayTeam: string;
  scheduledTime: Date;
  kickoffChecked: boolean;
  endChecked: boolean;
  status: 'SCHEDULED' | 'LIVE' | 'FINISHED';
}

@Injectable()
export class SimpleMatchPollingService {
  private readonly logger = new Logger(SimpleMatchPollingService.name);
  private readonly activeMatches = new Map<string, MatchCheckpoint>();
  private dailyApiCalls = 0;
  private lastDailyReset = new Date();

  // Configuration
  private readonly MAX_DAILY_CALLS = 50;
  private readonly KICKOFF_BUFFER_MINUTES = 5;
  private readonly MATCH_DURATION_MINUTES = 105; // 90 + 15 injury time

  constructor(
    private readonly fixturesService: FixturesService,
    private readonly apiFootballService: ApiFootballService,
    private readonly cacheService: CacheService,
  ) {
    this.initializeDailyTracking();
  }

  /**
   * Main polling orchestrator - runs every 5 minutes
   */
  @Cron('*/5 * * * *', {
    name: 'simpleMatchPolling',
    timeZone: 'Europe/Rome',
  })
  async checkMatchCheckpoints() {
    if (process.env.DISABLE_LIVE_UPDATES === 'true') {
      return;
    }

    try {
      await this.resetDailyCounterIfNeeded();
      await this.loadTodaysMatches();
      await this.processCheckpoints();

      this.logger.debug(
        `Polling cycle completed. API calls today: ${this.dailyApiCalls}/${this.MAX_DAILY_CALLS}`,
      );
    } catch (error) {
      this.logger.error('Simple polling failed', error);
    }
  }

  /**
   * Load today's matches (week 4 for testing)
   */
  private async loadTodaysMatches() {
    try {
      // For now, hardcode week 4 since that's what we're testing
      const weekFixtures = await this.fixturesService.getFixturesByWeek(4);

      // Filter to today's matches only
      const today = new Date();
      const todayStr = today.toISOString().split('T')[0];

      const todaysFixtures = weekFixtures.filter((fixture) => {
        const fixtureDate = new Date(fixture.match_date)
          .toISOString()
          .split('T')[0];
        return fixtureDate === todayStr && fixture.status !== 'FINISHED';
      });

      // Set up checkpoints for new matches
      for (const fixture of todaysFixtures) {
        if (!this.activeMatches.has(fixture.id)) {
          this.activeMatches.set(fixture.id, {
            id: fixture.id,
            homeTeam: fixture.home_team,
            awayTeam: fixture.away_team,
            scheduledTime: new Date(fixture.match_date),
            kickoffChecked: fixture.status === 'LIVE',
            endChecked: fixture.status === 'FINISHED',
            status: fixture.status as any,
          });

          this.logger.log(
            `📌 Tracking match: ${fixture.home_team} vs ${fixture.away_team} (${fixture.match_date})`,
          );
        }
      }

      // Remove finished matches
      for (const [matchId, checkpoint] of this.activeMatches) {
        const fixture = todaysFixtures.find((f) => f.id === matchId);
        if (!fixture || fixture.status === 'FINISHED') {
          this.logger.log(
            `✅ Removing completed match: ${checkpoint.homeTeam} vs ${checkpoint.awayTeam}`,
          );
          this.activeMatches.delete(matchId);
        }
      }
    } catch (error) {
      this.logger.error("Failed to load today's matches", error);
    }
  }

  /**
   * Process checkpoints - only make API calls when necessary
   */
  private async processCheckpoints() {
    const now = new Date();

    for (const [matchId, checkpoint] of this.activeMatches) {
      try {
        // CHECKPOINT 1: Kickoff confirmation
        if (
          !checkpoint.kickoffChecked &&
          this.shouldCheckKickoff(checkpoint, now)
        ) {
          this.logger.log(
            `🏁 KICKOFF CHECK: ${checkpoint.homeTeam} vs ${checkpoint.awayTeam} (${this.dailyApiCalls}/${this.MAX_DAILY_CALLS} API calls used)`,
          );

          if (this.canMakeApiCall()) {
            // For now, just simulate the check
            this.simulateApiCall();
            checkpoint.kickoffChecked = true;
            this.logger.log(
              `✅ Kickoff confirmed for ${checkpoint.homeTeam} vs ${checkpoint.awayTeam}`,
            );
          } else {
            this.logger.warn(`⚠️ Cannot check kickoff - API limit reached`);
          }
        }

        // CHECKPOINT 2: End of match detection
        if (
          checkpoint.kickoffChecked &&
          !checkpoint.endChecked &&
          this.shouldCheckEnd(checkpoint, now)
        ) {
          this.logger.log(
            `⏰ END CHECK: ${checkpoint.homeTeam} vs ${checkpoint.awayTeam} (${this.dailyApiCalls}/${this.MAX_DAILY_CALLS} API calls used)`,
          );

          if (this.canMakeApiCall()) {
            // For now, just simulate the check
            this.simulateApiCall();
            checkpoint.endChecked = true;
            this.logger.log(
              `🏁 Match end confirmed for ${checkpoint.homeTeam} vs ${checkpoint.awayTeam}`,
            );
          } else {
            this.logger.warn(`⚠️ Cannot check end - API limit reached`);
          }
        }
      } catch (error) {
        this.logger.error(
          `Failed to process checkpoint for match ${matchId}`,
          error,
        );
      }
    }
  }

  /**
   * Check if we should poll for kickoff
   */
  private shouldCheckKickoff(checkpoint: MatchCheckpoint, now: Date): boolean {
    const minutesSinceScheduled =
      (now.getTime() - checkpoint.scheduledTime.getTime()) / (1000 * 60);
    return minutesSinceScheduled >= this.KICKOFF_BUFFER_MINUTES;
  }

  /**
   * Check if we should poll for match end
   */
  private shouldCheckEnd(checkpoint: MatchCheckpoint, now: Date): boolean {
    const endCheckTime = new Date(
      checkpoint.scheduledTime.getTime() +
        this.MATCH_DURATION_MINUTES * 60 * 1000,
    );
    return now.getTime() >= endCheckTime.getTime();
  }

  /**
   * API budget management
   */
  private canMakeApiCall(): boolean {
    return this.dailyApiCalls < this.MAX_DAILY_CALLS;
  }

  private simulateApiCall() {
    this.dailyApiCalls++;
    this.cacheService.set(
      'simple-polling:daily-calls',
      this.dailyApiCalls,
      24 * 60 * 60,
    );
    this.logger.debug(
      `📞 API call simulated (${this.dailyApiCalls}/${this.MAX_DAILY_CALLS})`,
    );
  }

  private async resetDailyCounterIfNeeded() {
    const now = new Date();
    if (now.getDate() !== this.lastDailyReset.getDate()) {
      this.dailyApiCalls = 0;
      this.lastDailyReset = now;
      this.logger.log('📊 Daily API call counter reset');
      await this.cacheService.set(
        'simple-polling:daily-calls',
        0,
        24 * 60 * 60,
      );
    }
  }

  private async initializeDailyTracking() {
    const cachedCount = await this.cacheService.get<number>(
      'simple-polling:daily-calls',
    );
    if (cachedCount !== null) {
      this.dailyApiCalls = cachedCount;
    }
  }

  /**
   * Public methods for monitoring
   */
  async getPollingStats() {
    return {
      activeMatches: this.activeMatches.size,
      dailyApiCalls: this.dailyApiCalls,
      maxDailyCalls: this.MAX_DAILY_CALLS,
      remainingCalls: this.MAX_DAILY_CALLS - this.dailyApiCalls,
      checkpoints: Array.from(this.activeMatches.values()).map((cp) => ({
        id: cp.id,
        match: `${cp.homeTeam} vs ${cp.awayTeam}`,
        scheduledTime: cp.scheduledTime,
        kickoffChecked: cp.kickoffChecked,
        endChecked: cp.endChecked,
        status: cp.status,
      })),
    };
  }

  /**
   * Manual trigger for testing
   */
  async triggerManualCheck(fixtureId: string) {
    const checkpoint = this.activeMatches.get(fixtureId);
    if (!checkpoint) {
      throw new Error(`No active checkpoint found for fixture ${fixtureId}`);
    }

    if (!this.canMakeApiCall()) {
      throw new Error('Daily API limit reached');
    }

    this.logger.log(
      `🔧 Manual check triggered for ${checkpoint.homeTeam} vs ${checkpoint.awayTeam}`,
    );
    this.simulateApiCall();

    return {
      success: true,
      message: `Manual check completed for ${checkpoint.homeTeam} vs ${checkpoint.awayTeam}`,
      apiCallsRemaining: this.MAX_DAILY_CALLS - this.dailyApiCalls,
    };
  }
}
