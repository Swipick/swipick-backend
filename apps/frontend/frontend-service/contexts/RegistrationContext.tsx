'use client';

import React, { createContext, useContext, useState, ReactNode } from 'react';
import { useAuthContext } from '../src/contexts/AuthContext';

interface RegistrationData {
  nome: string;
  sopranome: string;
  email: string;
  password: string;        // Optional for email link flow
  confirmPassword: string; // Optional for email link flow
  agreeToTerms: boolean;
}

interface RegistrationContextType {
  registrationData: RegistrationData;
  updateField: (field: keyof RegistrationData, value: string | boolean) => void;
  validateForm: () => boolean;
  submitRegistration: () => Promise<void>;
  errors: Record<keyof RegistrationData, string>;
  isLoading: boolean;
  resetForm: () => void;
  isEmailLinkSent: boolean; // New: tracks if email link was sent
}

const initialData: RegistrationData = {
  nome: '',
  sopranome: '',
  email: '',
  password: '',
  confirmPassword: '',
  agreeToTerms: false,
};

const RegistrationContext = createContext<RegistrationContextType | undefined>(undefined);

export const useRegistration = () => {
  const context = useContext(RegistrationContext);
  if (context === undefined) {
    throw new Error('useRegistration must be used within a RegistrationProvider');
  }
  return context;
};

interface RegistrationProviderProps {
  children: ReactNode;
}

export const RegistrationProvider: React.FC<RegistrationProviderProps> = ({ children }) => {
  const [registrationData, setRegistrationData] = useState<RegistrationData>(initialData);
  const [errors, setErrors] = useState<Record<keyof RegistrationData, string>>({
    nome: '',
    sopranome: '',
    email: '',
    password: '',
    confirmPassword: '',
    agreeToTerms: '',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isEmailLinkSent, setIsEmailLinkSent] = useState(false);

  // Get Firebase auth context
  const { register, sendEmailVerification } = useAuthContext();

  const updateField = (field: keyof RegistrationData, value: string | boolean) => {
    setRegistrationData(prev => ({
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

    // Real-time password confirmation validation
    if (field === 'confirmPassword' || field === 'password') {
      const newData = { ...registrationData, [field]: value };
      if (typeof newData.password === 'string' && typeof newData.confirmPassword === 'string' && 
          newData.password && newData.confirmPassword) {
        if (newData.password !== newData.confirmPassword) {
          setErrors(prev => ({
            ...prev,
            confirmPassword: 'Le password non corrispondono',
          }));
        } else {
          setErrors(prev => ({
            ...prev,
            confirmPassword: '',
          }));
        }
      }
    }
  };

  const validateField = (field: keyof RegistrationData, value: string | boolean): string => {
    if (field === 'agreeToTerms') {
      return !value ? 'Devi accettare i termini di servizio' : '';
    }
    
    const stringValue = value as string;
    switch (field) {
      case 'nome':
      case 'sopranome':
        if (!stringValue.trim()) {
          return `${field === 'nome' ? 'Nome' : 'Sopranome'} è richiesto`;
        }
        if (stringValue.trim().length < 2) {
          return `${field === 'nome' ? 'Nome' : 'Sopranome'} deve avere almeno 2 caratteri`;
        }
        if (!/^[a-zA-ZÀ-ÿ\s]+$/.test(stringValue)) {
          return 'Solo lettere e spazi sono consentiti';
        }
        return '';

      case 'email':
        if (!stringValue.trim()) {
          return 'Email è richiesta';
        }
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(stringValue)) {
          return 'Formato email non valido';
        }
        return '';

      case 'password':
        // Password is required for account creation
        if (!stringValue) {
          return 'Password è richiesta';
        }
        if (stringValue.length < 8) {
          return 'Password deve avere almeno 8 caratteri';
        }
        if (!/(?=.*[a-z])/.test(stringValue)) {
          return 'Password deve contenere almeno una lettera minuscola';
        }
        if (!/(?=.*[A-Z])/.test(stringValue)) {
          return 'Password deve contenere almeno una lettera maiuscola';
        }
        if (!/(?=.*\d)/.test(stringValue)) {
          return 'Password deve contenere almeno un numero';
        }
        return '';

      case 'confirmPassword':
        // Password confirmation is required
        if (!stringValue) {
          return 'Conferma password è richiesta';
        }
        if (stringValue !== registrationData.password) {
          return 'Le password non corrispondono';
        }
        return '';

      default:
        return '';
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Record<keyof RegistrationData, string> = {
      nome: '',
      sopranome: '',
      email: '',
      password: '',
      confirmPassword: '',
      agreeToTerms: '',
    };

    let isValid = true;

    (Object.keys(registrationData) as Array<keyof RegistrationData>).forEach(field => {
      const error = validateField(field, registrationData[field]);
      if (error) {
        newErrors[field] = error;
        isValid = false;
      }
    });

    setErrors(newErrors);
    return isValid;
  };

  const submitRegistration = async (): Promise<void> => {
    setIsLoading(true);
    
    try {
      if (!validateForm()) {
        return;
      }

      // Create Firebase account with email and password
      await register(registrationData.email, registrationData.password);
      
      // Send email verification after account creation
      await sendEmailVerification();
      
      // Set email link sent state (for verification email)
      setIsEmailLinkSent(true);
      
      console.log('Registration completed and verification email sent:', {
        nome: registrationData.nome,
        sopranome: registrationData.sopranome,
        email: registrationData.email,
        agreeToTerms: registrationData.agreeToTerms,
      });

      // Note: We don't reset the form here because we want to keep the data
      // until the user completes the email verification process
      
    } catch (error) {
      console.error('Registration error:', error);
      setErrors(prev => ({
        ...prev,
        email: error instanceof Error ? error.message : 'Errore durante la registrazione',
      }));
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setRegistrationData(initialData);
    setErrors({
      nome: '',
      sopranome: '',
      email: '',
      password: '',
      confirmPassword: '',
      agreeToTerms: '',
    });
    setIsEmailLinkSent(false);
  };

  const value: RegistrationContextType = {
    registrationData,
    updateField,
    validateForm,
    submitRegistration,
    errors,
    isLoading,
    resetForm,
    isEmailLinkSent,
  };

  return (
    <RegistrationContext.Provider value={value}>
      {children}
    </RegistrationContext.Provider>
  );
};
