// Login Types and Interfaces
// Created for IMP-20250805-004 - Login Page Implementation

export interface LoginFormData {
  email: string;
  password: string;
  rememberMe: boolean;
}

export interface LoginFormErrors {
  email: string;
  password: string;
  rememberMe: string;
  general?: string;
}

export interface LoginValidationRules {
  email: {
    required: boolean;
    pattern: RegExp;
    message: string;
  };
  password: {
    required: boolean;
    minLength: number;
    message: string;
  };
}

export interface LoginContextType {
  // Form state
  formData: LoginFormData;
  errors: LoginFormErrors;
  isLoading: boolean;
  
  // Form operations
  updateField: (field: keyof LoginFormData, value: string | boolean) => void;
  validateForm: () => boolean;
  submitLogin: () => Promise<void>;
  resetForm: () => void;
  
  // Error handling
  clearError: (field?: keyof LoginFormErrors) => void;
  
  // Password reset
  isPasswordResetSent: boolean;
  sendPasswordReset: (email: string) => Promise<void>;
}

export interface UseLoginHookReturn {
  // Authentication operations
  performLogin: (email: string, password: string) => Promise<void>;
  performPasswordReset: (email: string) => Promise<void>;
  
  // State management
  isAuthenticating: boolean;
  authError: string | null;
  clearAuthError: () => void;
  
  // Email verification handling
  checkEmailVerification: () => Promise<boolean>;
  resendEmailVerification: () => Promise<void>;
}

// Firebase Auth Error Types for Italian Messages
export interface FirebaseAuthError {
  code: string;
  message: string;
}

export const FIREBASE_ERROR_MESSAGES: Record<string, string> = {
  'auth/user-not-found': 'Nessun account trovato con questo indirizzo email',
  'auth/wrong-password': 'Password non corretta',
  'auth/invalid-email': 'Indirizzo email non valido',
  'auth/user-disabled': 'Account disabilitato. Contatta l\'assistenza',
  'auth/too-many-requests': 'Troppi tentativi. Riprova più tardi',
  'auth/network-request-failed': 'Errore di connessione. Controlla la rete',
  'auth/internal-error': 'Errore del server. Riprova più tardi',
  'auth/invalid-credential': 'Credenziali non valide',
  'auth/operation-not-allowed': 'Operazione non consentita',
  'auth/weak-password': 'Password troppo debole',
  'default': 'Errore imprevisto. Riprova'
};

// Login Form Field Validation Rules
export const LOGIN_VALIDATION_RULES: LoginValidationRules = {
  email: {
    required: true,
    pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    message: 'Inserisci un indirizzo email valido'
  },
  password: {
    required: true,
    minLength: 1,
    message: 'Password richiesta'
  }
};

// Login Form Initial State
export const INITIAL_LOGIN_FORM_DATA: LoginFormData = {
  email: '',
  password: '',
  rememberMe: false
};

export const INITIAL_LOGIN_FORM_ERRORS: LoginFormErrors = {
  email: '',
  password: '',
  rememberMe: ''
};
