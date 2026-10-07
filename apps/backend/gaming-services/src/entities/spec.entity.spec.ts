import { Spec } from './spec.entity';

/**
 * Un pronostico con la partita collegata, come lo carica il servizio
 * (`relations: ['fixture']`). Le colonne `result` e `correct` restano al
 * valore che hanno nel database vero: `NULL`.
 */
const pronostico = (p: {
  choice: '1' | 'X' | '2' | 'SKIP';
  esitoPartita?: '1' | 'X' | '2' | null;
  result?: '1' | 'X' | '2' | null;
  correct?: boolean | null;
  senzaPartita?: boolean;
}): Spec => {
  const s = new Spec();
  s.choice = p.choice;
  s.result = p.result ?? null;
  s.correct = p.correct ?? null;
  if (!p.senzaPartita) s.fixture = { result: p.esitoPartita ?? null };
  return s;
};

describe('Spec — l`esito viene dalla partita, non dalle colonne morte', () => {
  it('riconosce il pronostico giusto anche con `correct` a NULL', () => {
    const s = pronostico({ choice: 'X', esitoPartita: 'X' });
    expect(s.isCorrect()).toBe(true);
    expect(s.countsTowardPercentage()).toBe(true);
  });

  it('riconosce il pronostico sbagliato anche con `correct` a NULL', () => {
    const s = pronostico({ choice: '1', esitoPartita: '2' });
    expect(s.isCorrect()).toBe(false);
    expect(s.countsTowardPercentage()).toBe(true);
  });

  it('conta nella percentuale ogni pronostico su partita finita', () => {
    // è il guasto che faceva dire «4 pronostici» a chi ne aveva fatti trenta
    const giornata = (['1', 'X', '2', '1', '1'] as const).map((scelta) =>
      pronostico({ choice: scelta, esitoPartita: '1' }),
    );
    expect(giornata.filter((s) => s.countsTowardPercentage())).toHaveLength(5);
    expect(giornata.filter((s) => s.isCorrect() === true)).toHaveLength(3);
  });

  it('non si pronuncia sulla partita non ancora finita', () => {
    const s = pronostico({ choice: '1', esitoPartita: null });
    expect(s.isCorrect()).toBeNull();
    expect(s.countsTowardPercentage()).toBe(false);
    expect(s.hasResult()).toBe(false);
  });

  it('non conta la scelta saltata, nemmeno a partita finita', () => {
    const s = pronostico({ choice: 'SKIP', esitoPartita: '1' });
    expect(s.isCorrect()).toBeNull();
    expect(s.countsTowardPercentage()).toBe(false);
  });

  it('ripiega su `specs.result` quando la partita non è caricata', () => {
    // le righe del 2025 che hanno le colonne valorizzate restano leggibili
    const s = pronostico({
      choice: '2',
      result: '2',
      correct: true,
      senzaPartita: true,
    });
    expect(s.isCorrect()).toBe(true);
    expect(s.countsTowardPercentage()).toBe(true);
  });

  it('la partita batte la colonna quando le due non concordano', () => {
    // un risultato corretto a posteriori deve vincere sul dato memorizzato
    const s = pronostico({
      choice: '1',
      esitoPartita: '1',
      result: '2',
      correct: false,
    });
    expect(s.isCorrect()).toBe(true);
  });

  it('senza partita e senza colonne non inventa un esito', () => {
    const s = pronostico({ choice: '1', senzaPartita: true });
    expect(s.isCorrect()).toBeNull();
    expect(s.countsTowardPercentage()).toBe(false);
    expect(s.hasResult()).toBe(false);
  });

  it('updateCorrectness riempie la colonna dalla partita', () => {
    const s = pronostico({ choice: 'X', esitoPartita: 'X' });
    s.updateCorrectness();
    expect(s.correct).toBe(true);
  });
});
