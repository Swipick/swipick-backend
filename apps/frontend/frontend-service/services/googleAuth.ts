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
    // Prefer popup on localhost to avoid Firebase Hosting redirect handler 404s during dev
    const hostname = typeof window !== 'undefined' ? window.location.hostname : '';
    const isLocalDev = hostname === 'localhost' || hostname === '127.0.0.1';
    console.log('🟣 [googleAuth] Hostname:', hostname, 'isLocalDev:', isLocalDev);

    // Prefer redirect on real mobile devices in non-local environments (iOS/Android)
    const ua = typeof navigator !== 'undefined' ? navigator.userAgent || '' : '';
    const isMobile = /iPhone|iPad|iPod|Android/i.test(ua);
    console.log('🟣 [googleAuth] User Agent:', ua);
    console.log('🟣 [googleAuth] Is Mobile:', isMobile);

    if (isMobile && !isLocalDev) {
      console.log('🟣 [googleAuth] Mobile detected - using redirect flow');

      // Set a flag to indicate we're expecting a redirect
      sessionStorage.setItem('swipick:googleRedirectPending', 'true');
      sessionStorage.setItem('swipick:googleRedirectTime', Date.now().toString());
      console.log('🟣 [googleAuth] Set redirect pending flag in sessionStorage');

      console.log('🟣 [googleAuth] Calling signInWithRedirect...');
      await signInWithRedirect(auth, googleProvider);
      console.log('🟣 [googleAuth] signInWithRedirect called (will redirect now)');
      return { success: true };
    }

    // Desktop: try popup first
    console.log('🟣 [googleAuth] Desktop detected - using popup flow');
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

    // Handle specific error cases
    if (
      authError.code === 'auth/popup-blocked' ||
      authError.code === 'auth/operation-not-supported-in-this-environment' ||
      authError.code === 'auth/blocked-by-user-agent'
    ) {
      console.log('🟡 [googleAuth] Popup blocked, attempting redirect fallback');
      // Fallback to redirect method only when not in local dev (to avoid /__/firebase/init.json 404)
      try {
        const hostname = typeof window !== 'undefined' ? window.location.hostname : '';
        const isLocalDev = hostname === 'localhost' || hostname === '127.0.0.1';
        if (isLocalDev) {
          console.error('🔴 [googleAuth] In local dev, cannot use redirect');
          return {
            success: false,
            error: 'Popup bloccato. In sviluppo locale abilita i popup o usa un browser diverso.',
            code: authError.code,
          };
        }
        console.log('🟡 [googleAuth] Calling signInWithRedirect as fallback...');
        await signInWithRedirect(auth, googleProvider);
        return { success: true };
      } catch (redirectError: unknown) {
        const redirectAuthError = redirectError as { code?: string; message?: string };
        console.error('🔴 [googleAuth] Redirect fallback failed:', redirectAuthError);
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
