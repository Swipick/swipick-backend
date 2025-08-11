'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthContext } from '../../contexts/AuthContext';
import Button from '../../../components/ui/Button';

/**
 * EmailVerificationPrompt Component
 * Shows when user is logged in but email is not verified
 * Provides options to resend verification email and logout
 */
const EmailVerificationPrompt: React.FC = () => {
  const router = useRouter();
  const [isResending, setIsResending] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);
  const [resendError, setResendError] = useState<string | null>(null);
  
  const { firebaseUser, sendEmailVerification, logout } = useAuthContext();

  const handleResendVerification = async () => {
    if (!firebaseUser) return;
    
    setIsResending(true);
    setResendError(null);
    setResendSuccess(false);
    
    try {
      await sendEmailVerification();
      setResendSuccess(true);
      console.log('Verification email resent successfully');
    } catch (error) {
      console.error('Error resending verification email:', error);
      setResendError('Errore durante l\'invio dell\'email. Riprova più tardi.');
    } finally {
      setIsResending(false);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      router.push('/login');
    } catch (error) {
      console.error('Error logging out:', error);
    }
  };

  const handleCheckEmailVerification = () => {
    // Refresh the page to check if email has been verified
    window.location.reload();
  };

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center px-4 py-8">
      <div className="w-full max-w-md space-y-8">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-5xl font-bold text-[#554099] mb-4">
            swipick
          </h1>
        </div>

        {/* Verification Content */}
        <div className="bg-white rounded-2xl shadow-xl p-8 space-y-6">
          {/* Icon */}
          <div className="text-center">
            <div className="w-20 h-20 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-10 h-10 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 7.89a2 2 0 002.83 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-[#554099] mb-4">
              Verifica la tua Email
            </h2>
            <p className="text-gray-600 mb-2">
              Abbiamo inviato un link di verifica a:
            </p>
            <p className="font-medium text-gray-900 mb-6">
              {firebaseUser?.email}
            </p>
            <p className="text-sm text-gray-500 mb-8">
              Clicca sul link nell&apos;email per verificare il tuo account e accedere a tutte le funzionalità di Swipick.
            </p>
          </div>

          {/* Success Message */}
          {resendSuccess && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <p className="text-sm text-green-800">
                    Email di verifica inviata con successo! Controlla la tua casella di posta.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Error Message */}
          {resendError && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <p className="text-sm text-red-800">{resendError}</p>
                </div>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="space-y-4">
            <Button
              onClick={handleCheckEmailVerification}
              variant="primary"
              fullWidth
            >
              Ho Verificato l&apos;Email
            </Button>
            
            <Button
              onClick={handleResendVerification}
              variant="secondary"
              fullWidth
              disabled={isResending}
            >
              {isResending ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-[#554099] mr-2"></div>
                  Invio in corso...
                </>
              ) : (
                'Invia Nuovamente'
              )}
            </Button>
          </div>

          {/* Logout Option */}
          <div className="text-center pt-4 border-t border-gray-200">
            <p className="text-sm text-gray-600 mb-4">
              Email sbagliata o vuoi utilizzare un altro account?
            </p>
            <button
              onClick={handleLogout}
              className="text-sm text-[#554099] hover:text-[#443077] font-medium hover:underline transition-colors"
            >
              Disconnetti e Torna al Login
            </button>
          </div>
        </div>

        {/* Help Text */}
        <div className="text-center">
          <p className="text-sm text-gray-500">
            Non hai ricevuto l&apos;email?{' '}
            <br />
            Controlla la cartella spam o prova a inviare nuovamente.
          </p>
        </div>
      </div>
    </div>
  );
};

export default EmailVerificationPrompt;
