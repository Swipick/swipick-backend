import { Lingua } from './lingua';

/**
 * I messaggi d'errore che l'app mostra all'utente, in inglese. La chiave è
 * il testo italiano esatto usato nelle eccezioni e nei DTO: un messaggio
 * nuovo senza traduzione esce in italiano, che è meglio di un codice.
 */
const EN: Record<string, string> = {
  'Codice non valido': 'Invalid code',
  'Dimensione immagine non valida (max 4MB)': 'Invalid image size (max 4MB)',
  'Errore durante il completamento del profilo':
    'Error while completing the profile',
  'Errore durante la cancellazione dati': 'Error while deleting data',
  "Errore durante la registrazione dell'utente": 'Error while signing up',
  'Errore durante la sincronizzazione con Apple':
    'Error while syncing with Apple',
  'Errore durante la sincronizzazione con Google':
    'Error while syncing with Google',
  'Errore durante la sincronizzazione del reset password':
    'Error while syncing the password reset',
  'Errore durante la sincronizzazione utente': 'Error while syncing the user',
  'Errore durante la validazione del reset password':
    'Error while validating the password reset',
  'Gestisci già tu questa lega': 'You already run this league',
  'Gestisci questa lega: passa il ruolo a qualcun altro oppure eliminala':
    'You run this league: hand the admin role to someone else or delete it',
  'Giornata non valida': 'Invalid matchday',
  'Gli utenti social non possono cambiare password':
    "Accounts created with Google or Apple can't change password",
  'Gli utenti social non possono reimpostare la password. Usa il tuo metodo di accesso originale.':
    "Accounts created with Google or Apple can't reset the password. Use your original sign-in method.",
  'Il codice è di quattro caratteri': 'The code is four characters long',
  'Il nickname deve essere tra 3 e 50 caratteri':
    'The nickname must be between 3 and 50 characters',
  'Il nickname deve essere una stringa': 'The nickname must be text',
  'Il nickname può contenere solo lettere minuscole, numeri e underscore':
    'The nickname can only contain lowercase letters, numbers and underscores',
  'Il nickname è obbligatorio': 'The nickname is required',
  'Il nome della lega è obbligatorio': 'The league name is required',
  'Il nome deve essere tra 2 e 100 caratteri':
    'The name must be between 2 and 100 characters',
  'Il nome deve essere tra 3 e 40 caratteri':
    'The name must be between 3 and 40 characters',
  'Il nome deve essere una stringa': 'The name must be text',
  'Il nome può contenere solo lettere, spazi, apostrofi e punti':
    'The name can only contain letters, spaces, apostrophes and full stops',
  'Il profilo è già stato completato': 'The profile has already been completed',
  'Il token Firebase deve essere una stringa':
    'The Firebase token must be text',
  'Il token Firebase è obbligatorio': 'The Firebase token is required',
  'Impossibile aggiornare il nickname': "Couldn't update the nickname",
  "Impossibile inviare l'email di verifica. Riprova più tardi.":
    "Couldn't send the verification email. Please try again later.",
  'Inserisci un indirizzo email valido': 'Enter a valid email address',
  "L'email è obbligatoria": 'The email is required',
  'La password deve essere tra 8 e 128 caratteri':
    'The password must be between 8 and 128 characters',
  'La password deve essere una stringa': 'The password must be text',
  'La password è obbligatoria': 'The password is required',
  'Le preferenze devono essere un oggetto': 'Preferences must be an object',
  'Lega non trovata': 'League not found',
  'Membro non trovato': 'Member not found',
  'Membro non valido': 'Invalid member',
  'Non puoi rimuovere chi gestisce la lega':
    "You can't remove the league admin",
  'Non riesco a generare un codice libero, riprova':
    "Couldn't generate a free code, please try again",
  'Non riesco a leggere i punteggi, riprova fra poco':
    "Couldn't read the scores, try again shortly",
  'Non riesco a leggere la giornata in corso, riprova fra poco':
    "Couldn't read the current matchday, try again shortly",
  'Non sei in questa lega': "You're not in this league",
  'Questa email è già usata da un altro accesso: entra con quello':
    'This email is already used by another sign-in method: sign in with that one',
  'Questa lega è piena': 'This league is full',
  'Questo codice è scaduto': 'This code has expired',
  'Questo nickname è già in uso': 'This nickname is already taken',
  'Sei già in questa lega': "You're already in this league",
  'Sei stato rimosso da questa lega: può riammetterti solo chi la gestisce':
    'You were removed from this league: only the admin can readmit you',
  'Solo chi gestisce la lega può farlo': 'Only the league admin can do this',
  'Tipo immagine non supportato': 'Unsupported image type',
  'Token di accesso mancante': 'Missing access token',
  'Token di accesso non valido': 'Invalid access token',
  'Token di autenticazione mancante': 'Missing authentication token',
  "Token non corrisponde all'utente": "The token doesn't match the user",
  'Troppi tentativi ravvicinati. Riprova tra qualche minuto.':
    'Too many attempts in a short time. Try again in a few minutes.',
  'Troppi tentativi: aspetta un minuto': 'Too many attempts: wait a minute',
  "Troppi tentativi: riprova fra un'ora":
    'Too many attempts: try again in an hour',
  'URL immagine deve usare HTTPS': 'The image URL must use HTTPS',
  'URL immagine non valido': 'Invalid image URL',
  'Un utente con questa email esiste già':
    'A user with this email already exists',
  'Utente non trovato': 'User not found',
};

/** Messaggi con una parte variabile: si traduce lo schema, la parte resta. */
const SCHEMI: [RegExp, (...parti: string[]) => string][] = [
  [
    /^Il codice non contiene (.+): controlla, le lettere O e I e i numeri 0 e 1 non si usano$/,
    (car) =>
      `The code can't contain ${car}: check it, the letters O and I and the numbers 0 and 1 are never used`,
  ],
];

export function traduciMessaggio(messaggio: string, lingua: Lingua): string {
  if (lingua === 'it') return messaggio;
  const fisso = EN[messaggio];
  if (fisso) return fisso;
  for (const [schema, traduci] of SCHEMI) {
    const m = schema.exec(messaggio);
    if (m) return traduci(...m.slice(1));
  }
  return messaggio;
}
