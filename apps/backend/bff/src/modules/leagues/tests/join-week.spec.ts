import { resolveJoinFromWeek, kickoffOf } from '../join-week';

const ora = new Date('2026-10-03T18:00:00Z');

describe('resolveJoinFromWeek', () => {
  it('entra nella giornata in corso se non e ancora cominciata niente', () => {
    const week = resolveJoinFromWeek(
      7,
      [
        { match_date: '2026-10-04T13:00:00Z' },
        { match_date: '2026-10-05T18:45:00Z' },
      ],
      ora,
    );
    expect(week).toBe(7);
  });

  it('slitta alla successiva appena una partita e iniziata', () => {
    const week = resolveJoinFromWeek(
      7,
      [
        { match_date: '2026-10-03T16:00:00Z' },
        { match_date: '2026-10-04T13:00:00Z' },
      ],
      ora,
    );
    expect(week).toBe(8);
  });

  it('considera iniziata la partita che comincia in questo istante', () => {
    expect(
      resolveJoinFromWeek(7, [{ match_date: '2026-10-03T18:00:00Z' }], ora),
    ).toBe(8);
  });

  it('senza partite resta sulla giornata corrente', () => {
    expect(resolveJoinFromWeek(7, [], ora)).toBe(7);
    expect(resolveJoinFromWeek(7, undefined as never, ora)).toBe(7);
  });

  it('ignora le date illeggibili invece di far slittare per sbaglio', () => {
    expect(
      resolveJoinFromWeek(
        7,
        [{ match_date: 'non-una-data' }, { match_date: null }],
        ora,
      ),
    ).toBe(7);
  });

  it('legge l orario in tutte le forme che arrivano dal gaming', () => {
    expect(
      kickoffOf({ match_date: '2026-10-03T16:00:00Z' })?.toISOString(),
    ).toBe('2026-10-03T16:00:00.000Z');
    expect(
      kickoffOf({ matchDate: new Date('2026-10-03T16:00:00Z') })?.toISOString(),
    ).toBe('2026-10-03T16:00:00.000Z');
    expect(
      kickoffOf({ kickoff: { iso: '2026-10-03T16:00:00Z' } })?.toISOString(),
    ).toBe('2026-10-03T16:00:00.000Z');
    expect(kickoffOf({})).toBeNull();
  });
});
