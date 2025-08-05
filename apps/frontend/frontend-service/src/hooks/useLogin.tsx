'use client';

import { useState } from 'react';
import { useAuthContext } from '../contexts/AuthContext';
import { UseLoginHookReturn, FIREBASE_ERROR_MESSAGES } from '../types/login.types';

export const useLogin = (): UseLoginHookReturn => {
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // Get Firebase auth methods from AuthContext
  const { 
    login, 
    sendPasswordReset, 
    firebaseUser,
    sendEmailVerification 
  } = useAuthContext();

  const performLogin = async (email: string, password: string): Promise<void> => {
    setIsAuthenticating(true);
    setAuthError(null);
    
    try {
      await login(email, password);
      console.log('Login completed successfully');
      
    } catch (error) {
      console.error('Login failed:', error);
      
      // Convert Firebase error to Italian message
      if (error && typeof error === 'object' && 'code' in error) {
        const firebaseError = error as { code: string };
        const errorMessage = FIREBASE_ERROR_MESSAGES[firebaseError.code] || FIREBASE_ERROR_MESSAGES.default;
        setAuthError(errorMessage);
      } else {
        setAuthError(FIREBASE_ERROR_MESSAGES.default);
      }
      
      throw error;
    } finally {
      setIsAuthenticating(false);
    }
  };

  const performPasswordReset = async (email: string): Promise<void> => {
    setAuthError(null);
    
    try {
      await sendPasswordReset(email);
      console.log('Password reset email sent successfully');
      
    } catch (error) {
      console.error('Password reset failed:', error);
      
      // Convert Firebase error to Italian message
      if (error && typeof error === 'object' && 'code' in error) {
        const firebaseError = error as { code: string };
        const errorMessage = FIREBASE_ERROR_MESSAGES[firebaseError.code] || FIREBASE_ERROR_MESSAGES.default;
        setAuthError(errorMessage);
      } else {
        setAuthError('Errore durante l\'invio dell\'email di reset');
      }
      
      throw error;
    }
  };

  const checkEmailVerification = async (): Promise<boolean> => {
    try {
      if (!firebaseUser) {
        console.log('No user logged in');
        return false;
      }

      // For our custom FirebaseUser interface, we can check the emailVerified property directly
      // The AuthContext should handle reloading the user state when needed
      const isVerified = firebaseUser.emailVerified;
      console.log('Email verification status:', isVerified);
      
      return isVerified;
      
    } catch (error) {
      console.error('Error checking email verification:', error);
      return false;
    }
  };

  const resendEmailVerification = async (): Promise<void> => {
    try {
      if (!firebaseUser) {
        throw new Error('No user logged in');
      }

      await sendEmailVerification();
      console.log('Email verification sent successfully');
      
    } catch (error) {
      console.error('Error sending email verification:', error);
      
      // Convert Firebase error to Italian message
      if (error && typeof error === 'object' && 'code' in error) {
        const firebaseError = error as { code: string };
        const errorMessage = FIREBASE_ERROR_MESSAGES[firebaseError.code] || FIREBASE_ERROR_MESSAGES.default;
        setAuthError(errorMessage);
      } else {
        setAuthError('Errore durante l\'invio dell\'email di verifica');
      }
      
      throw error;
    }
  };

  const clearAuthError = () => {
    setAuthError(null);
  };

  return {
    // Authentication operations
    performLogin,
    performPasswordReset,
    
    // State management
    isAuthenticating,
    authError,
    clearAuthError,
    
    // Email verification handling
    checkEmailVerification,
    resendEmailVerification,
  };
};
