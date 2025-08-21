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
  try {
    // Prefer popup on localhost to avoid Firebase Hosting redirect handler 404s during dev
    const hostname = typeof window !== 'undefined' ? window.location.hostname : '';
    const isLocalDev = hostname === 'localhost' || hostname === '127.0.0.1';
    
    // Prefer redirect on real mobile devices in non-local environments (iOS/Android)
    const ua = typeof navigator !== 'undefined' ? navigator.userAgent || '' : '';
    const isMobile = /iPhone|iPad|iPod|Android/i.test(ua);
    if (isMobile && !isLocalDev) {
      await signInWithRedirect(auth, googleProvider);
      return { success: true };
    }

    // Desktop: try popup first
    const result = await signInWithPopup(auth, googleProvider);
    return {
      success: true,
      user: result.user,
      credential: GoogleAuthProvider.credentialFromResult(result),
    };
  } catch (error: unknown) {
    const authError = error as { code?: string; message?: string };
    console.error('Google sign-in error:', authError);
    
    // Handle specific error cases
    if (
      authError.code === 'auth/popup-blocked' ||
      authError.code === 'auth/operation-not-supported-in-this-environment' ||
      authError.code === 'auth/blocked-by-user-agent'
    ) {
      // Fallback to redirect method only when not in local dev (to avoid /__/firebase/init.json 404)
      try {
        const hostname = typeof window !== 'undefined' ? window.location.hostname : '';
        const isLocalDev = hostname === 'localhost' || hostname === '127.0.0.1';
        if (isLocalDev) {
          return {
            success: false,
            error: 'Popup bloccato. In sviluppo locale abilita i popup o usa un browser diverso.',
            code: authError.code,
          };
        }
        await signInWithRedirect(auth, googleProvider);
        return { success: true };
      } catch (redirectError: unknown) {
        const redirectAuthError = redirectError as { code?: string; message?: string };
        return {
          success: false,
          error: redirectAuthError.message || 'Redirect error',
          code: redirectAuthError.code,
        };
      }
    }
    
    return {
      success: false,
      error: authError.message || 'Unknown error',
      code: authError.code,
    };
  }
};

export const getGoogleRedirectResult = async (): Promise<GoogleAuthResult> => {
  try {
    const { getRedirectResult } = await import('firebase/auth');
    const result = await getRedirectResult(auth);
    
    if (result) {
      return {
        success: true,
        user: result.user,
        credential: GoogleAuthProvider.credentialFromResult(result),
      };
    }
    
    return { success: false };
  } catch (error: unknown) {
    const authError = error as { code?: string; message?: string };
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
