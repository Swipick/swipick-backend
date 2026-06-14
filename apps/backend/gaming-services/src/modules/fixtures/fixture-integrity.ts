/**
 * Pure data-integrity analysis for season fixtures.
 *
 * Used by the integrity spec (CI regression) and by the diagnostic script
 * `src/scripts/check-fixtures-integrity.ts` to locate the root cause of
 * missing/stale results in the Risultati page.
 */

export interface FixtureSnapshot {
  week: number;
  match_date: Date;
  status: 'SCHEDULED' | 'LIVE' | 'FINISHED' | 'POSTPONED' | 'CANCELLED';
  result: '1' | 'X' | '2' | null;
  home_score: number | null;
  away_score: number | null;
}

export type WeekIssue =
  | 'MISSING_FIXTURES'
  | 'UNRESOLVED_PAST_RESULTS'
  | 'PLACEHOLDER_DATES';

export interface WeekIntegrityReport {
  week: number;
  fixtureCount: number;
  missingFixtures: number;
  /** Past matches still without a final result (status/result/score not settled). */
  unresolvedResults: number;
  distinctMatchDays: number;
  firstMatch: Date | null;
  lastMatch: Date | null;
  issues: WeekIssue[];
}

export interface IntegrityOptions {
  /** Reference time used to decide whether a match is in the past. */
  now?: Date;
  /** Expected matches per week (Serie A: 10). */
  expectedPerWeek?: number;
  /** Total weeks in the season (Serie A: 38). */
  totalWeeks?: number;
}

const dayKey = (d: Date): string => d.toISOString().slice(0, 10);

export const analyzeWeekIntegrity = (
  week: number,
  fixtures: FixtureSnapshot[],
  options: IntegrityOptions = {},
): WeekIntegrityReport => {
  const now = options.now ?? new Date();
  const expected = options.expectedPerWeek ?? 10;

  const times = fixtures.map((f) => f.match_date.getTime());
  const distinctDays = new Set(fixtures.map((f) => dayKey(f.match_date)));

  const unresolved = fixtures.filter(
    (f) =>
      f.match_date.getTime() < now.getTime() &&
      f.status !== 'POSTPONED' &&
      f.status !== 'CANCELLED' &&
      (f.status !== 'FINISHED' ||
        f.result === null ||
        f.home_score === null ||
        f.away_score === null),
  );

  const report: WeekIntegrityReport = {
    week,
    fixtureCount: fixtures.length,
    missingFixtures: Math.max(0, expected - fixtures.length),
    unresolvedResults: unresolved.length,
    distinctMatchDays: distinctDays.size,
    firstMatch: times.length ? new Date(Math.min(...times)) : null,
    lastMatch: times.length ? new Date(Math.max(...times)) : null,
    issues: [],
  };

  if (report.missingFixtures > 0) report.issues.push('MISSING_FIXTURES');
  if (report.unresolvedResults > 0)
    report.issues.push('UNRESOLVED_PAST_RESULTS');
  // A genuine single-day giornata (contemporaneità) has different kickoff
  // times; seed placeholders put every match at the same identical instant.
  const distinctInstants = new Set(times);
  if (fixtures.length >= 2 && distinctInstants.size === 1) {
    report.issues.push('PLACEHOLDER_DATES');
  }

  return report;
};

export const analyzeSeasonIntegrity = (
  fixtures: FixtureSnapshot[],
  options: IntegrityOptions = {},
): WeekIntegrityReport[] => {
  const totalWeeks = options.totalWeeks ?? 38;
  const byWeek = new Map<number, FixtureSnapshot[]>();
  for (const f of fixtures) {
    const list = byWeek.get(f.week) ?? [];
    list.push(f);
    byWeek.set(f.week, list);
  }

  const reports: WeekIntegrityReport[] = [];
  for (let week = 1; week <= totalWeeks; week++) {
    reports.push(analyzeWeekIntegrity(week, byWeek.get(week) ?? [], options));
  }
  return reports;
};
