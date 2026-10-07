import {
  convertiRighe,
  sqlPunteggiDaPronostici,
  RigaGrezza,
} from './punteggi-da-pronostici';

describe('sqlPunteggiDaPronostici', () => {
  it('legge da specs unita a fixtures, non da final_week_scores', () => {
    const sql = sqlPunteggiDaPronostici(false);
    expect(sql).toContain('FROM specs s');
    expect(sql).toContain('JOIN fixtures f ON f.id = s.fixture_id');
    expect(sql).not.toContain('final_week_scores');
  });

  it('conta giusto il pronostico che combacia col risultato della partita', () => {
    expect(sqlPunteggiDaPronostici(false)).toContain(
      's.choice::text = f.result::text',
    );
  });

  it('filtra per stagione e modalità, così 2025 e 2026 non si mescolano', () => {
    const sql = sqlPunteggiDaPronostici(false);
    expect(sql).toContain('s.season = $2');
    expect(sql).toContain('s.mode = $3');
  });

  it('esclude le scelte saltate, che non sono pronostici', () => {
    expect(sqlPunteggiDaPronostici(false)).toContain(
      "s.choice::text <> 'SKIP'",
    );
  });

  it('conta come rivelate solo le partite con un risultato', () => {
    expect(sqlPunteggiDaPronostici(false)).toContain(
      'count(*) FILTER (WHERE f.result IS NOT NULL) AS revealed',
    );
  });

  it('scarta le giornate senza nessun risultato invece di restituirle a zero', () => {
    expect(sqlPunteggiDaPronostici(false)).toContain('HAVING');
  });

  it('aggiunge il filtro sulla giornata solo quando serve', () => {
    expect(sqlPunteggiDaPronostici(true)).toContain('AND s.week = $4');
    expect(sqlPunteggiDaPronostici(false)).not.toContain('$4');
  });

  it('raggruppa per utente e giornata', () => {
    expect(sqlPunteggiDaPronostici(false)).toContain(
      'GROUP BY s.user_id, s.week',
    );
  });
});

describe('convertiRighe', () => {
  const riga = (p: Partial<RigaGrezza> = {}): RigaGrezza => ({
    userId: 'UID1',
    week: '5',
    correct: '6',
    revealed: '10',
    ...p,
  });

  it('forza i numeri: Postgres restituisce i count come stringhe', () => {
    const [r] = convertiRighe([riga()]);
    expect(r).toEqual({ userId: 'UID1', week: 5, correct: 6, revealed: 10 });
    expect(typeof r.correct).toBe('number');
    expect(typeof r.week).toBe('number');
  });

  it('somma e non concatena, una volta convertite', () => {
    const righe = convertiRighe([
      riga({ correct: '3' }),
      riga({ week: '6', correct: '2' }),
    ]);
    expect(righe.reduce((s, r) => s + r.correct, 0)).toBe(5);
  });

  it('scarta le righe senza niente di rivelato, per non dividere per zero', () => {
    expect(convertiRighe([riga({ revealed: '0', correct: '0' })])).toEqual([]);
  });

  it('tiene la riga da zero punti se qualcosa è stato rivelato', () => {
    const [r] = convertiRighe([riga({ correct: '0', revealed: '10' })]);
    expect(r).toMatchObject({ correct: 0, revealed: 10 });
  });

  it('non inventa righe su un elenco vuoto', () => {
    expect(convertiRighe([])).toEqual([]);
  });

  it('regge i numeri già numerici, non solo le stringhe', () => {
    const [r] = convertiRighe([
      { userId: 'U', week: 3, correct: 4, revealed: 10 },
    ]);
    expect(r).toEqual({ userId: 'U', week: 3, correct: 4, revealed: 10 });
  });
});
