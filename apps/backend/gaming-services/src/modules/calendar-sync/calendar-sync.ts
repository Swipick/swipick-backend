/**
 * Pure calendar-reconciliation logic, shared by the scheduled sync
 * (`calendar-sync.service.ts`) and the manual script
 * (`src/scripts/resync-season-fixtures.ts`).
 *
 * Kept free of Nest and TypeORM so both callers can bring their own I/O — the
 * cron talks to the repository, the script to a raw DataSource — while the
 * matching and diffing rules live in one place and are unit-testable.
 *
 * The reconciliation is keyed on the **round**, never on the date: a fixture
 * whose stored date is wrong cannot be found by searching for that date, which
 * is precisely how placeholder dates used to keep themselves alive.
 */

export type FixtureStatus =
  | 'SCHEDULED'
  | 'LIVE'
  | 'FINISHED'
  | 'POSTPONED'
  | 'CANCELLED';

export type MatchResult = '1' | 'X' | '2';

/** One fixture as returned by API-FOOTBALL, reduced to what we reconcile. */
export interface ApiCalendarFixture {
  apiId: number;
  date: string; // ISO 8601 with offset
  statusShort: string;
  homeTeam: string;
  awayTeam: string;
  homeGoals: number | null;
  awayGoals: number | null;
}

/** One fixture as stored by us. */
export interface DbCalendarFixture {
  id: string;
  home_team: string;
  away_team: string;
  match_date: Date;
  status: string;
  home_score: number | null;
  away_score: number | null;
  result: string | null;
  external_api_id: string | null;
}

/** The new values for a fixture that drifted from the source of truth. */
export interface CalendarUpdate {
  id: string;
  match_date: Date;
  status: FixtureStatus;
  home_score: number | null;
  away_score: number | null;
  result: MatchResult | null;
  external_api_id: string;
  /** Human-readable diff, for logs and for the script's stdout. */
  changes: string[];
  /** True when the kickoff moved at all. */
  dateChanged: boolean;
  /**
   * True when a kickoff within `imminentWindowHours` moved. That is not the
   * league publishing its calendar, it is a postponement — worth a louder log.
   */
  imminent: boolean;
  label: string;
}

export interface CalendarPlan {
  updates: CalendarUpdate[];
  /** API fixtures with no counterpart in our table, by label. */
  unmatched: string[];
  /** Fixtures already in sync. */
  unchanged: number;
}

export interface PlanOptions {
  now?: Date;
  imminentWindowHours?: number;
}

const FINISHED_CODES = new Set(['FT', 'AET', 'PEN']);
const LIVE_CODES = new Set(['1H', 'HT', '2H', 'ET', 'BT', 'P', 'LIVE']);

export const mapApiStatus = (short: string): FixtureStatus => {
  if (FINISHED_CODES.has(short)) return 'FINISHED';
  if (LIVE_CODES.has(short)) return 'LIVE';
  if (short === 'PST') return 'POSTPONED';
  if (short === 'CANC') return 'CANCELLED';
  return 'SCHEDULED';
};

export const computeResult = (
  home: number | null,
  away: number | null,
): MatchResult | null => {
  if (home === null || away === null) return null;
  if (home > away) return '1';
  if (home < away) return '2';
  return 'X';
};

export const externalApiId = (apiId: number): string =>
  `api_football_${apiId}`;

/**
 * Team names differ in punctuation and honorifics between API-FOOTBALL and our
 * table ("AC Milan" / "Milan", "Hellas Verona" / "Verona"). Reduce both sides
 * to bare letters before comparing.
 */
export const normalizeTeamName = (name: string): string =>
  name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\b(ac|as|ss|us|fc|calcio|hellas|1913|1909|1907)\b/g, '')
    .replace(/[^a-z]/g, '');

/**
 * Locate our row for an API fixture: the external id is authoritative, the
 * team-name pair is the fallback for rows seeded before ids were recorded.
 */
export const findDbMatch = (
  api: ApiCalendarFixture,
  dbFixtures: DbCalendarFixture[],
): DbCalendarFixture | undefined => {
  const apiId = externalApiId(api.apiId);
  return (
    dbFixtures.find((f) => f.external_api_id === apiId) ??
    dbFixtures.find(
      (f) =>
        normalizeTeamName(f.home_team) === normalizeTeamName(api.homeTeam) &&
        normalizeTeamName(f.away_team) === normalizeTeamName(api.awayTeam),
    )
  );
};

const isoMinutes = (d: Date): string => d.toISOString().slice(0, 16);

/**
 * Compare one API fixture with our row. Returns null when nothing differs, so
 * a season already in sync produces no writes at all.
 */
export const planFixtureUpdate = (
  api: ApiCalendarFixture,
  db: DbCalendarFixture,
  options: PlanOptions = {},
): CalendarUpdate | null => {
  const now = options.now ?? new Date();
  const windowHours = options.imminentWindowHours ?? 48;

  const status = mapApiStatus(api.statusShort);
  const result =
    status === 'FINISHED'
      ? computeResult(api.homeGoals, api.awayGoals)
      : (db.result as MatchResult | null);
  const matchDate = new Date(api.date);
  const apiId = externalApiId(api.apiId);

  const changes: string[] = [];
  const dateChanged =
    new Date(db.match_date).getTime() !== matchDate.getTime();

  if (dateChanged)
    changes.push(
      `date ${isoMinutes(new Date(db.match_date))} → ${isoMinutes(matchDate)}`,
    );
  if (db.status !== status) changes.push(`status ${db.status} → ${status}`);
  if (db.home_score !== api.homeGoals || db.away_score !== api.awayGoals)
    changes.push(
      `score ${db.home_score ?? '-'}–${db.away_score ?? '-'} → ${api.homeGoals ?? '-'}–${api.awayGoals ?? '-'}`,
    );
  if (db.result !== result)
    changes.push(`result ${db.result ?? '-'} → ${result ?? '-'}`);
  if (db.external_api_id !== apiId) changes.push(`external_api_id → ${apiId}`);

  if (changes.length === 0) return null;

  // A move counts as imminent if either the old or the new kickoff sits inside
  // the window: both "brought forward" and "pushed back" are postponements.
  const windowMs = windowHours * 60 * 60 * 1000;
  const withinWindow = (d: Date): boolean => {
    const delta = d.getTime() - now.getTime();
    return delta >= 0 && delta <= windowMs;
  };
  const imminent =
    dateChanged &&
    (withinWindow(new Date(db.match_date)) || withinWindow(matchDate));

  return {
    id: db.id,
    match_date: matchDate,
    status,
    home_score: api.homeGoals,
    away_score: api.awayGoals,
    result,
    external_api_id: apiId,
    changes,
    dateChanged,
    imminent,
    label: `${db.home_team} vs ${db.away_team}`,
  };
};

/** Plan the updates for one round. */
export const planRoundUpdates = (
  apiFixtures: ApiCalendarFixture[],
  dbFixtures: DbCalendarFixture[],
  options: PlanOptions = {},
): CalendarPlan => {
  const updates: CalendarUpdate[] = [];
  const unmatched: string[] = [];
  let unchanged = 0;

  for (const api of apiFixtures) {
    const db = findDbMatch(api, dbFixtures);
    if (!db) {
      unmatched.push(`${api.homeTeam} vs ${api.awayTeam}`);
      continue;
    }

    const update = planFixtureUpdate(api, db, options);
    if (update) updates.push(update);
    else unchanged++;
  }

  return { updates, unmatched, unchanged };
};

/** The API-FOOTBALL round label for a Serie A giornata. */
export const roundLabel = (week: number): string =>
  `Regular Season - ${week}`;
