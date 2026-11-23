import { headToHeadSummary } from './head-to-head';
import { Fixture } from '../api-football/interfaces/fixture.interface';

const MILAN = 489;
const INTER = 505;

function match(
  date: string,
  home: number,
  away: number,
  goals: [number | null, number | null],
  status = 'FT',
  league = 'Serie A',
): Fixture {
  const [h, a] = goals;
  const done = h !== null && a !== null;
  return {
    id: Math.floor(Math.random() * 1e6),
    timezone: 'UTC',
    date,
    timestamp: Date.parse(date) / 1000,
    venue: { id: 1, name: 'San Siro', city: 'Milano' },
    status: { long: status, short: status },
    league: {
      id: 135,
      name: league,
      country: 'Italy',
      season: 2026,
      round: 'x',
    },
    teams: {
      home: {
        id: home,
        name: String(home),
        logo: '',
        winner: done ? (h! > a! ? true : h! < a! ? false : null) : null,
      },
      away: {
        id: away,
        name: String(away),
        logo: '',
        winner: done ? (a! > h! ? true : a! < h! ? false : null) : null,
      },
    },
    goals: { home: h, away: a },
  } as unknown as Fixture;
}

describe('headToHeadSummary', () => {
  const fixtures = [
    match('2025-11-23T19:45:00Z', INTER, MILAN, [0, 1]),
    match('2026-03-08T19:45:00Z', MILAN, INTER, [1, 0]),
    match('2026-01-10T19:45:00Z', MILAN, INTER, [2, 2], 'PEN', 'Super Cup'),
    match(
      '2026-08-05T19:45:00Z',
      MILAN,
      INTER,
      [1, 1],
      'FT',
      'Friendlies Clubs',
    ),
    match('2026-10-31T19:45:00Z', MILAN, INTER, [3, 1]),
    match('2024-04-22T18:45:00Z', MILAN, INTER, [1, 2]),
    match('2027-02-14T19:45:00Z', INTER, MILAN, [null, null], 'NS'),
  ];

  it('conta solo le partite ufficiali finite, dal punto di vista della prima squadra', () => {
    const s = headToHeadSummary(fixtures, MILAN);
    expect(s.totalMatches).toBe(5);
    expect(s).toMatchObject({ team1Wins: 3, team2Wins: 1, draws: 1 });
  });

  it('non conta la partita non ancora giocata come pareggio', () => {
    const s = headToHeadSummary(fixtures, MILAN);
    expect(s.fixtures.some((f) => f.status.short === 'NS')).toBe(false);
  });

  it("l'ultima sfida è la più recente giocata", () => {
    const s = headToHeadSummary(fixtures, MILAN);
    expect(s.lastMatch).toEqual({
      date: '2026-10-31T19:45:00Z',
      result: '3-1',
      winner: 'home',
    });
    expect(s.fixtures.map((f) => f.date.slice(0, 10))).toEqual([
      '2026-10-31',
      '2026-03-08',
      '2026-01-10',
      '2025-11-23',
      '2024-04-22',
    ]);
  });

  it('a squadre invertite il bilancio si ribalta', () => {
    expect(headToHeadSummary(fixtures, INTER)).toMatchObject({
      team1Wins: 1,
      team2Wins: 3,
      draws: 1,
    });
  });

  it('senza precedenti restituisce un bilancio vuoto', () => {
    expect(headToHeadSummary([], MILAN)).toMatchObject({
      totalMatches: 0,
      lastMatch: null,
    });
  });
});
