/**
 * Validation utilities for form inputs
 */

export interface ValidationResult {
  isValid: boolean;
  error: string;
}

/**
 * Validates name fields (Nome, Sopranome)
 */
export const validateName = (value: string, fieldName: string): ValidationResult => {
  if (!value.trim()) {
    return {
      isValid: false,
      error: `${fieldName} è richiesto`,
    };
  }

  if (value.trim().length < 2) {
    return {
      isValid: false,
      error: `${fieldName} deve avere almeno 2 caratteri`,
    };
  }

  if (!/^[a-zA-ZÀ-ÿ\s]+$/.test(value)) {
    return {
      isValid: false,
      error: 'Solo lettere e spazi sono consentiti',
    };
  }

  return { isValid: true, error: '' };
};

/**
 * Validates email format
 */
export const validateEmail = (email: string): ValidationResult => {
  if (!email.trim()) {
    return {
      isValid: false,
      error: 'Email è richiesta',
    };
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return {
      isValid: false,
      error: 'Formato email non valido',
    };
  }

  return { isValid: true, error: '' };
};

/**
 * Validates password strength
 */
export const validatePassword = (password: string): ValidationResult => {
  if (!password) {
    return {
      isValid: false,
      error: 'Password è richiesta',
    };
  }

  if (password.length < 8) {
    return {
      isValid: false,
      error: 'Password deve avere almeno 8 caratteri',
    };
  }

  if (!/(?=.*[a-z])/.test(password)) {
    return {
      isValid: false,
      error: 'Password deve contenere almeno una lettera minuscola',
    };
  }

  if (!/(?=.*[A-Z])/.test(password)) {
    return {
      isValid: false,
      error: 'Password deve contenere almeno una lettera maiuscola',
    };
  }

  if (!/(?=.*\d)/.test(password)) {
    return {
      isValid: false,
      error: 'Password deve contenere almeno un numero',
    };
  }

  return { isValid: true, error: '' };
};

/**
 * Validates password confirmation
 */
export const validatePasswordConfirmation = (
  password: string,
  confirmPassword: string
): ValidationResult => {
  if (!confirmPassword) {
    return {
      isValid: false,
      error: 'Conferma password è richiesta',
    };
  }

  if (password !== confirmPassword) {
    return {
      isValid: false,
      error: 'Le password non corrispondono',
    };
  }

  return { isValid: true, error: '' };
};

/**
 * Password strength assessment
 */
export interface PasswordStrength {
  score: number;
  label: string;
  color: string;
  percentage: number;
}

export const getPasswordStrength = (password: string): PasswordStrength => {
  if (!password) {
    return {
      score: 0,
      label: '',
      color: 'bg-gray-300',
      percentage: 0,
    };
  }

  let score = 0;
  const checks = [
    password.length >= 8,
    /[a-z]/.test(password),
    /[A-Z]/.test(password),
    /\d/.test(password),
    /[!@#$%^&*(),.?":{}|<>]/.test(password),
  ];

  score = checks.filter(Boolean).length;

  if (score <= 2) {
    return {
      score,
      label: 'Debole',
      color: 'bg-red-500',
      percentage: (score / 5) * 100,
    };
  }

  if (score <= 3) {
    return {
      score,
      label: 'Media',
      color: 'bg-yellow-500',
      percentage: (score / 5) * 100,
    };
  }

  if (score <= 4) {
    return {
      score,
      label: 'Forte',
      color: 'bg-green-500',
      percentage: (score / 5) * 100,
    };
  }

  return {
    score,
    label: 'Molto Forte',
    color: 'bg-green-600',
    percentage: (score / 5) * 100,
  };
};

/**
 * Normalizes email by converting to lowercase and trimming whitespace
 */
export const normalizeEmail = (email: string): string => {
  return email.toLowerCase().trim();
};

/**
 * Normalizes name by trimming whitespace and capitalizing first letter
 */
export const normalizeName = (name: string): string => {
  return name
    .trim()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
};
