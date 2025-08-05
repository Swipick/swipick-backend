'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { confirmPasswordReset, verifyPasswordResetCode } from 'firebase/auth';
import { auth } from '../../src/services/firebase';
import Button from '../../components/ui/Button';
import PasswordInput from '../../components/ui/PasswordInput';
import GradientBackground from '../../components/ui/GradientBackground';
import { getFirebaseErrorMessage } from '../../src/utils/firebase-errors';

/**
 * Loading component for Suspense fallback
 */
function ResetPasswordLoading() {
  return (
    <GradientBackground>
      <div className="min-h-screen flex items-center justify-center">
        <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-2xl p-8 w-full max-w-md">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Caricamento...</p>
          </div>
        </div>
      </div>
    </GradientBackground>
  );
}

/**
 * Password Reset Page Component
 * Handles the password reset flow when user clicks Firebase reset email link
 */
function ResetPasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(true);
  const [isValidCode, setIsValidCode] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  const oobCode = searchParams?.get('oobCode');
  const mode = searchParams?.get('mode');
  const step = searchParams?.get('step');
  const emailParam = searchParams?.get('email');

  useEffect(() => {
    // If this is just the "email sent" confirmation step
    if (step === 'sent' && emailParam) {
      setUserEmail(emailParam);
      setIsVerifying(false);
      return;
    }

    // Otherwise, verify the Firebase reset code
    const verifyResetCode = async () => {
      if (!oobCode || mode !== 'resetPassword') {
        setError('Link di reset password non valido o scaduto');
        setIsVerifying(false);
        return;
      }

      try {
        // Verify the password reset code and get user email
        const email = await verifyPasswordResetCode(auth, oobCode);
        setUserEmail(email);
        setIsValidCode(true);
      } catch (error) {
        console.error('Error verifying reset code:', error);
        setError('Link di reset password non valido o scaduto');
      }
      setIsVerifying(false);
    };

    verifyResetCode();
  }, [oobCode, mode, step, emailParam]);

  const validateForm = (): boolean => {
    setError(null);

    if (!password) {
      setError('La password è richiesta');
      return false;
    }

    if (password.length < 6) {
      setError('La password deve essere di almeno 6 caratteri');
      return false;
    }

    if (password !== confirmPassword) {
      setError('Le password non corrispondono');
      return false;
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm() || !oobCode) return;

    try {
      setIsLoading(true);
      setError(null);

      // Confirm the password reset with Firebase
      await confirmPasswordReset(auth, oobCode, password);
      
      setIsSuccess(true);
    } catch (error) {
      console.error('Error resetting password:', error);
      setError(getFirebaseErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoToLogin = () => {
    router.push('/login');
  };

  // Loading state while verifying the reset code
  if (isVerifying) {
    return (
      <GradientBackground>
        <div className="min-h-screen flex items-center justify-center p-4">
          <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl p-6 w-full max-w-md relative z-10">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#554099] mx-auto mb-4"></div>
              <p className="text-gray-600">Verifica del link in corso...</p>
            </div>
          </div>
        </div>
      </GradientBackground>
    );
  }

  // Invalid code or error state
  if (!isValidCode && step !== 'sent') {
    return (
      <GradientBackground>
        <div className="min-h-screen flex items-center justify-center p-4">
          <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl p-6 w-full max-w-md relative z-10">
            <div className="text-center">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Link Non Valido</h2>
              <p className="text-gray-600 mb-6">
                {error || 'Il link per il reset della password non è valido o è scaduto.'}
              </p>
              <Button onClick={handleGoToLogin} fullWidth>
                Torna al Login
              </Button>
            </div>
          </div>
        </div>
      </GradientBackground>
    );
  }

  // Email sent confirmation state
  if (step === 'sent' && userEmail) {
    return (
      <GradientBackground>
        <div className="min-h-screen flex items-center justify-center p-4">
          <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl p-6 w-full max-w-md relative z-10">
            <div className="text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 7.89a2 2 0 002.83 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-[#554099] mb-4">Email Inviata</h2>
              <p className="text-gray-600 mb-6">
                Abbiamo inviato le istruzioni per reimpostare la password a{' '}
                <span className="font-medium text-gray-900">{userEmail}</span>
              </p>
              <p className="text-sm text-gray-500 mb-8">
                Controlla anche la cartella spam se non vedi l&apos;email.
              </p>
              <div className="space-y-4">
                <Button onClick={handleGoToLogin} variant="secondary" fullWidth>
                  Torna al Login
                </Button>
              </div>
            </div>
          </div>
        </div>
      </GradientBackground>
    );
  }

  // Success state
  if (isSuccess) {
    return (
      <GradientBackground>
        <div className="min-h-screen flex items-center justify-center p-4">
          <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl p-6 w-full max-w-md relative z-10">
            <div className="text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Password Aggiornata!</h2>
              <p className="text-gray-600 mb-6">
                La tua password è stata aggiornata con successo. Ora puoi accedere con la nuova password.
              </p>
              <Button onClick={handleGoToLogin} fullWidth>
                Accedi Ora
              </Button>
            </div>
          </div>
        </div>
      </GradientBackground>
    );
  }

  // Password reset form
  return (
    <GradientBackground>
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl p-6 w-full max-w-md relative z-10">
          {/* Header */}
          <div className="text-center mb-6">
            <h1 className="text-2xl font-bold text-gray-900 mb-1">
              Reimposta Password
            </h1>
            <p className="text-gray-600">
              Crea una nuova password per {userEmail}
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <p className="text-sm text-red-800">{error}</p>
                </div>
              </div>
            </div>
          )}

          {/* Reset Password Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* New Password */}
            <PasswordInput
              id="newPassword"
              name="newPassword"
              placeholder="Nuova Password"
              value={password}
              onChange={setPassword}
              showStrengthIndicator={true}
              disabled={isLoading}
            />

            {/* Confirm Password */}
            <PasswordInput
              id="confirmPassword"
              name="confirmPassword"
              placeholder="Conferma Nuova Password"
              value={confirmPassword}
              onChange={setConfirmPassword}
              showConfirmationIcon={true}
              isValid={!!(confirmPassword && password === confirmPassword)}
              disabled={isLoading}
            />

            {/* Submit Button */}
            <Button
              type="submit"
              fullWidth
              disabled={isLoading || !password || !confirmPassword}
            >
              {isLoading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Aggiornamento...
                </>
              ) : (
                'Aggiorna Password'
              )}
            </Button>
          </form>

          {/* Back to Login */}
          <div className="mt-6 text-center">
            <button
              type="button"
              onClick={handleGoToLogin}
              className="text-[#554099] hover:text-[#443077] text-sm font-medium transition-colors"
            >
              ← Torna al Login
            </button>
          </div>
        </div>
      </div>
    </GradientBackground>
  );
}

/**
 * Main export component wrapped with Suspense
 */
export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<ResetPasswordLoading />}>
      <ResetPasswordContent />
    </Suspense>
  );
}
