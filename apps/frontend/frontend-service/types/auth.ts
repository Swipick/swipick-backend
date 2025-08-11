/**
 * Authentication-related type definitions
 */

export interface User {
  id: string;
  nome: string;
  sopranome: string;
  email: string;
  emailVerified: boolean;
  createdAt: string;
  lastLogin?: string;
  status: 'active' | 'inactive' | 'suspended';
  profileImageUrl?: string;
  preferences: Record<string, unknown>;
}

export interface RegistrationData {
  nome: string;
  sopranome: string;
  email: string;
  password: string;
  confirmPassword: string;
  agreeToTerms: boolean;
}

export interface LoginData {
  email: string;
  password: string;
  rememberMe?: boolean;
}

export interface AuthResponse {
  success: boolean;
  user?: User;
  token?: string;
  refreshToken?: string;
  message?: string;
  errors?: Record<string, string>;
}

export interface ValidationError {
  field: string;
  message: string;
}

export interface FormErrors {
  [key: string]: string;
}

export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

export interface PasswordResetData {
  email: string;
}

export interface PasswordChangeData {
  currentPassword: string;
  newPassword: string;
  confirmNewPassword: string;
}

export interface EmailVerificationData {
  token: string;
  email: string;
}

// API Endpoints
export const AUTH_ENDPOINTS = {
  REGISTER: '/api/auth/register',
  LOGIN: '/api/auth/login',
  LOGOUT: '/api/auth/logout',
  REFRESH: '/api/auth/refresh',
  VERIFY_EMAIL: '/api/auth/verify-email',
  FORGOT_PASSWORD: '/api/auth/forgot-password',
  RESET_PASSWORD: '/api/auth/reset-password',
  CHANGE_PASSWORD: '/api/auth/change-password',
  PROFILE: '/api/auth/profile',
} as const;

// Form field names
export const REGISTRATION_FIELDS = {
  NOME: 'nome',
  SOPRANOME: 'sopranome',
  EMAIL: 'email',
  PASSWORD: 'password',
  CONFIRM_PASSWORD: 'confirmPassword',
} as const;

export const LOGIN_FIELDS = {
  EMAIL: 'email',
  PASSWORD: 'password',
  REMEMBER_ME: 'rememberMe',
} as const;
