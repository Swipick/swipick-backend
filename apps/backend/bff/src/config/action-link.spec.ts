import { DEFAULT_ACTION_HANDLER_URL, toActionHandlerLink } from './action-link';

const FIREBASE =
  'https://swipick-2026.firebaseapp.com/__/auth/action?mode=resetPassword&oobCode=ABC-123_x&apiKey=AIzaFinta&continueUrl=https%3A%2F%2Fmindful-sparkle-production.up.railway.app%2FloginVerified&lang=it';

describe('toActionHandlerLink', () => {
  it('porta il link su swipick.com con azione, codice, chiave e lingua', () => {
    const out = new URL(
      toActionHandlerLink(FIREBASE, DEFAULT_ACTION_HANDLER_URL),
    );
    expect(`${out.origin}${out.pathname}`).toBe(
      'https://www.swipick.com/account/',
    );
    expect(Object.fromEntries(out.searchParams)).toEqual({
      mode: 'resetPassword',
      oobCode: 'ABC-123_x',
      apiKey: 'AIzaFinta',
      lang: 'it',
    });
  });

  it('non porta con sé il continueUrl della vecchia web app', () => {
    expect(
      toActionHandlerLink(FIREBASE, DEFAULT_ACTION_HANDLER_URL),
    ).not.toContain('mindful-sparkle');
  });

  it('senza gestore configurato lascia il link di Firebase', () => {
    expect(toActionHandlerLink(FIREBASE, '')).toBe(FIREBASE);
  });

  it('un link senza codice o non valido resta quello originale', () => {
    const senzaCodice =
      'https://swipick-2026.firebaseapp.com/__/auth/action?mode=verifyEmail';
    expect(toActionHandlerLink(senzaCodice, DEFAULT_ACTION_HANDLER_URL)).toBe(
      senzaCodice,
    );
    expect(
      toActionHandlerLink('non è un url', DEFAULT_ACTION_HANDLER_URL),
    ).toBe('non è un url');
  });
});
