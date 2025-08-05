/**
 * Authentication Context
 * Provides Firebase authentication state management across the application
 */

'use client';

import React, { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { AuthContextType, FirebaseUser } from '../types/auth.types';
import { authService } from '../services/auth.service';

/**
 * Create AuthContext
 */
const AuthContext = createContext<AuthContextType | undefined>(undefined);

/**
 * AuthProvider Props
 */
interface AuthProviderProps {
  children: ReactNode;
}

/**
 * AuthProvider Component
 * Manages Firebase authentication state and provides auth methods
 */
export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  // Authentication state
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isEmailLinkSent, setIsEmailLinkSent] = useState<boolean>(false);
  const [emailForSignIn, setEmailForSignInState] = useState<string | null>(null);

  /**
   * Handle email link sign-in when page loads with email link
   */
  const handleEmailLinkSignIn = useCallback(async (emailLink: string) => {
    try {
      setLoading(true);
      setError(null);

      let email = emailForSignIn || authService.getSavedEmailForSignIn();
      
      if (!email) {
        // If no saved email, prompt user for email
        email = window.prompt('Inserisci il tuo indirizzo email per completare l\'accesso:');
      }

      if (!email) {
        throw new Error('Email richiesta per completare l\'accesso');
      }

      // Use the auth service directly to avoid circular dependency
      const user = await authService.signInWithEmailLink(email, emailLink);
      setFirebaseUser(user);
      
      // Clear email link sent state
      setIsEmailLinkSent(false);
      setEmailForSignInState(null);
      
      // Redirect to game page or home
      if (typeof window !== 'undefined') {
        window.history.replaceState({}, document.title, '/gioca');
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Errore durante l\'accesso');
    } finally {
      setLoading(false);
    }
  }, [emailForSignIn]);

  /**
   * Initialize auth state listener on component mount
   */
  useEffect(() => {
    const unsubscribe = authService.onAuthStateChanged((user) => {
      setFirebaseUser(user);
      setLoading(false);
    });

    // Check for saved email for sign-in
    const savedEmail = authService.getSavedEmailForSignIn();
    if (savedEmail) {
      setEmailForSignInState(savedEmail);
    }

    // Check if current URL is an email link sign-in
    if (typeof window !== 'undefined') {
      const currentUrl = window.location.href;
      if (authService.isSignInWithEmailLink(currentUrl)) {
        handleEmailLinkSignIn(currentUrl);
      }
    }

    return () => unsubscribe();
  }, [handleEmailLinkSignIn]);

  /**
   * Login with email and password
   */
  const login = async (email: string, password: string): Promise<void> => {
    try {
      setLoading(true);
      setError(null);
      
      const user = await authService.loginWithEmail(email, password);
      setFirebaseUser(user);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Errore durante l\'accesso');
      throw error;
    } finally {
      setLoading(false);
    }
  };

  /**
   * Register with email and password
   */
  const register = async (email: string, password: string): Promise<void> => {
    try {
      setLoading(true);
      setError(null);
      
      const user = await authService.registerWithEmail(email, password);
      setFirebaseUser(user);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Errore durante la registrazione');
      throw error;
    } finally {
      setLoading(false);
    }
  };

  /**
   * Send sign-in link to email (passwordless authentication)
   */
  const sendSignInLinkToEmail = async (email: string): Promise<void> => {
    try {
      setLoading(true);
      setError(null);
      
      await authService.sendSignInLinkToEmail(email);
      setIsEmailLinkSent(true);
      setEmailForSignInState(email);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Errore nell\'invio dell\'email');
      throw error;
    } finally {
      setLoading(false);
    }
  };

  /**
   * Sign in with email link
   */
  const signInWithEmailLink = async (email: string, emailLink: string): Promise<void> => {
    try {
      setLoading(true);
      setError(null);
      
      const user = await authService.signInWithEmailLink(email, emailLink);
      setFirebaseUser(user);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Errore durante l\'accesso con il link');
      throw error;
    } finally {
      setLoading(false);
    }
  };

  /**
   * Check if URL is a sign-in email link
   */
  const isSignInWithEmailLink = (link: string): boolean => {
    return authService.isSignInWithEmailLink(link);
  };

  /**
   * Logout user
   */
  const logout = async (): Promise<void> => {
    try {
      setLoading(true);
      setError(null);
      
      await authService.logout();
      setFirebaseUser(null);
      
      // Clear email link state
      setIsEmailLinkSent(false);
      clearEmailForSignIn();
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Errore durante il logout');
      throw error;
    } finally {
      setLoading(false);
    }
  };

  /**
   * Sign in with Google
   */
  const signInWithGoogle = async (): Promise<void> => {
    try {
      setLoading(true);
      setError(null);
      
      const { signInWithGoogle: googleSignIn, getAuthErrorMessage } = await import('../../services/googleAuth');
      const result = await googleSignIn();
      
      if (result.success && result.user) {
        setFirebaseUser({
          uid: result.user.uid,
          email: result.user.email,
          emailVerified: result.user.emailVerified,
          accessToken: await result.user.getIdToken(),
          displayName: result.user.displayName,
          photoURL: result.user.photoURL,
        });
      } else if (result.error) {
        const friendlyMessage = getAuthErrorMessage(result.code || '');
        throw new Error(friendlyMessage);
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Errore durante l\'accesso con Google');
      throw error;
    } finally {
      setLoading(false);
    }
  };  /**
   * Send email verification
   */
  const sendEmailVerification = async (): Promise<void> => {
    try {
      setError(null);
      await authService.sendEmailVerification();
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Errore nell\'invio della verifica email');
      throw error;
    }
  };

  /**
   * Send password reset email
   */
  const sendPasswordReset = async (email: string): Promise<void> => {
    try {
      setError(null);
      await authService.sendPasswordReset(email);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Errore nell\'invio del reset password');
      throw error;
    }
  };

  /**
   * Get current user's auth token
   */
  const getAuthToken = async (): Promise<string | null> => {
    try {
      return await authService.getCurrentUserToken();
    } catch (error) {
      console.error('Error getting auth token:', error);
      return null;
    }
  };

  /**
   * Clear current error
   */
  const clearError = (): void => {
    setError(null);
  };

  /**
   * Set email for sign-in (for email link flow)
   */
  const setEmailForSignIn = (email: string): void => {
    setEmailForSignInState(email);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('emailForSignIn', email);
    }
  };

  /**
   * Clear saved email for sign-in
   */
  const clearEmailForSignIn = (): void => {
    setEmailForSignInState(null);
    authService.clearSavedEmail();
  };

  /**
   * Context value
   */
  const value: AuthContextType = {
    // State
    firebaseUser,
    loading,
    error,
    isEmailLinkSent,
    emailForSignIn,

    // Auth methods
    login,
    register,
    logout,
    signInWithGoogle,
    
    // Email link methods
    sendSignInLinkToEmail,
    signInWithEmailLink,
    isSignInWithEmailLink,
    
    // Email verification methods
    sendEmailVerification,
    sendPasswordReset,

    // Utility methods
    clearError,
    getAuthToken,
    setEmailForSignIn,
    clearEmailForSignIn,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

/**
 * Custom hook to use AuthContext
 */
export const useAuthContext = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuthContext must be used within an AuthProvider');
  }
  return context;
};

/**
 * Export default AuthContext
 */
export default AuthContext;
