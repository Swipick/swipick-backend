import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ApiFootballService } from '../api-football/api-football.service';
import { CacheService } from '../cache/cache.service';
import { FixturesService } from '../fixtures/fixtures.service';
import { Fixture } from '../../entities/fixture.entity';
import { Fixture as ApiFixture } from '../api-football/interfaces/fixture.interface';

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
    @InjectRepository(Fixture)
    private readonly fixtureRepository: Repository<Fixture>,
    private readonly fixturesService: FixturesService,
    private readonly apiFootballService: ApiFootballService,
    private readonly cacheService: CacheService,
  ) {
    this.initializeDailyTracking();
    this.logServiceVersion();
  }

  private logServiceVersion() {
    this.logger.log('='.repeat(80));
    this.logger.log(
      '🔥🔥🔥 [SIMPLE_MATCH_POLLING_INIT] SERVICE INITIALIZED 🔥🔥🔥',
    );
    this.logger.log('='.repeat(80));
    this.logger.log(
      '[SIMPLE_MATCH_POLLING_INIT] Timestamp: ' + new Date().toISOString(),
    );
    this.logger.log(
      '[SIMPLE_MATCH_POLLING_INIT] Version: DYNAMIC_WEEK_DETECTION_V2_20250930',
    );
    this.logger.log(
      '[SIMPLE_MATCH_POLLING_INIT] Feature: 7-Day Window Scanning (Past + Future)',
    );
    this.logger.log(
      '[SIMPLE_MATCH_POLLING_INIT] Feature: Automatic Week Detection',
    );
    this.logger.log(
      '[SIMPLE_MATCH_POLLING_INIT] Feature: Catches Missed Matches from Downtime',
    );
    this.logger.log(
      '[SIMPLE_MATCH_POLLING_INIT] NO MORE HARDCODED WEEK 4 - DYNAMIC DETECTION ACTIVE!',
    );
    this.logger.log('='.repeat(80));
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

      // SMART POLLING: Only process checkpoints if we have active matches
      if (this.activeMatches.size === 0) {
        this.logger.debug(
          'No active matches - skipping API polling to save quota',
        );
        return;
      }

      this.logger.debug(
        `Processing ${this.activeMatches.size} active match checkpoints`,
      );
      await this.processCheckpoints();

      this.logger.debug(
        `Polling cycle completed. API calls today: ${this.dailyApiCalls}/${this.MAX_DAILY_CALLS}`,
      );
    } catch (error) {
      this.logger.error('Simple polling failed', error);
    }
  }

  /**
   * Load recent and upcoming unfinished matches (dynamic week detection)
   * VERSION: DYNAMIC_WEEK_DETECTION_V2_20250930
   */
  private async loadTodaysMatches() {
    try {
      // Get all unfinished fixtures from the past 7 days to today + 7 days
      // This ensures we catch matches that were missed due to downtime
      const now = new Date();
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const sevenDaysAhead = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

      this.logger.log(
        `🔍 DYNAMIC WEEK DETECTION V2 ACTIVE - Looking for unfinished matches between ${sevenDaysAgo.toISOString()} and ${sevenDaysAhead.toISOString()}`,
      );

      // Get all fixtures and filter for the date range
      const allFixtures = await this.fixtureRepository.find({
        where: {
          status: 'SCHEDULED' as any, // Only SCHEDULED matches need checking
        },
        order: { match_date: 'ASC' },
      });

      // Filter to matches in our date window
      const todaysFixtures = allFixtures.filter((fixture) => {
        const matchDate = new Date(fixture.match_date);
        return (
          matchDate >= sevenDaysAgo &&
          matchDate <= sevenDaysAhead &&
          fixture.status !== 'FINISHED'
        );
      });

      if (todaysFixtures.length > 0) {
        const weeks = [...new Set(todaysFixtures.map((f) => f.week))];
        this.logger.log(
          `🔍 Found ${todaysFixtures.length} unfinished fixtures across week(s): ${weeks.join(', ')}`,
        );
      }

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
            `📌 Tracking match Week ${fixture.week}: ${fixture.home_team} vs ${fixture.away_team} (${new Date(fixture.match_date).toISOString()})`,
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
            await this.performKickoffCheck(checkpoint);
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
            await this.performEndCheck(checkpoint);
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
   * Perform actual kickoff check via API and update database
   */
  private async performKickoffCheck(checkpoint: MatchCheckpoint) {
    try {
      this.recordApiCall();

      // Fetch live match data from API
      const liveMatches = await this.apiFootballService.getLiveMatches();

      // Look for our specific match in live data
      const matchFound = liveMatches.find((match) =>
        this.matchesCheckpoint(match, checkpoint),
      );

      if (matchFound) {
        // Match is live - update database
        await this.updateFixtureStatus(checkpoint.id, 'LIVE');
        checkpoint.kickoffChecked = true;
        checkpoint.status = 'LIVE';

        this.logger.log(
          `✅ Kickoff confirmed: ${checkpoint.homeTeam} vs ${checkpoint.awayTeam} is LIVE`,
        );
      } else {
        // Check if match exists but is finished
        const todayMatches = await this.apiFootballService.getDailyFixtures(
          new Date().toISOString().split('T')[0],
        );

        const finishedMatch = todayMatches.find(
          (match) =>
            this.matchesCheckpoint(match, checkpoint) &&
            (match.status?.short === 'FT' || match.status?.short === 'AET'),
        );

        if (finishedMatch) {
          // Match finished before we could catch it live
          await this.updateFixtureWithResults(checkpoint.id, finishedMatch);
          checkpoint.kickoffChecked = true;
          checkpoint.endChecked = true;
          checkpoint.status = 'FINISHED';

          this.logger.log(
            `⚡ Match already finished: ${checkpoint.homeTeam} vs ${checkpoint.awayTeam}`,
          );
        } else {
          // Match hasn't started yet or not in API data
          checkpoint.kickoffChecked = true; // Mark as checked to avoid repeated checks

          this.logger.warn(
            `⚠️ Match not found in live/finished data: ${checkpoint.homeTeam} vs ${checkpoint.awayTeam}`,
          );
        }
      }
    } catch (error) {
      this.logger.error(
        `Failed kickoff check for ${checkpoint.homeTeam} vs ${checkpoint.awayTeam}`,
        error,
      );
    }
  }

  /**
   * Perform actual end check via API and update database
   */
  private async performEndCheck(checkpoint: MatchCheckpoint) {
    try {
      this.recordApiCall();

      // Fetch daily fixtures to check for finished status
      const todayMatches = await this.apiFootballService.getDailyFixtures(
        new Date().toISOString().split('T')[0],
      );

      const matchData = todayMatches.find((match) =>
        this.matchesCheckpoint(match, checkpoint),
      );

      if (
        matchData &&
        (matchData.status?.short === 'FT' || matchData.status?.short === 'AET')
      ) {
        // Match is finished - update database with final results
        await this.updateFixtureWithResults(checkpoint.id, matchData);
        checkpoint.endChecked = true;
        checkpoint.status = 'FINISHED';

        this.logger.log(
          `🏁 Match completed: ${checkpoint.homeTeam} vs ${checkpoint.awayTeam} - ${matchData.goals?.home || 0}:${matchData.goals?.away || 0}`,
        );
      } else {
        // Match still ongoing or not found
        this.logger.debug(
          `⏳ Match still ongoing: ${checkpoint.homeTeam} vs ${checkpoint.awayTeam}`,
        );
      }
    } catch (error) {
      this.logger.error(
        `Failed end check for ${checkpoint.homeTeam} vs ${checkpoint.awayTeam}`,
        error,
      );
    }
  }

  /**
   * Update fixture status in database
   */
  private async updateFixtureStatus(
    fixtureId: string,
    status: 'LIVE' | 'FINISHED',
  ) {
    try {
      await this.fixtureRepository.update(fixtureId, {
        status,
        updated_at: new Date(),
      });

      this.logger.debug(`Updated fixture ${fixtureId} status to ${status}`);
    } catch (error) {
      this.logger.error(`Failed to update fixture status: ${fixtureId}`, error);
      throw error;
    }
  }

  /**
   * Update fixture with final results (scores, status, result)
   */
  private async updateFixtureWithResults(
    fixtureId: string,
    matchData: ApiFixture,
  ) {
    try {
      const homeScore = matchData.goals?.home || 0;
      const awayScore = matchData.goals?.away || 0;
      const result = this.calculateResult(homeScore, awayScore);

      await this.fixtureRepository.update(fixtureId, {
        status: 'FINISHED',
        home_score: homeScore,
        away_score: awayScore,
        result,
        updated_at: new Date(),
      });

      this.logger.log(
        `Updated fixture ${fixtureId} with final result: ${homeScore}-${awayScore} (${result})`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to update fixture results: ${fixtureId}`,
        error,
      );
      throw error;
    }
  }

  /**
   * Calculate match result (1, X, 2)
   */
  private calculateResult(
    homeScore: number,
    awayScore: number,
  ): '1' | 'X' | '2' {
    if (homeScore > awayScore) return '1'; // Home win
    if (homeScore < awayScore) return '2'; // Away win
    return 'X'; // Draw
  }

  /**
   * Check if API match data matches our checkpoint
   */
  private matchesCheckpoint(
    matchData: ApiFixture,
    checkpoint: MatchCheckpoint,
  ): boolean {
    const homeTeam = matchData.teams?.home?.name || '';
    const awayTeam = matchData.teams?.away?.name || '';

    return (
      (homeTeam.toLowerCase().includes(checkpoint.homeTeam.toLowerCase()) ||
        checkpoint.homeTeam.toLowerCase().includes(homeTeam.toLowerCase())) &&
      (awayTeam.toLowerCase().includes(checkpoint.awayTeam.toLowerCase()) ||
        checkpoint.awayTeam.toLowerCase().includes(awayTeam.toLowerCase()))
    );
  }

  /**
   * Record API call for budget tracking
   */
  private recordApiCall() {
    this.dailyApiCalls++;
    this.cacheService.set(
      'simple-polling:daily-calls',
      this.dailyApiCalls,
      24 * 60 * 60,
    );
    this.logger.debug(
      `📞 API call made (${this.dailyApiCalls}/${this.MAX_DAILY_CALLS})`,
    );
  }

  /**
   * API budget management
   */
  private canMakeApiCall(): boolean {
    return this.dailyApiCalls < this.MAX_DAILY_CALLS;
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

    // Determine what type of check to perform
    if (!checkpoint.kickoffChecked) {
      await this.performKickoffCheck(checkpoint);
    } else if (!checkpoint.endChecked) {
      await this.performEndCheck(checkpoint);
    }

    return {
      success: true,
      message: `Manual check completed for ${checkpoint.homeTeam} vs ${checkpoint.awayTeam}`,
      apiCallsRemaining: this.MAX_DAILY_CALLS - this.dailyApiCalls,
      checkpoint: {
        kickoffChecked: checkpoint.kickoffChecked,
        endChecked: checkpoint.endChecked,
        status: checkpoint.status,
      },
    };
  }
}
