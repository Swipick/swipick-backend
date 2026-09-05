import {
  ApiCalendarFixture,
  DbCalendarFixture,
  computeResult,
  findDbMatch,
  mapApiStatus,
  normalizeTeamName,
  planFixtureUpdate,
  planRoundUpdates,
  roundLabel,
} from './calendar-sync';

const api = (over: Partial<ApiCalendarFixture> = {}): ApiCalendarFixture => ({
  apiId: 1550097,
  date: '2026-08-28T18:45:00+00:00',
  statusShort: 'NS',
  homeTeam: 'AC Milan',
  awayTeam: 'Venezia',
  homeGoals: null,
  awayGoals: null,
  ...over,
});

const db = (over: Partial<DbCalendarFixture> = {}): DbCalendarFixture => ({
  id: 'fixture-uuid',
  home_team: 'AC Milan',
  away_team: 'Venezia',
  match_date: new Date('2026-08-28T18:45:00Z'),
  status: 'SCHEDULED',
  home_score: null,
  away_score: null,
  result: null,
  external_api_id: 'api_football_1550097',
  ...over,
});

describe('mapApiStatus', () => {
  it('treats every finished code as FINISHED', () => {
    expect(mapApiStatus('FT')).toBe('FINISHED');
    expect(mapApiStatus('AET')).toBe('FINISHED');
    expect(mapApiStatus('PEN')).toBe('FINISHED');
  });

  it('maps postponed and cancelled distinctly, not to SCHEDULED', () => {
    expect(mapApiStatus('PST')).toBe('POSTPONED');
    expect(mapApiStatus('CANC')).toBe('CANCELLED');
  });

  it('falls back to SCHEDULED for codes it does not know', () => {
    expect(mapApiStatus('NS')).toBe('SCHEDULED');
    expect(mapApiStatus('TBD')).toBe('SCHEDULED');
  });
});

describe('computeResult', () => {
  it('reads the sign of the scoreline', () => {
    expect(computeResult(2, 0)).toBe('1');
    expect(computeResult(0, 4)).toBe('2');
    expect(computeResult(1, 1)).toBe('X');
  });

  it('is null while a score is missing, never a draw', () => {
    expect(computeResult(null, 0)).toBeNull();
    expect(computeResult(1, null)).toBeNull();
  });
});

describe('normalizeTeamName', () => {
  it('ignores the honorifics that differ between API and table', () => {
    expect(normalizeTeamName('AC Milan')).toBe(normalizeTeamName('Milan'));
    expect(normalizeTeamName('Hellas Verona')).toBe(
      normalizeTeamName('Verona'),
    );
    expect(normalizeTeamName('AS Roma')).toBe(normalizeTeamName('Roma'));
  });

  it('keeps distinct clubs distinct', () => {
    expect(normalizeTeamName('Inter')).not.toBe(normalizeTeamName('Milan'));
  });
});

describe('findDbMatch', () => {
  it('prefers the external id over the team names', () => {
    const renamed = db({ id: 'by-id', home_team: 'Milan AC' });
    const decoy = db({
      id: 'by-name',
      external_api_id: 'api_football_999999',
    });
    expect(findDbMatch(api(), [decoy, renamed])?.id).toBe('by-id');
  });

  it('falls back to team names when the id was never recorded', () => {
    const legacy = db({ id: 'legacy', external_api_id: null });
    expect(findDbMatch(api(), [legacy])?.id).toBe('legacy');
  });

  it('returns undefined rather than guessing a wrong row', () => {
    const other = db({
      external_api_id: 'api_football_1',
      home_team: 'Inter',
      away_team: 'Napoli',
    });
    expect(findDbMatch(api(), [other])).toBeUndefined();
  });
});

describe('planFixtureUpdate', () => {
  it('returns null when the row already matches, so a synced season writes nothing', () => {
    expect(planFixtureUpdate(api(), db())).toBeNull();
  });

  it('reports a kickoff that moved', () => {
    const update = planFixtureUpdate(
      api({ date: '2026-08-30T16:30:00+00:00' }),
      db(),
    );
    expect(update?.dateChanged).toBe(true);
    expect(update?.match_date.toISOString()).toBe('2026-08-30T16:30:00.000Z');
  });

  it('settles score and result once the match is finished', () => {
    const update = planFixtureUpdate(
      api({ statusShort: 'FT', homeGoals: 2, awayGoals: 0 }),
      db(),
    );
    expect(update?.status).toBe('FINISHED');
    expect(update?.result).toBe('1');
    expect(update?.home_score).toBe(2);
  });

  it('keeps the stored result while a match is not finished', () => {
    const update = planFixtureUpdate(
      api({ statusShort: 'PST' }),
      db({ result: '1', status: 'SCHEDULED' }),
    );
    expect(update?.status).toBe('POSTPONED');
    expect(update?.result).toBe('1');
  });

  it('flags a move inside the next 48h as a postponement', () => {
    const now = new Date('2026-08-27T12:00:00Z');
    const update = planFixtureUpdate(
      api({ date: '2026-08-29T18:45:00+00:00' }),
      db(),
      { now },
    );
    expect(update?.imminent).toBe(true);
  });

  it('does not flag the league publishing a distant round', () => {
    const now = new Date('2026-06-14T08:00:00Z');
    const update = planFixtureUpdate(
      api({ date: '2026-08-29T18:45:00+00:00' }),
      db(),
      { now },
    );
    expect(update?.dateChanged).toBe(true);
    expect(update?.imminent).toBe(false);
  });

  it('does not flag a change that leaves the kickoff untouched', () => {
    const now = new Date('2026-08-27T12:00:00Z');
    const update = planFixtureUpdate(
      api({ statusShort: 'FT', homeGoals: 1, awayGoals: 1 }),
      db(),
      { now },
    );
    expect(update?.dateChanged).toBe(false);
    expect(update?.imminent).toBe(false);
  });
});

describe('planRoundUpdates', () => {
  it('separates what changed, what is already in sync and what is missing', () => {
    const moved = api({ apiId: 1, date: '2026-08-30T16:30:00+00:00' });
    const synced = api({ apiId: 2, homeTeam: 'Inter', awayTeam: 'Monza' });
    const absent = api({ apiId: 3, homeTeam: 'Lazio', awayTeam: 'Genoa' });

    const rows = [
      db({ id: 'moved', external_api_id: 'api_football_1' }),
      db({
        id: 'synced',
        external_api_id: 'api_football_2',
        home_team: 'Inter',
        away_team: 'Monza',
      }),
    ];

    const plan = planRoundUpdates([moved, synced, absent], rows);

    expect(plan.updates.map((u) => u.id)).toEqual(['moved']);
    expect(plan.unchanged).toBe(1);
    expect(plan.unmatched).toEqual(['Lazio vs Genoa']);
  });
});

describe('roundLabel', () => {
  it('builds the label API-FOOTBALL expects', () => {
    expect(roundLabel(12)).toBe('Regular Season - 12');
  });
});
