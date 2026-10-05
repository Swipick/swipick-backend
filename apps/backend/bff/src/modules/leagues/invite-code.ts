import { randomInt } from 'crypto';

/**
 * Il codice d'invito di una lega: quattro caratteri da dettare al telefono.
 *
 * Tutto quello che sta qui è puro e senza dipendenze, perché è la parte dove
 * un errore non si vede: un alfabeto sbagliato produce comunque codici
 * plausibili, e il difetto salta fuori mesi dopo quando qualcuno legge "O" e
 * digita "0".
 */

/**
 * 31 simboli: niente 0/O, 1/I/L. Non è una questione di eleganza — il codice
 * viaggia a voce, e queste sono esattamente le coppie che si confondono.
 */
export const INVITE_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

export const INVITE_CODE_LENGTH = 4;

/**
 * 48 ore. La finestra corta è una delle due difese del codice a quattro
 * caratteri (l'altra è il limite sui tentativi): riduce sia i codici vivi
 * insieme, sia il tempo utile a chi prova a indovinare.
 */
export const INVITE_CODE_TTL_HOURS = 48;

/**
 * Quanto resta fuori circolazione un codice dismesso.
 *
 * Sei mesi: molto più dei due giorni di validità, perché il rischio non è che
 * il codice venga ancora accettato — scade da sé — ma che venga riassegnato a
 * una lega diversa mentre qualcuno ce l'ha ancora in mano. Un biglietto con
 * su quattro lettere sopravvive tranquillamente a una stagione.
 */
export const INVITE_CODE_BURN_MONTHS = 6;

/** Un codice nuovo. `randomInt` e non `Math.random`: qui la prevedibilità è il problema. */
export function generateInviteCode(): string {
  let code = '';
  for (let i = 0; i < INVITE_CODE_LENGTH; i++) {
    code += INVITE_CODE_ALPHABET[randomInt(INVITE_CODE_ALPHABET.length)];
  }
  return code;
}

/**
 * Il codice come lo ha scritto l'utente, ripulito.
 *
 * Tollera minuscole, spazi e trattini — modi normali di trascrivere qualcosa
 * che si è sentito a voce. Non tollera 0, O, 1, I ed L: non stanno
 * nell'alfabeto, quindi "correggerli" vorrebbe dire indovinare al posto suo.
 * Restituisce null, e chi chiama lo trasforma in un messaggio che dice
 * *quale* carattere non va.
 */
export function normalizeInviteCode(raw: string): string | null {
  if (typeof raw !== 'string') return null;

  const cleaned = raw.replace(/[\s-]/g, '').toUpperCase();
  if (cleaned.length !== INVITE_CODE_LENGTH) return null;

  for (const char of cleaned) {
    if (!INVITE_CODE_ALPHABET.includes(char)) return null;
  }

  return cleaned;
}

/** I caratteri rifiutati, per dirlo all'utente invece di un "codice non valido". */
export function invalidCharactersIn(raw: string): string[] {
  const cleaned = (raw ?? '').replace(/[\s-]/g, '').toUpperCase();
  return [...new Set(cleaned)].filter(
    (char) => !INVITE_CODE_ALPHABET.includes(char),
  );
}

export function inviteCodeExpiry(from: Date = new Date()): Date {
  return new Date(from.getTime() + INVITE_CODE_TTL_HOURS * 60 * 60 * 1000);
}

/** Un codice senza scadenza è scaduto: meglio chiuso che aperto per sempre. */
export function isInviteCodeExpired(
  expiresAt: Date | null | undefined,
  now: Date = new Date(),
): boolean {
  if (!expiresAt) return true;
  return expiresAt.getTime() <= now.getTime();
}
