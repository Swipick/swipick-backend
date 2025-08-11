'use client';

import React, { createContext, useContext, useState, ReactNode } from 'react';
import { useLogin } from '../hooks/useLogin';
import {
  LoginFormData,
  LoginFormErrors,
  LoginContextType,
  INITIAL_LOGIN_FORM_DATA,
  INITIAL_LOGIN_FORM_ERRORS,
  LOGIN_VALIDATION_RULES,
  FIREBASE_ERROR_MESSAGES
} from '../types/login.types';

const LoginContext = createContext<LoginContextType | undefined>(undefined);

export const useLoginContext = () => {
  const context = useContext(LoginContext);
  if (context === undefined) {
    throw new Error('useLoginContext must be used within a LoginProvider');
  }
  return context;
};

interface LoginProviderProps {
  children: ReactNode;
}

export const LoginProvider: React.FC<LoginProviderProps> = ({ children }) => {
  const [formData, setFormData] = useState<LoginFormData>(INITIAL_LOGIN_FORM_DATA);
  const [errors, setErrors] = useState<LoginFormErrors>(INITIAL_LOGIN_FORM_ERRORS);
  const [isLoading, setIsLoading] = useState(false);
  const [isPasswordResetSent, setIsPasswordResetSent] = useState(false);

  // Get Firebase auth context and login hook
  const { 
    performLogin, 
    performPasswordReset, 
    isAuthenticating, 
    authError, 
    clearAuthError,
    checkEmailVerification 
  } = useLogin();

  const updateField = (field: keyof LoginFormData, value: string | boolean) => {
    setFormData(prev => ({
      ...prev,
      [field]: value,
    }));

    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({
        ...prev,
        [field]: '',
      }));
    }

    // Clear general error when any field changes
    if (errors.general) {
      setErrors(prev => ({
        ...prev,
        general: '',
      }));
    }
  };

  const validateField = (field: keyof LoginFormData, value: string | boolean): string => {
    if (field === 'rememberMe') {
      // Remember me is optional, no validation needed
      return '';
    }
    
    const stringValue = value as string;
    
    switch (field) {
      case 'email':
        if (!stringValue.trim()) {
          return 'Email è richiesta';
        }
        if (!LOGIN_VALIDATION_RULES.email.pattern.test(stringValue)) {
          return LOGIN_VALIDATION_RULES.email.message;
        }
        return '';

      case 'password':
        if (!stringValue) {
          return LOGIN_VALIDATION_RULES.password.message;
        }
        return '';

      default:
        return '';
    }
  };

  const validateForm = (): boolean => {
    const newErrors: LoginFormErrors = {
      email: '',
      password: '',
      rememberMe: '',
    };

    let isValid = true;

    // Validate each field
    (Object.keys(formData) as Array<keyof LoginFormData>).forEach(field => {
      if (field !== 'rememberMe') { // Skip rememberMe validation
        const error = validateField(field, formData[field]);
        if (error) {
          newErrors[field] = error;
          isValid = false;
        }
      }
    });

    setErrors(newErrors);
    return isValid;
  };

  const submitLogin = async (): Promise<void> => {
    setIsLoading(true);
    clearAuthError();
    
    try {
      // Validate form before submission
      if (!validateForm()) {
        return;
      }

      // Perform login using the custom hook
      await performLogin(formData.email, formData.password);
      
      // Check email verification status
      const isEmailVerified = await checkEmailVerification();
      
      if (!isEmailVerified) {
        // Handle unverified email case
        // This will be handled by the EmailVerificationPrompt component
        console.log('Email not verified, showing verification prompt');
        return;
      }

      console.log('Login successful:', {
        email: formData.email,
        rememberMe: formData.rememberMe,
        emailVerified: isEmailVerified
      });

      // Login successful - navigation will be handled by the page component
      
    } catch (error) {
      console.error('Login error:', error);
      
      // Handle Firebase auth errors with Italian messages
      if (error && typeof error === 'object' && 'code' in error) {
        const firebaseError = error as { code: string };
        const errorMessage = FIREBASE_ERROR_MESSAGES[firebaseError.code] || FIREBASE_ERROR_MESSAGES.default;
        
        setErrors(prev => ({
          ...prev,
          general: errorMessage,
        }));
      } else {
        setErrors(prev => ({
          ...prev,
          general: FIREBASE_ERROR_MESSAGES.default,
        }));
      }
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setFormData(INITIAL_LOGIN_FORM_DATA);
    setErrors(INITIAL_LOGIN_FORM_ERRORS);
    setIsPasswordResetSent(false);
    clearAuthError();
  };

  const clearError = (field?: keyof LoginFormErrors) => {
    if (field) {
      setErrors(prev => ({
        ...prev,
        [field]: '',
      }));
    } else {
      setErrors(INITIAL_LOGIN_FORM_ERRORS);
    }
    clearAuthError();
  };

  const sendPasswordReset = async (email: string): Promise<void> => {
    try {
      await performPasswordReset(email);
      setIsPasswordResetSent(true);
      
      console.log('Password reset email sent to:', email);
      
    } catch (error) {
      console.error('Password reset error:', error);
      
      // Handle Firebase auth errors
      if (error && typeof error === 'object' && 'code' in error) {
        const firebaseError = error as { code: string };
        const errorMessage = FIREBASE_ERROR_MESSAGES[firebaseError.code] || FIREBASE_ERROR_MESSAGES.default;
        
        setErrors(prev => ({
          ...prev,
          general: errorMessage,
        }));
      } else {
        setErrors(prev => ({
          ...prev,
          general: 'Errore durante l\'invio dell\'email di reset',
        }));
      }
      
      throw error;
    }
  };

  const value: LoginContextType = {
    // Form state
    formData,
    errors: {
      ...errors,
      general: authError || errors.general
    },
    isLoading: isLoading || isAuthenticating,
    
    // Form operations
    updateField,
    validateForm,
    submitLogin,
    resetForm,
    
    // Error handling
    clearError,
    
    // Password reset
    isPasswordResetSent,
    sendPasswordReset,
  };

  return (
    <LoginContext.Provider value={value}>
      {children}
    </LoginContext.Provider>
  );
};
