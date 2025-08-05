/**
 * Email Verification Component
 * Shows confirmation message after sending email link
 */

'use client';

import React from 'react';
import { useAuthContext } from '../../contexts/AuthContext';

interface EmailVerificationProps {
  email?: string;
  onResendEmail?: () => void;
  onBackToRegistration?: () => void;
}

const EmailVerification: React.FC<EmailVerificationProps> = ({
  email,
  onResendEmail,
  onBackToRegistration
}) => {
  const { emailForSignIn, sendEmailVerification, loading, error } = useAuthContext();

  const handleResendEmail = async () => {
    try {
      await sendEmailVerification();
    } catch (error) {
      console.error('Error resending verification email:', error);
    }
    if (onResendEmail) {
      onResendEmail();
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-green-50 px-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center">
        {/* Success Icon */}
        <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-green-100 mb-6">
          <svg
            className="h-8 w-8 text-green-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
            />
          </svg>
        </div>

        {/* Title */}
        <h1 className="text-2xl font-bold text-gray-900 mb-4">
          Grazie!
        </h1>

        {/* Message */}
        <p className="text-gray-600 mb-6 leading-relaxed">
          Ti abbiamo inviato un&apos;email di verifica all&apos;indirizzo{' '}
          <span className="font-semibold text-gray-900">
            {emailForSignIn || email}
          </span>
        </p>

        <p className="text-gray-600 mb-8 leading-relaxed">
          Controlla la tua casella di posta e clicca sul link per verificare il tuo account. Dopo la verifica potrai accedere con email e password.
        </p>

        {/* Instructions */}
        <div className="bg-blue-50 rounded-lg p-4 mb-6">
          <div className="flex items-start">
            <svg
              className="h-5 w-5 text-blue-600 mt-0.5 mr-3 flex-shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <div className="text-left">
              <h3 className="text-sm font-semibold text-blue-900 mb-1">
                Non vedi l&apos;email?
              </h3>
              <p className="text-sm text-blue-700">
                Controlla la cartella spam o posta indesiderata. L&apos;email potrebbe richiedere alcuni minuti per arrivare.
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="space-y-3">
          {/* Resend Email Button */}
          <button
            onClick={handleResendEmail}
            disabled={loading}
            className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg font-semibold hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Invio in corso...' : 'Invia di nuovo l&apos;email di verifica'}
          </button>

          {/* Back to Registration Button */}
          {onBackToRegistration && (
            <button
              onClick={onBackToRegistration}
              className="w-full bg-gray-100 text-gray-700 py-3 px-4 rounded-lg font-semibold hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors"
            >
              Torna alla registrazione
            </button>
          )}
        </div>

        {/* Error Message */}
        {error && (
          <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-3">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        {/* Footer Note */}
        <p className="mt-6 text-xs text-gray-500">
          Il link di verifica è valido per 24 ore. Dopo la verifica potrai accedere con la tua email e password.
        </p>
      </div>
    </div>
  );
};

export default EmailVerification;
