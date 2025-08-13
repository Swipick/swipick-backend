'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLoginContext } from '../../contexts/LoginContext';

/**
 * VerifiedLoginForm Component
 * Simplified login form for users coming from email verification
 * Matches the clean design from the attached mockup
 */
const VerifiedLoginForm: React.FC = () => {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  
  const {
    formData,
    errors,
    isLoading,
    updateField,
    submitLogin,
    clearError,
    sendPasswordReset
  } = useLoginContext();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await submitLogin();
      router.push('/mode-selection'); // Redirect to mode selection after successful login
    } catch (error) {
      // Error is handled by LoginContext
      console.error('Login failed:', error);
    }
  };

  const handleForgotPassword = async () => {
    if (!formData.email) {
      clearError();
      // Focus on email field and show error
      const emailInput = document.getElementById('email') as HTMLInputElement;
      if (emailInput) {
        emailInput.focus();
      }
      return;
    }
    
    try {
      await sendPasswordReset(formData.email);
      router.push(`/reset-password?email=${encodeURIComponent(formData.email)}&step=sent`);
    } catch (error) {
      console.error('Password reset failed:', error);
    }
  };

  return (
    <div className="space-y-6">
      {/* General Error Message */}
      {errors.general && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-red-800">{errors.general}</p>
            </div>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Email Field */}
        <div>
          <input
            id="email"
            type="email"
            autoComplete="email"
            value={formData.email}
            onChange={(e) => updateField('email', e.target.value)}
            className={`
              w-full h-12 px-4 py-3 border rounded-lg focus:ring-2 focus:ring-[#554099] focus:border-transparent transition-all bg-gray-50 text-gray-900
              ${errors.email
                ? 'border-red-300 bg-red-50' 
                : 'border-gray-200 hover:border-gray-300 focus:border-[#554099] focus:bg-white'
              }
            `}
            placeholder="Email"
            disabled={isLoading}
          />
          {errors.email && (
            <p className="text-sm text-red-600 flex items-center mt-1">
              <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              {errors.email}
            </p>
          )}
        </div>

        {/* Password Field */}
        <div>
          <div className="relative">
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              value={formData.password}
              onChange={(e) => updateField('password', e.target.value)}
              className={`
                w-full h-12 px-4 py-3 pr-12 border rounded-lg focus:ring-2 focus:ring-[#554099] focus:border-transparent transition-colors bg-gray-50 text-gray-900
                ${errors.password 
                  ? 'border-red-300 bg-red-50' 
                  : 'border-gray-200 hover:border-gray-300 focus:border-[#554099] focus:bg-white'
                }
              `}
              placeholder="Password"
              disabled={isLoading}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 transition-colors"
              disabled={isLoading}
            >
              {showPassword ? (
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" />
                </svg>
              ) : (
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              )}
            </button>
          </div>
          {errors.password && (
            <p className="text-sm text-red-600 flex items-center mt-1">
              <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              {errors.password}
            </p>
          )}
        </div>

        {/* Spacing before Login Button */}
        <div style={{ height: '20px' }}></div>

        {/* Login Button */}
        <button
          type="submit"
          disabled={isLoading || !formData.email || !formData.password}
          className="w-full bg-[#554099] hover:bg-[#443077] text-white font-semibold py-3 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? (
            <div className="flex items-center justify-center">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
              Accesso in corso...
            </div>
          ) : (
            'Accedi'
          )}
        </button>
      </form>

      {/* Forgot Password */}
      <div className="text-center pt-4">
        <p className="text-gray-700 text-sm mb-3">Hai dimenticato la password?</p>
        <button
          type="button"
          onClick={handleForgotPassword}
          className="w-full h-12 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium py-3 px-4 rounded-lg flex items-center justify-center transition-colors"
          disabled={isLoading}
        >
          Reimposta password
        </button>
      </div>
    </div>
  );
};

export default VerifiedLoginForm;
