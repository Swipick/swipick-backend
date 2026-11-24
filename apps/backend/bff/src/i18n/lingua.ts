/** Le lingue dell'app. L'italiano è quella di partenza di tutti i testi. */
export type Lingua = 'it' | 'en';

/**
 * La lingua di una richiesta, dall'intestazione `Accept-Language` che l'app
 * manda con la lingua scelta dall'utente. Inglese solo se la prima lingua è
 * l'inglese; tutto il resto (assente, italiano, altre) resta italiano, come
 * prima che esistesse la traduzione.
 */
export function linguaDaHeader(header?: string | string[] | null): Lingua {
  const valore = Array.isArray(header) ? header[0] : header;
  const prima = (valore ?? '').split(',')[0].trim().toLowerCase();
  return prima.startsWith('en') ? 'en' : 'it';
}
