import { signInWithPopup, signInWithRedirect, GoogleAuthProvider, User, AuthCredential } from 'firebase/auth';
import { auth, googleProvider } from '@/lib/firebase';

export interface GoogleAuthResult {
  success: boolean;
  user?: User;
  credential?: AuthCredential | null;
  error?: string;
  code?: string;
}

export const signInWithGoogle = async (): Promise<GoogleAuthResult> => {
  console.log('🟣 [googleAuth] signInWithGoogle() called');
  try {
    const hostname = typeof window !== 'undefined' ? window.location.hostname : '';
    const ua = typeof navigator !== 'undefined' ? navigator.userAgent || '' : '';
    const isMobile = /iPhone|iPad|iPod|Android/i.test(ua);

    console.log('🟣 [googleAuth] Hostname:', hostname);
    console.log('🟣 [googleAuth] User Agent:', ua);
    console.log('🟣 [googleAuth] Is Mobile:', isMobile);

    // Clear any stale redirect flags from previous attempts
    sessionStorage.removeItem('swipick:googleRedirectPending');
    sessionStorage.removeItem('swipick:googleRedirectTime');

    // Use popup for ALL devices - same flow that works on desktop
    console.log('🟣 [googleAuth] Using popup flow (same as desktop)');
    console.log('🟣 [googleAuth] Calling signInWithPopup...');

    const result = await signInWithPopup(auth, googleProvider);
    console.log('🟣 [googleAuth] signInWithPopup successful, user:', result.user?.email);

    return {
      success: true,
      user: result.user,
      credential: GoogleAuthProvider.credentialFromResult(result),
    };
  } catch (error: unknown) {
    const authError = error as { code?: string; message?: string };
    console.error('🔴 [googleAuth] Google sign-in error:', authError);

    // Handle popup blocked error
    if (authError.code === 'auth/popup-blocked') {
      console.error('🔴 [googleAuth] Popup was blocked by the browser');
      return {
        success: false,
        error: 'Il popup è stato bloccato. Abilita i popup per questo sito e riprova.',
        code: authError.code,
      };
    }

    return {
      success: false,
      error: authError.message || 'Unknown error',
      code: authError.code,
    };
  }
};

export const getGoogleRedirectResult = async (): Promise<GoogleAuthResult> => {
  console.log('🟣 [googleAuth] getGoogleRedirectResult() called');
  try {
    const { getRedirectResult, getAuth } = await import('firebase/auth');
    console.log('🟣 [googleAuth] Calling getRedirectResult...');
    const result = await getRedirectResult(auth);
    console.log('🟣 [googleAuth] getRedirectResult returned:', result ? 'result found' : 'no result');

    if (result) {
      console.log('🟣 [googleAuth] Redirect result successful, user:', result.user?.email);
      return {
        success: true,
        user: result.user,
        credential: GoogleAuthProvider.credentialFromResult(result),
      };
    }

    // Check current auth state as fallback
    console.log('🟣 [googleAuth] No redirect result, checking current auth state...');
    const currentAuth = getAuth();
    const currentUser = currentAuth.currentUser;

    if (currentUser) {
      console.log('🟣 [googleAuth] Found current user:', currentUser.email);
      return {
        success: true,
        user: currentUser,
        credential: null,
      };
    }

    console.log('🟣 [googleAuth] No redirect result and no current user');
    return { success: false };
  } catch (error: unknown) {
    const authError = error as { code?: string; message?: string };
    console.error('🔴 [googleAuth] getRedirectResult error:', authError);
    console.error('🔴 [googleAuth] Error details:', { code: authError.code, message: authError.message });
    return {
      success: false,
      error: authError.message || 'Redirect result error',
      code: authError.code,
    };
  }
};

// User-friendly error messages
export const getAuthErrorMessage = (errorCode: string): string => {
  const errorMessages: Record<string, string> = {
    'auth/popup-blocked': 'Popup è stato bloccato. Abilita i popup e riprova.',
    'auth/popup-closed-by-user': 'Accesso annullato. Riprova.',
    'auth/network-request-failed': 'Errore di rete. Controlla la connessione.',
    'auth/account-exists-with-different-credential': 'Esiste già un account con questa email.',
    'auth/cancelled-popup-request': 'Richiesta di accesso annullata.',
    'auth/user-cancelled': 'Accesso annullato dall\'utente.',
  };
  
  return errorMessages[errorCode] || 'Errore durante l\'accesso con Google. Riprova.';
};
