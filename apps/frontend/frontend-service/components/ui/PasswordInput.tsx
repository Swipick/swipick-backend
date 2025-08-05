'use client';

import React, { useState } from 'react';

// Custom SVG Icons
const EyeIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
  </svg>
);

const EyeSlashIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L9.878 9.878M9.878 9.878L9.878 9.878M9.878 9.878L12 12L9.878 9.878ZM21 21l-3.053-3.053M21 21l-3.053-3.053M21 21l-3.053-3.053M21 21l-3.053-3.053" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3l18 18" />
  </svg>
);

interface PasswordInputProps {
  id: string;
  name: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  error?: string;
  className?: string;
  disabled?: boolean;
  showStrengthIndicator?: boolean;
  showConfirmationIcon?: boolean;
  isValid?: boolean;
}

const PasswordInput: React.FC<PasswordInputProps> = ({
  id,
  name,
  placeholder,
  value,
  onChange,
  onBlur,
  error,
  className = '',
  disabled = false,
  showStrengthIndicator = false,
  showConfirmationIcon = false,
  isValid = false,
}) => {
  const [showPassword, setShowPassword] = useState(false);

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  const getPasswordStrength = (password: string): { strength: number; label: string; color: string } => {
    if (!password) return { strength: 0, label: '', color: '' };

    let score = 0;
    const checks = [
      password.length >= 8,
      /[a-z]/.test(password),
      /[A-Z]/.test(password),
      /\d/.test(password),
      /[!@#$%^&*(),.?":{}|<>]/.test(password),
    ];

    score = checks.filter(Boolean).length;

    if (score <= 2) return { strength: score, label: 'Debole', color: 'bg-red-500' };
    if (score <= 3) return { strength: score, label: 'Media', color: 'bg-yellow-500' };
    if (score <= 4) return { strength: score, label: 'Forte', color: 'bg-green-500' };
    return { strength: score, label: 'Molto Forte', color: 'bg-green-600' };
  };

  const passwordStrength = showStrengthIndicator ? getPasswordStrength(value) : null;

  return (
    <div className="w-full">
      <div className="relative">
        <input
          id={id}
          name={name}
          type={showPassword ? 'text' : 'password'}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          disabled={disabled}
          className={`
            w-full h-10 px-4 pr-12 rounded-lg border transition-all duration-200
            ${error 
              ? 'border-red-500 focus:border-red-500 focus:ring-2 focus:ring-red-200' 
              : isValid && value
                ? 'border-green-500 focus:border-green-500 focus:ring-2 focus:ring-green-200'
                : 'border-gray-300 focus:border-purple-500 focus:ring-2 focus:ring-purple-200'
            }
            ${disabled ? 'bg-gray-100 cursor-not-allowed' : 'bg-white'}
            text-gray-900 placeholder-gray-500
            ${className}
          `}
          aria-describedby={error ? `${id}-error` : undefined}
          aria-invalid={error ? 'true' : 'false'}
        />
        
        <div className="absolute inset-y-0 right-0 flex items-center pr-3 space-x-2">
          {/* Confirmation Icon for confirm password field */}
          {showConfirmationIcon && value && (
            <div className="flex items-center">
              {isValid ? (
                <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              )}
            </div>
          )}
          
          {/* Eye Toggle Button */}
          <button
            type="button"
            onClick={togglePasswordVisibility}
            disabled={disabled}
            className="flex items-center justify-center p-1 text-gray-500 hover:text-gray-700 focus:outline-none focus:text-gray-700 transition-colors duration-200"
            aria-label={showPassword ? 'Nascondi password' : 'Mostra password'}
          >
            {showPassword ? (
              <EyeSlashIcon className="w-5 h-5" />
            ) : (
              <EyeIcon className="w-5 h-5" />
            )}
          </button>
        </div>
      </div>

      {/* Password Strength Indicator */}
      {showStrengthIndicator && value && passwordStrength && (
        <div className="mt-2">
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm text-gray-600">Forza password:</span>
            <span className={`text-sm font-medium ${
              passwordStrength.strength <= 2 ? 'text-red-500' :
              passwordStrength.strength <= 3 ? 'text-yellow-500' :
              'text-green-500'
            }`}>
              {passwordStrength.label}
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all duration-300 ${passwordStrength.color}`}
              style={{ width: `${(passwordStrength.strength / 5) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <p id={`${id}-error`} className="mt-1 text-sm text-red-600" role="alert">
          {error}
        </p>
      )}
    </div>
  );
};

export default PasswordInput;
