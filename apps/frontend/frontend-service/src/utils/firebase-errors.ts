/**
 * Firebase error interface
 */
export interface FirebaseError {
  code?: string;
  message?: string;
}

/**
 * Firebase authentication error messages mapping
 * Provides user-friendly error messages for Firebase auth errors
 */
export const firebaseErrorMessages: Record<string, string> = {
  // Authentication errors
  "auth/user-not-found": "Non è stato trovato alcun account con questo indirizzo email.",
  "auth/wrong-password": "Password non corretta. Riprova.",
  "auth/email-already-in-use": "Esiste già un account con questo indirizzo email.",
  "auth/weak-password": "La password deve essere di almeno 8 caratteri.",
  "auth/invalid-email": "Inserisci un indirizzo email valido.",
  "auth/too-many-requests": "Troppi tentativi. Riprova più tardi.",
  "auth/network-request-failed": "Errore di rete. Controlla la tua connessione.",
  "auth/user-disabled": "Questo account è stato disabilitato.",
  "auth/invalid-credential": "Credenziali non valide. Verifica email e password.",
  "auth/operation-not-allowed": "Operazione non consentita. Contatta l'assistenza.",
  "auth/requires-recent-login": "Per sicurezza, effettua di nuovo l'accesso.",
  
  // Email verification errors
  "auth/invalid-action-code": "Il codice di verifica non è valido o è scaduto.",
  "auth/expired-action-code": "Il codice di verifica è scaduto.",
  "auth/user-token-expired": "La sessione è scaduta. Effettua di nuovo l'accesso.",
  
  // Password reset errors
  "auth/invalid-continue-uri": "URL di continuazione non valido.",
  "auth/missing-continue-uri": "URL di continuazione mancante.",
  
  // Default fallback
  default: "Si è verificato un errore imprevisto. Riprova."
};

/**
 * Get user-friendly error message from Firebase error
 * @param error - Firebase error object
 * @returns User-friendly error message in Italian
 */
export const getFirebaseErrorMessage = (error: FirebaseError | Error | unknown): string => {
  const firebaseError = error as FirebaseError;
  
  if (firebaseError?.code && firebaseErrorMessages[firebaseError.code]) {
    return firebaseErrorMessages[firebaseError.code];
  }
  
  // Check if it's a custom error with message
  if (firebaseError?.message && typeof firebaseError.message === 'string') {
    return firebaseError.message;
  }
  
  return firebaseErrorMessages.default;
};

/**
 * Check if error is related to network connectivity
 * @param error - Firebase error object
 * @returns boolean indicating if error is network-related
 */
export const isNetworkError = (error: FirebaseError | Error | unknown): boolean => {
  const firebaseError = error as FirebaseError;
  return firebaseError?.code === 'auth/network-request-failed' || 
         (firebaseError?.message?.includes('network') ?? false) ||
         (firebaseError?.message?.includes('offline') ?? false);
};

/**
 * Check if error requires user reauthentication
 * @param error - Firebase error object  
 * @returns boolean indicating if reauthentication is required
 */
export const requiresReauth = (error: FirebaseError | Error | unknown): boolean => {
  const firebaseError = error as FirebaseError;
  return firebaseError?.code === 'auth/requires-recent-login' ||
         firebaseError?.code === 'auth/user-token-expired';
};
