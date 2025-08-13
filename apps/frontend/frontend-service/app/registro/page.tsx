'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { RegistrationProvider, useRegistration } from '@/contexts/RegistrationContext';
import { useAuthContext } from '@/src/contexts/AuthContext';
import { apiClient } from '@/lib/api-client';
import FormInput from '@/components/ui/FormInput';
import PasswordInput from '@/components/ui/PasswordInput';
import Button from '@/components/ui/Button';
import GradientBackground from '@/components/ui/GradientBackground';
import EmailVerification from '@/src/components/auth/EmailVerification';

interface BackendUserResponse {
  id: string;
  needsProfileCompletion: boolean;
}

const RegistrationForm: React.FC = () => {
  const router = useRouter();
  const [googleLoading, setGoogleLoading] = useState(false);
  
  const {
    registrationData,
    updateField,
    submitRegistration,
    errors,
    isLoading,
    validateForm,
    isEmailLinkSent,
    resetForm,
  } = useRegistration();

  const { signInWithGoogle } = useAuthContext();

  const handleGoogleSignIn = async () => {
    try {
      setGoogleLoading(true);
      
      // Sign in with Google and get Firebase user
      const firebaseUser = await signInWithGoogle();
      
      // NEW: Sync with backend database
      try {
        const idToken = firebaseUser.accessToken;
        const result = await apiClient.syncGoogleUser(idToken);
        
        console.log('✅ Google user synced to database:', result);
        
        // Check if user needs to complete profile
        if (result.data && (result.data as BackendUserResponse).needsProfileCompletion) {
          router.push(`/complete-profile/${(result.data as BackendUserResponse).id}`);
        } else {
          router.push('/mode-selection');
        }
      } catch (backendError) {
        console.error('❌ Backend sync failed, proceeding anyway:', backendError);
        // Still redirect to game even if backend sync fails
        router.push('/mode-selection');
      }
    } catch (error) {
      console.error('Google sign-in failed:', error);
      // Error is handled by AuthContext
    } finally {
      setGoogleLoading(false);
    }
  };

  // Show email verification component if email link was sent
  if (isEmailLinkSent) {
    return (
      <EmailVerification
        email={registrationData.email}
        onBackToRegistration={() => {
          resetForm();
        }}
      />
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (validateForm()) {
      await submitRegistration();
    }
  };

  const isFormValid = () => {
    const { nome, sopranome, email, password, confirmPassword, agreeToTerms } = registrationData;
    // All fields are required including password for account creation
    const hasAllFields = nome && sopranome && email && password && confirmPassword && agreeToTerms;
    const hasNoErrors = Object.values(errors).every(error => !error);
    return hasAllFields && hasNoErrors;
  };

  return (
    <GradientBackground>
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl p-6 w-full max-w-md relative z-10">
          {/* Header */}
          <div className="text-center mb-6">
            <h1 className="text-2xl font-bold text-gray-900 mb-1">
              Crea Account
            </h1>
            <p className="text-gray-600">
              Unisciti a Swipick e inizia a giocare
            </p>
          </div>

          {/* Registration Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Nome */}
            <FormInput
              id="nome"
              name="nome"
              type="text"
              placeholder="Nome"
              value={registrationData.nome}
              onChange={(value) => updateField('nome', value)}
              error={errors.nome}
              required
              autoComplete="given-name"
            />

            {/* Sopranome */}
            <FormInput
              id="sopranome"
              name="sopranome"
              type="text"
              placeholder="Sopranome"
              value={registrationData.sopranome}
              onChange={(value) => updateField('sopranome', value)}
              error={errors.sopranome}
              required
              autoComplete="family-name"
            />

            {/* Email */}
            <FormInput
              id="email"
              name="email"
              type="email"
              placeholder="email@example.com"
              value={registrationData.email}
              onChange={(value) => updateField('email', value.toLowerCase())}
              error={errors.email}
              required
              autoComplete="email"
            />

            {/* Password */}
            <PasswordInput
              id="password"
              name="password"
              placeholder="Password"
              value={registrationData.password}
              onChange={(value) => updateField('password', value)}
              error={errors.password}
              showStrengthIndicator={false}
              disabled={isLoading}
            />

            {/* Confirm Password */}
            <PasswordInput
              id="confirmPassword"
              name="confirmPassword"
              placeholder="Conferma Password"
              value={registrationData.confirmPassword}
              onChange={(value) => updateField('confirmPassword', value)}
              error={errors.confirmPassword}
              showConfirmationIcon={true}
              isValid={!!(registrationData.confirmPassword && registrationData.password === registrationData.confirmPassword)}
              disabled={isLoading}
            />

            {/* Terms Agreement Checkbox */}
            <div className="flex items-start space-x-3 py-2">
              <div className="flex items-center h-5">
                <input
                  id="agreeToTerms"
                  name="agreeToTerms"
                  type="checkbox"
                  checked={registrationData.agreeToTerms}
                  onChange={(e) => updateField('agreeToTerms', e.target.checked)}
                  disabled={isLoading}
                  className="w-4 h-4 text-purple-600 bg-gray-100 border-gray-300 rounded focus:ring-purple-500 focus:ring-2"
                />
              </div>
              <div className="text-sm">
                <label htmlFor="agreeToTerms" className="text-gray-700">
                  Accetto i{' '}
                  <Link 
                    href="/terms" 
                    className="text-purple-600 hover:text-purple-700 underline"
                    target="_blank"
                  >
                    termini di servizio
                  </Link>
                  {' '}di Swipick
                </label>
                {errors.agreeToTerms && (
                  <p className="mt-1 text-sm text-red-600" role="alert">
                    {errors.agreeToTerms}
                  </p>
                )}
              </div>
            </div>

            {/* Submit Button */}
            <Button
              type="submit"
              disabled={!isFormValid() || isLoading}
              className="w-full h-10 text-base font-semibold"
            >
              {isLoading ? (
                <div className="flex items-center justify-center space-x-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Creazione account...</span>
                </div>
              ) : (
                'Crea Account'
              )}
            </Button>
          </form>

          {/* Divider */}
          <div className="flex items-center justify-center mt-4 mb-4">
            <span className="text-gray-500 text-sm">oppure</span>
          </div>

          {/* Google Sign In Button */}
          <button
            type="button"
            onClick={handleGoogleSignIn}
            className="w-full h-10 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 font-medium px-4 rounded-lg transition-colors flex items-center justify-center mb-4"
            disabled={isLoading || googleLoading}
          >
            {googleLoading ? (
              <div className="flex items-center justify-center">
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-gray-600 border-t-transparent mr-2"></div>
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

          {/* Login Link */}
          <div className="mt-4 text-center">
            <p className="text-gray-600 text-sm">
              Hai già un account?{' '}
              <Link 
                href="/login" 
                className="text-purple-600 hover:text-purple-700 font-semibold transition-colors duration-200"
              >
                Accedi
              </Link>
            </p>
          </div>

          {/* Terms and Privacy */}
          <div className="mt-3 text-center">
            <p className="text-xs text-gray-500">
              Creando un account accetti i nostri{' '}
              <Link href="/terms" className="text-purple-600 hover:text-purple-700">
                Termini di Servizio
              </Link>
              {' '}e la{' '}
              <Link href="/privacy" className="text-purple-600 hover:text-purple-700">
                Privacy Policy
              </Link>
            </p>
          </div>
        </div>
      </div>
    </GradientBackground>
  );
};

const RegistrationPage: React.FC = () => {
  return (
    <RegistrationProvider>
      <RegistrationForm />
    </RegistrationProvider>
  );
};

export default RegistrationPage;
