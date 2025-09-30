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
  private readonly MAX_DAILY_CALLS = 500; // Pro plan allows 7500/day, using 500 for safety
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

      // STEP 1: Backfill past matches with NULL scores (automatic catch-up)
      await this.backfillPastMatches();

      // STEP 2: Load and monitor upcoming matches (database only)
      await this.loadUpcomingMatches();

      // STEP 3: Process checkpoints for matches that need API calls now
      if (this.activeMatches.size > 0) {
        this.logger.debug(
          `Processing ${this.activeMatches.size} active match checkpoints`,
        );
        await this.processCheckpoints();
      }

      this.logger.debug(
        `Polling cycle completed. API calls today: ${this.dailyApiCalls}/${this.MAX_DAILY_CALLS}`,
      );
    } catch (error) {
      this.logger.error('Simple polling failed', error);
    }
  }

  /**
   * STEP 1: Backfill past matches with NULL scores
   * Runs every 5 minutes to catch any missed results
   */
  private async backfillPastMatches() {
    try {
      const now = new Date();
      const tenDaysAgo = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000);

      // Find past matches with NULL scores that need updating
      const pastMatchesNeedingUpdate = await this.fixtureRepository
        .createQueryBuilder('fixture')
        .where('fixture.match_date < :now', { now })
        .andWhere('fixture.match_date > :tenDaysAgo', { tenDaysAgo })
        .andWhere('(fixture.home_score IS NULL OR fixture.away_score IS NULL)')
        .andWhere('fixture.status = :status', { status: 'SCHEDULED' })
        .orderBy('fixture.match_date', 'ASC')
        .limit(10) // Process max 10 at a time to avoid API overload
        .getMany();

      if (pastMatchesNeedingUpdate.length > 0) {
        this.logger.log(
          `🔄 BACKFILL: Found ${pastMatchesNeedingUpdate.length} past matches needing score updates`,
        );

        for (const fixture of pastMatchesNeedingUpdate) {
          if (!this.canMakeApiCall()) {
            this.logger.warn('⚠️ Cannot backfill - API limit reached');
            break;
          }

          this.logger.log(
            `📊 Backfilling scores for: ${fixture.home_team} vs ${fixture.away_team} (${fixture.match_date})`,
          );

          // Fetch the match results from API
          await this.fetchAndUpdateMatchResults(fixture);
        }
      }
    } catch (error) {
      this.logger.error('Backfill failed', error);
    }
  }

  /**
   * STEP 2: Load upcoming matches for monitoring
   * Only tracks them in memory, no API calls unless at checkpoint
   */
  private async loadUpcomingMatches() {
    try {
      const now = new Date();
      const tenDaysAhead = new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000);

      // Get upcoming matches from database (next 10 days)
      const upcomingMatches = await this.fixtureRepository
        .createQueryBuilder('fixture')
        .where('fixture.match_date >= :now', { now })
        .andWhere('fixture.match_date <= :tenDaysAhead', { tenDaysAhead })
        .andWhere('fixture.status != :finished', { finished: 'FINISHED' })
        .orderBy('fixture.match_date', 'ASC')
        .limit(10)
        .getMany();

      if (upcomingMatches.length > 0) {
        this.logger.debug(
          `📅 Monitoring ${upcomingMatches.length} upcoming matches`,
        );
      }

      // Clear old matches from tracking
      this.activeMatches.clear();

      // Add upcoming matches to active monitoring
      for (const fixture of upcomingMatches) {
        const matchTime = new Date(fixture.match_date);
        const timeDiff = matchTime.getTime() - now.getTime();
        const minutesUntilMatch = timeDiff / (1000 * 60);

        // Only actively track matches that are within checkpoint window
        // (5 minutes before kickoff to 105 minutes after)
        if (minutesUntilMatch <= this.KICKOFF_BUFFER_MINUTES + 105) {
          this.activeMatches.set(fixture.id, {
            id: fixture.id,
            homeTeam: fixture.home_team,
            awayTeam: fixture.away_team,
            scheduledTime: matchTime,
            kickoffChecked: fixture.status === 'LIVE',
            endChecked: false,
            status: fixture.status as any,
          });

          this.logger.debug(
            `⏰ Active checkpoint: ${fixture.home_team} vs ${fixture.away_team} in ${Math.round(minutesUntilMatch)} minutes`,
          );
        }
      }
    } catch (error) {
      this.logger.error('Failed to load upcoming matches', error);
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
   * Fetch and update match results for backfilling
   */
  private async fetchAndUpdateMatchResults(fixture: Fixture) {
    try {
      this.recordApiCall();

      // Fetch match data from API using the date
      const matchDate = new Date(fixture.match_date)
        .toISOString()
        .split('T')[0];
      const matches = await this.apiFootballService.getDailyFixtures(matchDate);

      // Find the specific match
      const matchData = matches.find(
        (m) =>
          (m.teams?.home?.name === fixture.home_team ||
            m.teams?.home?.name.includes(fixture.home_team) ||
            fixture.home_team.includes(m.teams?.home?.name)) &&
          (m.teams?.away?.name === fixture.away_team ||
            m.teams?.away?.name.includes(fixture.away_team) ||
            fixture.away_team.includes(m.teams?.away?.name)),
      );

      if (matchData && matchData.status?.short === 'FT') {
        // Update the fixture with results
        await this.fixtureRepository.update(fixture.id, {
          status: 'FINISHED',
          home_score: matchData.goals?.home || 0,
          away_score: matchData.goals?.away || 0,
          result: this.calculateResult(
            matchData.goals?.home || 0,
            matchData.goals?.away || 0,
          ),
          updated_at: new Date(),
        });

        this.logger.log(
          `✅ BACKFILLED: ${fixture.home_team} vs ${fixture.away_team} - Final: ${matchData.goals?.home || 0}-${matchData.goals?.away || 0}`,
        );
      } else if (!matchData) {
        this.logger.warn(
          `⚠️ Match not found in API: ${fixture.home_team} vs ${fixture.away_team} on ${matchDate}`,
        );
      }
    } catch (error) {
      this.logger.error(
        `Failed to backfill ${fixture.home_team} vs ${fixture.away_team}`,
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
