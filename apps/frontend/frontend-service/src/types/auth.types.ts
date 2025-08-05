/**
 * Firebase Authentication Types
 * Types for Firebase auth integration and email link authentication
 */

/**
 * Firebase User interface - represents authenticated user from Firebase
 */
export interface FirebaseUser {
  uid: string;
  email: string | null;
  emailVerified: boolean;
  accessToken: string;
  displayName?: string | null;
  photoURL?: string | null;
}

/**
 * AuthContext interface - Firebase authentication state management
 */
export interface AuthContextType {
  // Authentication state
  firebaseUser: FirebaseUser | null;
  loading: boolean;
  error: string | null;
  isEmailLinkSent: boolean;
  emailForSignIn: string | null;

  // Firebase auth methods
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  
  // Email link authentication methods
  sendSignInLinkToEmail: (email: string) => Promise<void>;
  signInWithEmailLink: (email: string, emailLink: string) => Promise<void>;
  isSignInWithEmailLink: (link: string) => boolean;
  
  // Email verification methods
  sendEmailVerification: () => Promise<void>;
  sendPasswordReset: (email: string) => Promise<void>;

  // Utility methods
  clearError: () => void;
  getAuthToken: () => Promise<string | null>;
  setEmailForSignIn: (email: string) => void;
  clearEmailForSignIn: () => void;
}

/**
 * ActionCodeSettings for Firebase email link configuration
 */
export interface ActionCodeSettings {
  url: string;
  handleCodeInApp: boolean;
  iOS?: {
    bundleId: string;
  };
  android?: {
    packageName: string;
    installApp?: boolean;
    minimumVersion?: string;
  };
  linkDomain?: string;
}

/**
 * Registration form data structure
 */
export interface RegisterFormData {
  name: string;      // Nome (Full name)
  nickname: string;  // Sopranome (Username)
  email: string;     // Email address
  password: string;  // Password (optional for email link flow)
  confirmPassword: string; // Password confirmation (optional)
  agreeToTerms: boolean;   // Terms agreement
}

/**
 * Auth error types
 */
export interface AuthError {
  code: string;
  message: string;
}

/**
 * Auth loading states
 */
export interface AuthLoadingStates {
  login: boolean;
  register: boolean;
  logout: boolean;
  emailLink: boolean;
  emailVerification: boolean;
  passwordReset: boolean;
}
