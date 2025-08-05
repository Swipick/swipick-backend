'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLoginContext } from '../../contexts/LoginContext';
import { useAuthContext } from '../../contexts/AuthContext';
import Button from '../../../components/ui/Button';

/**
 * LoginForm Component
 * Handles email/password login with real-time validation
 * Integrates with LoginContext for state management
 */
const LoginForm: React.FC = () => {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  
  const {
    formData,
    errors,
    isLoading,
    updateField,
    submitLogin,
    clearError,
    sendPasswordReset,
    isPasswordResetSent
  } = useLoginContext();

  const { signInWithGoogle } = useAuthContext();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await submitLogin();
  };

  const handleGoogleSignIn = async () => {
    try {
      setGoogleLoading(true);
      await signInWithGoogle();
      // On success, user will be redirected by AuthContext or parent component
      router.push('/gioca');
    } catch (error) {
      console.error('Google sign-in failed:', error);
      // Error is handled by AuthContext
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!formData.email) {
      clearError();
      // Focus on email field if empty
      const emailInput = document.getElementById('email') as HTMLInputElement;
      if (emailInput) {
        emailInput.focus();
      }
      return;
    }
    
    try {
      await sendPasswordReset(formData.email);
      setShowForgotPassword(true);
    } catch (error) {
      // Error is handled by the context
    }
  };

  if (showForgotPassword || isPasswordResetSent) {
    return (
      <div className="space-y-6">
        <div className="text-center">
          <div className="mb-4">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 7.89a2 2 0 002.83 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
          </div>
          <h2 className="text-2xl font-bold text-[#554099] mb-4">Email Inviata</h2>
          <p className="text-gray-600 mb-6">
            Abbiamo inviato le istruzioni per reimpostare la password a{' '}
            <span className="font-medium text-gray-900">{formData.email}</span>
          </p>
          <p className="text-sm text-gray-500 mb-8">
            Controlla anche la cartella spam se non vedi l&apos;email.
          </p>
        </div>

        <div className="space-y-4">
          <Button
            onClick={() => setShowForgotPassword(false)}
            variant="secondary"
            fullWidth
          >
            Torna al Login
          </Button>
          
          <Button
            onClick={() => handleForgotPassword()}
            variant="secondary"
            fullWidth
            disabled={isLoading}
          >
            Invia Nuovamente
          </Button>
        </div>
      </div>
    );
  }

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
              w-full h-10 px-4 py-3 border rounded-lg focus:ring-2 focus:ring-[#554099] focus:border-transparent transition-colors bg-gray-50 text-gray-900
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
                w-full h-10 px-4 py-3 pr-12 border rounded-lg focus:ring-2 focus:ring-[#554099] focus:border-transparent transition-colors bg-gray-50 text-gray-900
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

        {/* 50px spacing before Login Button */}
        <div style={{ height: '30px' }}></div>

        {/* Login Button */}
        <button
          type="submit"
          disabled={isLoading}
          className="w-full bg-[#554099] hover:bg-[#443077] text-white font-medium py-3 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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

      {/* Divider */}
      <div className="flex items-center justify-center">
        <span className="text-gray-500 text-sm">oppure</span>
      </div>

      {/* Google Sign In Button */}
      <button
        type="button"
        onClick={handleGoogleSignIn}
        className="w-full bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 font-medium py-3 px-4 rounded-lg transition-colors flex items-center justify-center"
        disabled={isLoading || googleLoading}
      >
        {googleLoading ? (
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-gray-600 mr-2"></div>
            Accesso con Google...
          </div>
        ) : (
          <>
            <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Accedi con Google
          </>
        )}
      </button>

      {/* 117px spacing before Forgot Password */}
      <div style={{ height: '40px' }}></div>

      {/* Forgot Password */}
      <div className="text-center">
        <p className="text-gray-700 text-sm mb-3">Hai dimenticato la password?</p>
        <button
          type="button"
          onClick={handleForgotPassword}
          className="w-full h-10 bg-gray-100 hover:bg-gray-200 text-black text-sm py-3 px-4 rounded-lg flex items-center justify-center transition-colors"
          disabled={isLoading}
        >
          Recupera password
        </button>
      </div>
    </div>
  );
};

export default LoginForm;
