import { Fixture } from '../api-football/interfaces/fixture.interface';

/** Final whistle statuses: regular time, extra time, penalties. */
const FINISHED = new Set(['FT', 'AET', 'PEN']);

/**
 * Head-to-head record between two teams, from team1's point of view.
 * Only finished official matches count: friendlies are dropped, and fixtures
 * not yet played (no winner) must not be tallied as draws. Most recent first.
 */
export function headToHeadSummary(all: Fixture[], team1Id: number) {
  const fixtures = all
    .filter((f) => FINISHED.has(f.status?.short))
    .filter((f) => !/friendl/i.test(f.league?.name ?? ''))
    .sort((a, b) => b.timestamp - a.timestamp);

  let team1Wins = 0;
  let team2Wins = 0;
  let draws = 0;
  for (const f of fixtures) {
    const winnerId =
      f.teams.home.winner === true
        ? f.teams.home.id
        : f.teams.away.winner === true
          ? f.teams.away.id
          : null;
    if (winnerId === null) draws++;
    else if (winnerId === team1Id) team1Wins++;
    else team2Wins++;
  }

  const last = fixtures[0] ?? null;
  return {
    totalMatches: fixtures.length,
    team1Wins,
    team2Wins,
    draws,
    lastMatch: last
      ? {
          date: last.date,
          result: `${last.goals.home}-${last.goals.away}`,
          winner:
            last.teams.home.winner === true
              ? 'home'
              : last.teams.away.winner === true
                ? 'away'
                : 'draw',
        }
      : null,
    fixtures,
  };
}
