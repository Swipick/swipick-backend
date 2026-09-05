import { formatEuropeRomeDisplay } from './format-display-date';

describe('formatEuropeRomeDisplay', () => {
  it('rende in ora italiana, non in UTC', () => {
    // Il caso che ha fatto emergere il difetto: Genoa-Como, calcio d'inizio
    // 18:45 UTC = 20:45 italiane. Prima usciva "18:45".
    expect(formatEuropeRomeDisplay(new Date('2026-09-04T18:45:00Z'))).toBe(
      'ven 04/09 – 20:45',
    );
  });

  it('applica +2 in ora legale', () => {
    expect(formatEuropeRomeDisplay(new Date('2026-09-05T13:00:00Z'))).toBe(
      'sab 05/09 – 15:00',
    );
  });

  it('applica +1 in ora solare, non un offset fisso', () => {
    // Gennaio: CET. Un offset hardcoded a 2 sbaglierebbe qui.
    expect(formatEuropeRomeDisplay(new Date('2027-01-17T17:30:00Z'))).toBe(
      'dom 17/01 – 18:30',
    );
  });

  it('sposta anche il giorno quando il fuso attraversa la mezzanotte', () => {
    // 22:30 UTC del 4 settembre sono le 00:30 del 5 in Italia.
    expect(formatEuropeRomeDisplay(new Date('2026-09-04T22:30:00Z'))).toBe(
      'sab 05/09 – 00:30',
    );
  });

  it('usa il formato 24 ore, senza AM/PM', () => {
    const display = formatEuropeRomeDisplay(new Date('2026-09-04T18:45:00Z'));
    expect(display).not.toMatch(/[ap]\.?m\.?/i);
    expect(display).toMatch(/\d{2}:\d{2}$/);
  });

  it('mantiene la forma attesa dal client: "gio 24/10 – 20:45"', () => {
    expect(formatEuropeRomeDisplay(new Date('2026-10-24T18:45:00Z'))).toMatch(
      /^[a-zà-ù]{3} \d{2}\/\d{2} – \d{2}:\d{2}$/,
    );
  });

  it('non lascia il punto abbreviativo del giorno, che varia con ICU', () => {
    expect(formatEuropeRomeDisplay(new Date('2026-09-04T18:45:00Z'))).not.toContain('.');
  });

  it('restituisce stringa vuota su data non valida, senza lanciare', () => {
    expect(formatEuropeRomeDisplay(new Date('non-una-data'))).toBe('');
  });
});
