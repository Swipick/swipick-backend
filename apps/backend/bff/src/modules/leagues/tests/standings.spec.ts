import { buildStandings, StandingMember, WeekScore } from '../standings';
import { LeagueRole } from '../../../entities/league-member.entity';

function membro(
  nome: string,
  joinedFromWeek = 1,
  role = LeagueRole.MEMBER,
): StandingMember {
  return {
    userId: `uuid-${nome}`,
    firebaseUid: `fb-${nome}`,
    nickname: nome,
    role,
    joinedFromWeek,
  };
}

function punteggio(
  nome: string,
  week: number,
  correct: number,
  revealed = 10,
): WeekScore {
  return { userId: `fb-${nome}`, week, correct, revealed };
}

describe('buildStandings', () => {
  const season = { scope: 'season' as const, currentWeek: 7 };

  it('somma le giornate e ordina per punti', () => {
    const rows = buildStandings(
      [membro('marti'), membro('zeno'), membro('luca')],
      [
        punteggio('marti', 1, 7),
        punteggio('marti', 2, 6),
        punteggio('zeno', 1, 5),
        punteggio('zeno', 2, 5),
        punteggio('luca', 1, 9),
        punteggio('luca', 2, 9),
      ],
      season,
    );

    expect(rows.map((r) => [r.nickname, r.position, r.points])).toEqual([
      ['luca', 1, 18],
      ['marti', 2, 13],
      ['zeno', 3, 10],
    ]);
  });

  it('non conta le giornate prima dell ingresso, anche se i punteggi esistono', () => {
    const rows = buildStandings(
      [membro('zeno'), membro('dani', 5)],
      [
        punteggio('zeno', 4, 3),
        punteggio('zeno', 5, 3),
        // dani giocava già, ma non in questa lega: la 4 non deve contare.
        punteggio('dani', 4, 10),
        punteggio('dani', 5, 4),
      ],
      season,
    );

    const dani = rows.find((r) => r.nickname === 'dani');
    expect(dani?.points).toBe(4);
    expect(dani?.revealed).toBe(10);
    expect(rows[0].nickname).toBe('zeno');
  });

  it('mette fuori classifica chi deve ancora cominciare', () => {
    const rows = buildStandings(
      [membro('zeno'), membro('fede', 8)],
      [punteggio('zeno', 7, 7)],
      season,
    );

    const fede = rows.find((r) => r.nickname === 'fede');
    expect(fede?.pending).toBe(true);
    expect(fede?.position).toBeNull();
    expect(fede?.points).toBe(0);
    // e sta in fondo, dopo chi gioca
    expect(rows[rows.length - 1].nickname).toBe('fede');
  });

  it('condivide la posizione a parita di punti e percentuale', () => {
    const rows = buildStandings(
      [membro('a'), membro('b'), membro('c')],
      [punteggio('a', 1, 8), punteggio('b', 1, 8), punteggio('c', 1, 2)],
      season,
    );

    expect(rows.map((r) => [r.nickname, r.position])).toEqual([
      ['a', 1],
      ['b', 1],
      ['c', 3],
    ]);
  });

  it('a parita di punti mette avanti chi ha la percentuale migliore', () => {
    const rows = buildStandings(
      [membro('preciso'), membro('prolifico')],
      [
        // stessi punti, ma uno ha scoperto meno partite
        punteggio('preciso', 1, 5, 6),
        punteggio('prolifico', 1, 5, 10),
      ],
      season,
    );

    expect(rows.map((r) => r.nickname)).toEqual(['preciso', 'prolifico']);
    expect(rows[0].percent).toBe(83);
  });

  it('con scope week guarda solo quella giornata', () => {
    const rows = buildStandings(
      [membro('zeno'), membro('luca')],
      [
        punteggio('zeno', 6, 9),
        punteggio('zeno', 7, 2),
        punteggio('luca', 6, 1),
        punteggio('luca', 7, 8),
      ],
      { scope: 'week', week: 7, currentWeek: 7 },
    );

    expect(rows.map((r) => [r.nickname, r.points])).toEqual([
      ['luca', 8],
      ['zeno', 2],
    ]);
  });

  it('regge un membro senza punteggi e non divide per zero', () => {
    const rows = buildStandings([membro('nuovo')], [], season);
    expect(rows[0].points).toBe(0);
    expect(rows[0].percent).toBe(0);
    expect(rows[0].position).toBe(1);
  });
});
