import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ApiFootballService } from '../api-football/api-football.service';
import { SeasonConfigService } from '../season/season-config.service';
import { Fixture as FixtureEntity } from '../../entities/fixture.entity';
import {
  ApiCalendarFixture,
  CalendarUpdate,
  planRoundUpdates,
  roundLabel,
} from './calendar-sync';

const SERIE_A_LEAGUE_ID = 135;
const TOTAL_WEEKS = 38;

export interface CalendarSyncSummary {
  season: number;
  weeksProcessed: number;
  updated: number;
  unchanged: number;
  unmatched: string[];
  failedWeeks: number[];
  postponements: string[];
}

/**
 * Keeps our fixtures table aligned with the league calendar.
 *
 * Serie A kickoff dates are not known when the season is imported: API-FOOTBALL
 * publishes a provisional calendar with every match of a round stamped on the
 * same placeholder slot, and the real dates land a handful of rounds at a time
 * as the broadcaster assigns them. A one-off import is therefore wrong by
 * construction, and stays wrong — the live poller looks for matches by date, so
 * a fixture with a placeholder date is never visited and never corrected.
 *
 * This sync breaks that loop by reconciling **per round** rather than per date.
 */
@Injectable()
export class CalendarSyncService {
  private readonly logger = new Logger(CalendarSyncService.name);
  private running = false;

  constructor(
    @InjectRepository(FixtureEntity)
    private readonly fixtureRepository: Repository<FixtureEntity>,
    private readonly apiFootball: ApiFootballService,
    private readonly seasonConfig: SeasonConfigService,
  ) {}

  /**
   * 04:00 UTC: no match is ever in play, and any date published overnight is
   * in place before the first users open the app.
   */
  @Cron('0 0 4 * * *', { name: 'syncSeasonCalendar', timeZone: 'UTC' })
  async scheduledSync(): Promise<void> {
    if (process.env.DISABLE_LIVE_UPDATES === 'true') {
      this.logger.debug(
        'Calendar sync disabled via DISABLE_LIVE_UPDATES env var',
      );
      return;
    }

    try {
      await this.syncSeason();
    } catch (error) {
      this.logger.error('Scheduled calendar sync failed', error);
    }
  }

  /**
   * Reconcile the given weeks of a season. Each round is independent: a round
   * that fails to fetch is reported and skipped, it does not abort the rest.
   */
  async syncSeason(
    season: number = this.seasonConfig.getCurrentSeason(),
    weeks: number[] = Array.from({ length: TOTAL_WEEKS }, (_, i) => i + 1),
  ): Promise<CalendarSyncSummary> {
    if (this.running) {
      this.logger.warn('Calendar sync already running — skipping this run');
      return {
        season,
        weeksProcessed: 0,
        updated: 0,
        unchanged: 0,
        unmatched: [],
        failedWeeks: [],
        postponements: [],
      };
    }
    this.running = true;

    const summary: CalendarSyncSummary = {
      season,
      weeksProcessed: 0,
      updated: 0,
      unchanged: 0,
      unmatched: [],
      failedWeeks: [],
      postponements: [],
    };

    try {
      this.logger.log(`Starting calendar sync for season ${season}`);

      for (const week of weeks) {
        try {
          const applied = await this.syncWeek(season, week);
          summary.weeksProcessed++;
          summary.updated += applied.updates.length;
          summary.unchanged += applied.unchanged;
          summary.unmatched.push(
            ...applied.unmatched.map((label) => `g.${week}: ${label}`),
          );
          summary.postponements.push(
            ...applied.updates
              .filter((u) => u.imminent)
              .map((u) => `g.${week}: ${u.label} — ${u.changes[0]}`),
          );
        } catch (error) {
          summary.failedWeeks.push(week);
          this.logger.error(
            `Calendar sync failed for week ${week}`,
            error instanceof Error ? error.message : error,
          );
        }
      }

      this.logger.log(
        `Calendar sync done — season ${season}: ${summary.updated} updated, ` +
          `${summary.unchanged} already in sync, ${summary.weeksProcessed}/${weeks.length} rounds processed`,
      );

      // A kickoff moving inside the next 48h is not the league publishing its
      // calendar, it is a postponement: surface it rather than bury it.
      for (const postponement of summary.postponements) {
        this.logger.warn(`Kickoff moved within 48h — ${postponement}`);
      }
      if (summary.unmatched.length > 0) {
        this.logger.warn(
          `Fixtures returned by the API with no row in our table: ${summary.unmatched.join(', ')}`,
        );
      }
      if (summary.failedWeeks.length > 0) {
        this.logger.warn(
          `Rounds skipped after an error: ${summary.failedWeeks.join(', ')}`,
        );
      }

      return summary;
    } finally {
      this.running = false;
    }
  }

  private async syncWeek(
    season: number,
    week: number,
  ): Promise<{
    updates: CalendarUpdate[];
    unchanged: number;
    unmatched: string[];
  }> {
    const apiFixtures = await this.fetchRound(season, week);
    if (apiFixtures.length === 0) {
      return { updates: [], unchanged: 0, unmatched: [] };
    }

    const dbFixtures = await this.fixtureRepository.find({
      where: { season, week },
    });

    const plan = planRoundUpdates(apiFixtures, dbFixtures);

    for (const update of plan.updates) {
      await this.fixtureRepository.update(update.id, {
        match_date: update.match_date,
        status: update.status,
        home_score: update.home_score,
        away_score: update.away_score,
        result: update.result,
        external_api_id: update.external_api_id,
      });
      this.logger.log(`g.${week} ${update.label}: ${update.changes.join(', ')}`);
    }

    return {
      updates: plan.updates,
      unchanged: plan.unchanged,
      unmatched: plan.unmatched,
    };
  }

  private async fetchRound(
    season: number,
    week: number,
  ): Promise<ApiCalendarFixture[]> {
    const fixtures = await this.apiFootball.getFixtures({
      league: SERIE_A_LEAGUE_ID,
      season,
      round: roundLabel(week),
    });

    return fixtures.map((f) => ({
      apiId: f.id,
      date: f.date,
      statusShort: f.status.short,
      homeTeam: f.teams.home.name,
      awayTeam: f.teams.away.name,
      homeGoals: f.goals.home ?? null,
      awayGoals: f.goals.away ?? null,
    }));
  }
}
