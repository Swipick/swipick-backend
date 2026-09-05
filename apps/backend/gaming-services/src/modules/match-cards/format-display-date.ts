/**
 * Etichetta di calcio d'inizio pronta da mostrare, es. "ven 04/09 – 20:45".
 *
 * Vive fuori dal service, senza dipendenze da Nest, perche' possa essere
 * verificata direttamente: e' gia' andata storta una volta.
 *
 * Storia, perche' non venga "semplificata" di nuovo. La colonna match_date
 * conteneva ora locale italiana invece di UTC, e qui si compensava omettendo
 * la conversione di fuso — due errori che si annullavano, con il commento
 * "database already stores Italian time" a fissare l'equivoco. Risistemati i
 * dati su UTC, quella compensazione e' diventata il difetto: ogni orario
 * usciva 1-2 ore in anticipo.
 *
 * L'orario di una partita di Serie A si legge in ora italiana, sempre, per
 * chiunque guardi: il fuso e' quindi dichiarato esplicitamente e non deriva
 * ne' dai dati ne' dall'ambiente in cui gira il processo.
 */
export const EUROPE_ROME = 'Europe/Rome';

export const formatEuropeRomeDisplay = (date: Date): string => {
  if (Number.isNaN(date.getTime())) return '';

  const parts = new Intl.DateTimeFormat('it-IT', {
    timeZone: EUROPE_ROME,
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date);

  const get = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((p) => p.type === type)?.value ?? '';

  // Il giorno abbreviato arriva con o senza punto finale a seconda della
  // versione ICU: normalizzato qui per non dipendere dal runtime.
  const weekday = get('weekday').replace('.', '');

  return `${weekday} ${get('day')}/${get('month')} – ${get('hour')}:${get('minute')}`;
};
