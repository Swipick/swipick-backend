/**
 * I link delle email (conferma indirizzo, reset password) puntano alla
 * pagina standard di Firebase su firebaseapp.com, che non si può
 * personalizzare. Qui si riscrivono verso il nostro gestore delle azioni su
 * swipick.com, che legge gli stessi parametri e chiama Firebase dal browser
 * (https://firebase.google.com/docs/auth/custom-email-handler).
 */
export const DEFAULT_ACTION_HANDLER_URL = 'https://www.swipick.com/account/';

/** I soli parametri che servono alla pagina: il resto (continueUrl) si perde. */
const KEEP = ['mode', 'oobCode', 'apiKey', 'lang'];

export function toActionHandlerLink(
  firebaseLink: string,
  handlerUrl: string,
): string {
  // Senza indirizzo del gestore (rientro d'emergenza) resta il link di Firebase.
  if (!handlerUrl) return firebaseLink;
  let source: URL;
  try {
    source = new URL(firebaseLink);
  } catch {
    return firebaseLink;
  }
  const target = new URL(handlerUrl);
  for (const key of KEEP) {
    const value = source.searchParams.get(key);
    if (value) target.searchParams.set(key, value);
  }
  // Un link senza azione o codice non lo saprebbe gestire nessuno: meglio
  // quello originale.
  if (!target.searchParams.get('mode') || !target.searchParams.get('oobCode')) {
    return firebaseLink;
  }
  return target.toString();
}
