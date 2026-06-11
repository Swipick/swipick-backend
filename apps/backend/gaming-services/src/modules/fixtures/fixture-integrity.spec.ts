import {
  analyzeSeasonIntegrity,
  analyzeWeekIntegrity,
  FixtureSnapshot,
} from './fixture-integrity';

const fixture = (overrides: Partial<FixtureSnapshot>): FixtureSnapshot => ({
  week: 1,
  match_date: new Date('2025-08-23T18:30:00Z'),
  status: 'FINISHED',
  result: '1',
  home_score: 2,
  away_score: 0,
  ...overrides,
});

/** Una giornata completa: 10 partite distribuite su più giorni, tutte finite. */
const completeWeek = (week: number, baseDate: string): FixtureSnapshot[] =>
  Array.from({ length: 10 }, (_, i) =>
    fixture({
      week,
      match_date: new Date(
        new Date(baseDate).getTime() + (i % 4) * 24 * 60 * 60 * 1000,
      ),
    }),
  );

describe('analyzeWeekIntegrity', () => {
  it('reports a healthy past week as complete', () => {
    const report = analyzeWeekIntegrity(35, completeWeek(35, '2026-04-24'), {
      now: new Date('2026-06-01'),
    });

    expect(report.fixtureCount).toBe(10);
    expect(report.missingFixtures).toBe(0);
    expect(report.unresolvedResults).toBe(0);
    expect(report.distinctMatchDays).toBeGreaterThan(1);
    expect(report.issues).toEqual([]);
  });

  it('flags a week with fewer fixtures than expected', () => {
    const report = analyzeWeekIntegrity(
      36,
      completeWeek(36, '2026-05-01').slice(0, 6),
      { now: new Date('2026-06-01') },
    );

    expect(report.missingFixtures).toBe(4);
    expect(report.issues).toContain('MISSING_FIXTURES');
  });

  it('flags past matches without a final result (root cause: backfill window)', () => {
    const matches = completeWeek(37, '2026-05-09').map((m, i) =>
      i < 3
        ? { ...m, status: 'SCHEDULED' as const, result: null, home_score: null, away_score: null }
        : m,
    );
    const report = analyzeWeekIntegrity(37, matches, {
      now: new Date('2026-06-01'),
    });

    expect(report.unresolvedResults).toBe(3);
    expect(report.issues).toContain('UNRESOLVED_PAST_RESULTS');
  });

  it('flags placeholder dates (all matches at the same identical timestamp)', () => {
    // Tutte le 10 partite allo stesso identico orario → sintomo "dal 03/05 al 03/05"
    const sameInstant = Array.from({ length: 10 }, () =>
      fixture({ week: 35, match_date: new Date('2026-05-03T11:00:00Z') }),
    );
    const report = analyzeWeekIntegrity(35, sameInstant, {
      now: new Date('2026-06-01'),
    });

    expect(report.distinctMatchDays).toBe(1);
    expect(report.issues).toContain('PLACEHOLDER_DATES');
  });

  it('does not flag a genuine single-day giornata with different kickoff times', () => {
    // Giornata 37 reale: contemporaneità sull'ultimo turno, orari diversi
    const kickoffs = ['10:00', '13:00', '13:00', '16:00', '16:00', '16:00', '18:45', '18:45', '18:45', '18:45'];
    const sameDay = kickoffs.map((t) =>
      fixture({ week: 37, match_date: new Date(`2026-05-17T${t}:00Z`) }),
    );
    const report = analyzeWeekIntegrity(37, sameDay, {
      now: new Date('2026-06-01'),
    });

    expect(report.distinctMatchDays).toBe(1);
    expect(report.issues).toEqual([]);
  });

  it('does not flag unresolved results for future weeks', () => {
    const future = completeWeek(38, '2026-05-24').map((m) => ({
      ...m,
      status: 'SCHEDULED' as const,
      result: null,
      home_score: null,
      away_score: null,
    }));
    const report = analyzeWeekIntegrity(38, future, {
      now: new Date('2026-05-01'),
    });

    expect(report.unresolvedResults).toBe(0);
    expect(report.issues).not.toContain('UNRESOLVED_PAST_RESULTS');
  });
});

describe('analyzeSeasonIntegrity', () => {
  it('analyzes all 38 weeks and reports only the broken ones', () => {
    const fixtures: FixtureSnapshot[] = [];
    for (let w = 1; w <= 38; w++) {
      if (w === 36) {
        fixtures.push(...completeWeek(w, '2026-05-01').slice(0, 7)); // incompleta
      } else {
        fixtures.push(...completeWeek(w, `2025-0${(w % 8) + 1}-10`));
      }
    }

    const reports = analyzeSeasonIntegrity(fixtures, {
      now: new Date('2026-07-01'),
    });

    expect(reports).toHaveLength(38);
    const broken = reports.filter((r) => r.issues.length > 0);
    expect(broken.map((r) => r.week)).toEqual([36]);
  });

  it('reports weeks entirely absent from the dataset', () => {
    const fixtures = [...completeWeek(1, '2025-08-23'), ...completeWeek(3, '2025-09-13')];
    const reports = analyzeSeasonIntegrity(fixtures, {
      now: new Date('2026-07-01'),
    });

    const week2 = reports.find((r) => r.week === 2);
    expect(week2?.fixtureCount).toBe(0);
    expect(week2?.issues).toContain('MISSING_FIXTURES');
  });
});
