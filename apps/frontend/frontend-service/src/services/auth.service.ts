/**
 * Firebase Authentication Service
 * Handles Firebase auth operations including email link authentication
 */

import { 
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  sendEmailVerification as firebaseSendEmailVerification,
  sendPasswordResetEmail,
  getIdToken,
  onAuthStateChanged as firebaseOnAuthStateChanged,
  sendSignInLinkToEmail as firebaseSendSignInLinkToEmail,
  signInWithEmailLink as firebaseSignInWithEmailLink,
  isSignInWithEmailLink as firebaseIsSignInWithEmailLink,
  User
} from 'firebase/auth';

import { auth } from '@/lib/firebase';
import { FirebaseUser, ActionCodeSettings } from '../types/auth.types';
import { getFirebaseErrorMessage } from '../utils/firebase-errors';

/**
 * Firebase Authentication Service Class
 * Provides methods for Firebase authentication operations
 */
export class AuthService {
  
  /**
   * ActionCodeSettings for email link authentication
   * Configure how Firebase constructs the email link
   */
  private getActionCodeSettings(): ActionCodeSettings {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    
    return {
      // URL where user will be redirected after clicking email link
      url: `${baseUrl}/login?mode=emailLink`,
      handleCodeInApp: true, // Must be true for email link authentication
      iOS: {
        bundleId: 'com.swipick.app'
      },
      android: {
        packageName: 'com.swipick.app',
        installApp: true,
        minimumVersion: '12'
      }
    };
  }

  /**
   * Convert Firebase User to our FirebaseUser interface
   */
  private async convertFirebaseUser(user: User): Promise<FirebaseUser> {
    const token = await getIdToken(user);
    return {
      uid: user.uid,
      email: user.email,
      emailVerified: user.emailVerified,
      accessToken: token,
      displayName: user.displayName,
      photoURL: user.photoURL
    };
  }

  /**
   * Register user with email and password
   */
  async registerWithEmail(email: string, password: string): Promise<FirebaseUser> {
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      return await this.convertFirebaseUser(userCredential.user);
    } catch (error) {
      throw new Error(getFirebaseErrorMessage(error));
    }
  }

  /**
   * Login user with email and password
   */
  async loginWithEmail(email: string, password: string): Promise<FirebaseUser> {
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      return await this.convertFirebaseUser(userCredential.user);
    } catch (error) {
      throw new Error(getFirebaseErrorMessage(error));
    }
  }

  /**
   * Send sign-in link to user's email (passwordless authentication)
   */
  async sendSignInLinkToEmail(email: string): Promise<void> {
    try {
      const actionCodeSettings = this.getActionCodeSettings();
      await firebaseSendSignInLinkToEmail(auth, email, actionCodeSettings);
      
      // Save email locally for completing sign-in on same device
      if (typeof window !== 'undefined') {
        window.localStorage.setItem('emailForSignIn', email);
      }
    } catch (error) {
      throw new Error(getFirebaseErrorMessage(error));
    }
  }

  /**
   * Sign in with email link (complete passwordless authentication)
   */
  async signInWithEmailLink(email: string, emailLink: string): Promise<FirebaseUser> {
    try {
      const userCredential = await firebaseSignInWithEmailLink(auth, email, emailLink);
      
      // Clear saved email from localStorage
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem('emailForSignIn');
      }
      
      return await this.convertFirebaseUser(userCredential.user);
    } catch (error) {
      throw new Error(getFirebaseErrorMessage(error));
    }
  }

  /**
   * Check if current URL is a sign-in with email link
   */
  isSignInWithEmailLink(link: string): boolean {
    return firebaseIsSignInWithEmailLink(auth, link);
  }

  /**
   * Get saved email from localStorage (for email link authentication)
   */
  getSavedEmailForSignIn(): string | null {
    if (typeof window !== 'undefined') {
      return window.localStorage.getItem('emailForSignIn');
    }
    return null;
  }

  /**
   * Clear saved email from localStorage
   */
  clearSavedEmail(): void {
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem('emailForSignIn');
    }
  }

  /**
   * Logout current user
   */
  async logout(): Promise<void> {
    try {
      await signOut(auth);
      // Clear any saved email data
      this.clearSavedEmail();
    } catch (error) {
      throw new Error(getFirebaseErrorMessage(error));
    }
  }

  /**
   * Send email verification to current user
   */
  async sendEmailVerification(): Promise<void> {
    try {
      if (!auth.currentUser) {
        throw new Error('Nessun utente attualmente autenticato');
      }
      await firebaseSendEmailVerification(auth.currentUser);
    } catch (error) {
      throw new Error(getFirebaseErrorMessage(error));
    }
  }

  /**
   * Check if current user's email is verified
   */
  async checkEmailVerification(): Promise<boolean> {
    if (!auth.currentUser) {
      return false;
    }
    
    // Reload user to get fresh verification status
    await auth.currentUser.reload();
    return auth.currentUser.emailVerified;
  }

  /**
   * Send password reset email
   */
  async sendPasswordReset(email: string): Promise<void> {
    try {
      await sendPasswordResetEmail(auth, email);
    } catch (error) {
      throw new Error(getFirebaseErrorMessage(error));
    }
  }

  /**
   * Get current user's auth token
   */
  async getCurrentUserToken(): Promise<string | null> {
    try {
      if (!auth.currentUser) {
        return null;
      }
      return await getIdToken(auth.currentUser);
    } catch (error) {
      console.error('Error getting auth token:', error);
      return null;
    }
  }

  /**
   * Listen to auth state changes
   */
  onAuthStateChanged(callback: (user: FirebaseUser | null) => void): () => void {
    return firebaseOnAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const firebaseUser = await this.convertFirebaseUser(user);
          callback(firebaseUser);
        } catch (error) {
          console.error('Error converting Firebase user:', error);
          callback(null);
        }
      } else {
        callback(null);
      }
    });
  }

  /**
   * Get current user
   */
  getCurrentUser(): User | null {
    return auth.currentUser;
  }
}

// Export singleton instance
export const authService = new AuthService();
