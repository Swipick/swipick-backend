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
  private readonly MAX_DAILY_CALLS = 7000; // Pro plan allows 10k/day, using 7000 for safety margin
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
      '[SIMPLE_MATCH_POLLING_INIT] Version: V4_CONTINUOUS_LIVE_POLLING_20251122',
    );
    this.logger.log(
      '[SIMPLE_MATCH_POLLING_INIT] Fix: Continuous polling for LIVE matches every 5 min',
    );
    this.logger.log(
      '[SIMPLE_MATCH_POLLING_INIT] Feature: Real-time score updates, 7000 API quota, 5min cache',
    );
    this.logger.log(
      '[SIMPLE_MATCH_POLLING_INIT] Debug: Shows match status and scores in logs',
    );
    this.logger.log('='.repeat(80));
  }

  /**
   * Main polling orchestrator - runs every 2 minutes
   */
  @Cron('*/2 * * * *', {
    name: 'simpleMatchPolling',
    timeZone: 'Europe/Rome',
  })
  async checkMatchCheckpoints() {
    if (process.env.DISABLE_LIVE_UPDATES === 'true') {
      return;
    }

    // Log version on every run to confirm deployment
    this.logger.log('📌 Running polling V4_CONTINUOUS_LIVE_POLLING_20251122');

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

      // STEP 4: Continuous polling for LIVE matches - update scores in real-time
      await this.pollLiveMatches();

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

      this.logger.log(
        `🔍 [BACKFILL_QUERY] Searching for past matches with NULL scores...`,
      );
      this.logger.log(
        `🔍 [BACKFILL_QUERY] Date range: ${tenDaysAgo.toISOString()} to ${now.toISOString()}`,
      );

      // First, check ALL past matches with NULL scores (regardless of status)
      const allPastMatchesWithNullScores = await this.fixtureRepository
        .createQueryBuilder('fixture')
        .where('fixture.match_date < :now', { now })
        .andWhere('fixture.match_date > :tenDaysAgo', { tenDaysAgo })
        .andWhere('(fixture.home_score IS NULL OR fixture.away_score IS NULL)')
        .orderBy('fixture.match_date', 'ASC')
        .limit(20)
        .getMany();

      this.logger.log(
        `🔍 [BACKFILL_QUERY] Found ${allPastMatchesWithNullScores.length} past matches with NULL scores (any status)`,
      );

      if (allPastMatchesWithNullScores.length > 0) {
        this.logger.log(`🔍 [BACKFILL_QUERY] Match details:`);
        allPastMatchesWithNullScores.forEach((m, idx) => {
          this.logger.log(
            `🔍 [BACKFILL_QUERY] ${idx + 1}. ${m.home_team} vs ${m.away_team} - Status: ${m.status}, Date: ${m.match_date}, HomeScore: ${m.home_score}, AwayScore: ${m.away_score}`,
          );
        });
      }

      // Find past matches with NULL scores that need updating (any status except FINISHED)
      const pastMatchesNeedingUpdate = await this.fixtureRepository
        .createQueryBuilder('fixture')
        .where('fixture.match_date < :now', { now })
        .andWhere('fixture.match_date > :tenDaysAgo', { tenDaysAgo })
        .andWhere('(fixture.home_score IS NULL OR fixture.away_score IS NULL)')
        .andWhere('fixture.status != :finished', { finished: 'FINISHED' })
        .orderBy('fixture.match_date', 'ASC')
        .limit(10) // Process max 10 at a time to avoid API overload
        .getMany();

      this.logger.log(
        `🔍 [BACKFILL_QUERY] Found ${pastMatchesNeedingUpdate.length} past matches with NULL scores (status != FINISHED) that need backfill`,
      );

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
      this.logger.log(
        `🔍 [BACKFILL_START] Processing: ${fixture.home_team} vs ${fixture.away_team}`,
      );
      this.logger.log(
        `🔍 [BACKFILL_START] Fixture ID: ${fixture.id}, Date: ${fixture.match_date}, Current Status: ${fixture.status}, Home Score: ${fixture.home_score}, Away Score: ${fixture.away_score}`,
      );

      this.recordApiCall();

      // Fetch match data from API using the date
      const matchDate = new Date(fixture.match_date);
      const dateStr = matchDate.toISOString().split('T')[0];

      // Also prepare previous day to handle timezone issues
      const prevDate = new Date(matchDate);
      prevDate.setDate(prevDate.getDate() - 1);
      const prevDateStr = prevDate.toISOString().split('T')[0];

      this.logger.log(
        `🔍 [BACKFILL_API_CALL] Fetching fixtures for date: ${dateStr} (also checking ${prevDateStr} for timezone issues)`,
      );

      // First try the stored date
      const matches = await this.apiFootballService.getDailyFixtures(dateStr);

      this.logger.log(
        `🔍 [BACKFILL_API_RESPONSE] API returned ${matches.length} matches for ${dateStr}. Looking for: ${fixture.home_team} vs ${fixture.away_team}`,
      );

      // Log all matches returned to help debug
      matches.forEach((m: any, idx) => {
        // Fixture interface has status at root level (transformed by getFixtures)
        const status = m.status?.short || 'NO_STATUS';
        const homeTeam = m.teams?.home?.name || 'Unknown';
        const awayTeam = m.teams?.away?.name || 'Unknown';
        const homeScore = m.goals?.home;
        const awayScore = m.goals?.away;

        this.logger.log(
          `🔍 [BACKFILL_API_MATCH_${idx + 1}] ${homeTeam} vs ${awayTeam} - Status: ${status}, Score: ${homeScore}-${awayScore}`,
        );
      });

      // Find the specific match with more flexible matching
      this.logger.log(
        `🔍 [BACKFILL_MATCHING] Attempting to find match in API response...`,
      );

      let matchData = matches.find(
        (m) =>
          (m.teams?.home?.name === fixture.home_team ||
            m.teams?.home?.name.includes(fixture.home_team) ||
            fixture.home_team.includes(m.teams?.home?.name)) &&
          (m.teams?.away?.name === fixture.away_team ||
            m.teams?.away?.name.includes(fixture.away_team) ||
            fixture.away_team.includes(m.teams?.away?.name)),
      );

      // If not found and dates are different, try previous day (timezone issue fix)
      if (!matchData && dateStr !== prevDateStr) {
        this.logger.log(
          `🔍 [BACKFILL_RETRY] Match not found on ${dateStr}, checking previous day ${prevDateStr} for timezone issues...`,
        );

        this.recordApiCall();
        const prevDayMatches =
          await this.apiFootballService.getDailyFixtures(prevDateStr);

        this.logger.log(
          `🔍 [BACKFILL_RETRY_RESPONSE] API returned ${prevDayMatches.length} matches for ${prevDateStr}`,
        );

        // Log matches from previous day
        prevDayMatches.forEach((m: any, idx) => {
          const status = m.status?.short || 'NO_STATUS';
          const homeTeam = m.teams?.home?.name || 'Unknown';
          const awayTeam = m.teams?.away?.name || 'Unknown';
          const homeScore = m.goals?.home;
          const awayScore = m.goals?.away;

          this.logger.log(
            `🔍 [BACKFILL_RETRY_MATCH_${idx + 1}] ${homeTeam} vs ${awayTeam} - Status: ${status}, Score: ${homeScore}-${awayScore}`,
          );
        });

        matchData = prevDayMatches.find(
          (m) =>
            (m.teams?.home?.name === fixture.home_team ||
              m.teams?.home?.name.includes(fixture.home_team) ||
              fixture.home_team.includes(m.teams?.home?.name)) &&
            (m.teams?.away?.name === fixture.away_team ||
              m.teams?.away?.name.includes(fixture.away_team) ||
              fixture.away_team.includes(m.teams?.away?.name)),
        );

        if (matchData) {
          this.logger.log(
            `✅ [BACKFILL_FOUND_PREV_DAY] Match found on previous day! Timezone issue detected and resolved.`,
          );
        }
      }

      if (!matchData) {
        this.logger.warn(
          `⚠️ [BACKFILL_NO_MATCH] Match not found in API response!`,
        );
        this.logger.warn(
          `⚠️ [BACKFILL_NO_MATCH] Searching for: ${fixture.home_team} vs ${fixture.away_team}`,
        );
        this.logger.warn(
          `⚠️ [BACKFILL_NO_MATCH] Database has home_team='${fixture.home_team}' away_team='${fixture.away_team}'`,
        );
        return;
      }

      // Fixture interface has status at root level (transformed by getFixtures)
      const status = matchData?.status?.short;
      const homeScore = matchData.goals?.home;
      const awayScore = matchData.goals?.away;

      this.logger.log(
        `🔍 [BACKFILL_MATCH_FOUND] Match found in API! Home: ${matchData.teams?.home?.name}, Away: ${matchData.teams?.away?.name}, Status: ${status}, Score: ${homeScore}-${awayScore}`,
      );

      // Check if match hasn't started yet
      if (status === 'NS' || status === 'TBD' || status === 'SUSP') {
        this.logger.warn(
          `⏰ [BACKFILL_NOT_STARTED] Match ${fixture.home_team} vs ${fixture.away_team} has not started yet. Status: ${status}. Skipping backfill.`,
        );

        // Log detailed status for monitoring
        this.logger.log(
          `📊 [BACKFILL_NS_DETAILS] Match ID: ${fixture.id}, API Status: ${status}, Scheduled: ${fixture.match_date}, Current Time: ${new Date().toISOString()}`,
        );

        // Mark for future retry if needed
        this.logger.log(
          `🔄 [BACKFILL_QUEUE] Match will be checked again in future backfill runs once it has been played`,
        );

        return; // Skip this match
      }

      if (status === 'FT' || status === 'AET' || status === 'PEN') {
        this.logger.log(
          `🔍 [BACKFILL_UPDATE_START] Match is finished (${status}). Updating database...`,
        );

        // Update the fixture with results
        const finalHomeScore = homeScore ?? 0;
        const finalAwayScore = awayScore ?? 0;

        const updateResult = await this.fixtureRepository.update(fixture.id, {
          status: 'FINISHED',
          home_score: finalHomeScore,
          away_score: finalAwayScore,
          result: this.calculateResult(finalHomeScore, finalAwayScore),
          updated_at: new Date(),
        });

        this.logger.log(
          `🔍 [BACKFILL_UPDATE_RESULT] Database update result: ${JSON.stringify(updateResult)}`,
        );

        this.logger.log(
          `✅ [BACKFILL_SUCCESS] ${fixture.home_team} vs ${fixture.away_team} - Final: ${finalHomeScore}-${finalAwayScore}`,
        );
      } else {
        this.logger.warn(
          `⚠️ [BACKFILL_NOT_FINISHED] Match found but status is '${status}' (not FT/AET/PEN) for ${fixture.home_team} vs ${fixture.away_team}`,
        );
      }
    } catch (error) {
      this.logger.error(
        `❌ [BACKFILL_ERROR] Failed to backfill ${fixture.home_team} vs ${fixture.away_team}`,
        error,
      );
      this.logger.error(`❌ [BACKFILL_ERROR] Error stack: ${error.stack}`);
    }
  }

  /**
   * STEP 4: Continuous polling for LIVE matches
   * Polls the API for all Serie A matches and updates any that have finished
   * This ensures we catch match completion within 5 minutes
   */
  private async pollLiveMatches() {
    try {
      // First, check if we have any LIVE matches in our database
      const liveMatchesInDb = await this.fixtureRepository
        .createQueryBuilder('fixture')
        .where('fixture.status = :status', { status: 'LIVE' })
        .getMany();

      // Also check for matches that should have started by now but are still SCHEDULED
      const now = new Date();
      const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);

      const shouldBePlayingMatches = await this.fixtureRepository
        .createQueryBuilder('fixture')
        .where('fixture.status = :status', { status: 'SCHEDULED' })
        .andWhere('fixture.match_date < :now', { now })
        .andWhere('fixture.match_date > :twoHoursAgo', { twoHoursAgo })
        .getMany();

      const matchesToCheck = [...liveMatchesInDb, ...shouldBePlayingMatches];

      if (matchesToCheck.length === 0) {
        this.logger.debug(
          '🔄 [LIVE_POLL] No LIVE or recently started matches to poll',
        );
        return;
      }

      this.logger.log(
        `🔄 [LIVE_POLL] Found ${liveMatchesInDb.length} LIVE + ${shouldBePlayingMatches.length} should-be-playing matches to check`,
      );

      if (!this.canMakeApiCall()) {
        this.logger.warn('⚠️ [LIVE_POLL] Cannot poll - API limit reached');
        return;
      }

      // Group matches by date to minimize API calls
      const matchesByDate = new Map<string, typeof matchesToCheck>();
      for (const fixture of matchesToCheck) {
        const matchDate = new Date(fixture.match_date)
          .toISOString()
          .split('T')[0];
        if (!matchesByDate.has(matchDate)) {
          matchesByDate.set(matchDate, []);
        }
        matchesByDate.get(matchDate)!.push(fixture);
      }

      this.logger.log(
        `🔄 [LIVE_POLL] Need to check ${matchesByDate.size} different dates`,
      );

      // Process each date
      for (const [date, fixtures] of matchesByDate.entries()) {
        if (!this.canMakeApiCall()) {
          this.logger.warn('⚠️ [LIVE_POLL] API limit reached mid-polling');
          break;
        }

        this.recordApiCall();
        const apiMatches = await this.apiFootballService.getDailyFixtures(date);

        this.logger.log(
          `🔄 [LIVE_POLL] API returned ${apiMatches.length} matches for ${date}`,
        );

        // Process each match for this date
        for (const dbFixture of fixtures) {
          // Find matching API data
          const apiMatch = apiMatches.find(
            (m) =>
              (m.teams?.home?.name === dbFixture.home_team ||
                m.teams?.home?.name?.includes(dbFixture.home_team) ||
                dbFixture.home_team.includes(m.teams?.home?.name || '')) &&
              (m.teams?.away?.name === dbFixture.away_team ||
                m.teams?.away?.name?.includes(dbFixture.away_team) ||
                dbFixture.away_team.includes(m.teams?.away?.name || '')),
          );

          if (!apiMatch) {
            this.logger.debug(
              `🔄 [LIVE_POLL] No API match found for ${dbFixture.home_team} vs ${dbFixture.away_team}`,
            );
            continue;
          }

          const apiStatus = apiMatch.status?.short;
          const homeScore = apiMatch.goals?.home;
          const awayScore = apiMatch.goals?.away;

          this.logger.log(
            `🔄 [LIVE_POLL] ${dbFixture.home_team} vs ${dbFixture.away_team}: API status=${apiStatus}, score=${homeScore}-${awayScore}, DB status=${dbFixture.status}`,
          );

          // Update based on API status
          if (
            apiStatus === 'FT' ||
            apiStatus === 'AET' ||
            apiStatus === 'PEN'
          ) {
            // Match has finished - update with final scores
            const finalHomeScore = homeScore ?? 0;
            const finalAwayScore = awayScore ?? 0;
            const result = this.calculateResult(finalHomeScore, finalAwayScore);

            await this.fixtureRepository.update(dbFixture.id, {
              status: 'FINISHED',
              home_score: finalHomeScore,
              away_score: finalAwayScore,
              result,
              updated_at: new Date(),
            });

            this.logger.log(
              `✅ [LIVE_POLL] MATCH FINISHED: ${dbFixture.home_team} ${finalHomeScore}-${finalAwayScore} ${dbFixture.away_team} (${result})`,
            );
          } else if (
            ['1H', '2H', 'HT', 'ET', 'BT', 'P'].includes(apiStatus || '')
          ) {
            // Match is live - update status and current scores
            if (dbFixture.status !== 'LIVE') {
              await this.fixtureRepository.update(dbFixture.id, {
                status: 'LIVE',
                home_score: homeScore ?? 0,
                away_score: awayScore ?? 0,
                updated_at: new Date(),
              });

              this.logger.log(
                `🟢 [LIVE_POLL] Match now LIVE: ${dbFixture.home_team} ${homeScore ?? 0}-${awayScore ?? 0} ${dbFixture.away_team}`,
              );
            } else {
              // Update live scores
              await this.fixtureRepository.update(dbFixture.id, {
                home_score: homeScore ?? 0,
                away_score: awayScore ?? 0,
                updated_at: new Date(),
              });

              this.logger.debug(
                `🔄 [LIVE_POLL] Updated live scores: ${dbFixture.home_team} ${homeScore ?? 0}-${awayScore ?? 0} ${dbFixture.away_team}`,
              );
            }
          }
        }
      }
    } catch (error) {
      this.logger.error('❌ [LIVE_POLL] Failed to poll live matches', error);
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
