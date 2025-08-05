/**
 * User Profile Types
 * Types for user profile data from Neon database
 */

/**
 * User profile interface - represents user data from Neon DB
 */
export interface UserProfile {
  id: string;
  firebaseUid: string;
  name: string;        // Nome
  nickname: string;    // Sopranome  
  email: string;
  createdAt: Date;
  updatedAt: Date;
  isActive: boolean;
  emailVerified: boolean;
}

/**
 * UserContext interface - User profile state management
 */
export interface UserContextType {
  // User profile state
  user: UserProfile | null;
  loading: boolean;
  error: string | null;

  // User profile methods (BFF API calls)
  fetchUser: (firebaseUid: string) => Promise<void>;
  updateUser: (updates: Partial<UserProfile>) => Promise<void>;
  handleChange: (field: keyof UserProfile, value: string | boolean | Date) => void;

  // Registration with backend sync
  registerUser: (userData: RegisterFormData) => Promise<void>;

  // Utility methods
  clearError: () => void;
  refreshUser: () => Promise<void>;
}

/**
 * Registration form data for backend API
 */
export interface RegisterFormData {
  name: string;
  nickname: string;
  email: string;
  password?: string; // Optional for email link flow
  confirmPassword?: string; // Optional for email link flow
  agreeToTerms: boolean;
}

/**
 * User registration request payload
 */
export interface UserRegistrationPayload {
  firebaseUid: string;
  name: string;
  nickname: string;
  email: string;
  emailVerified: boolean;
}

/**
 * User update payload
 */
export interface UserUpdatePayload {
  name?: string;
  nickname?: string;
  email?: string;
  isActive?: boolean;
  emailVerified?: boolean;
}

/**
 * API response types
 */
export interface UserApiResponse {
  success: boolean;
  data?: UserProfile;
  error?: string;
  message?: string;
}

/**
 * User loading states
 */
export interface UserLoadingStates {
  fetch: boolean;
  update: boolean;
  register: boolean;
  delete: boolean;
}
