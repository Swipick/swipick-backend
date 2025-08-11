'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { LoginProvider } from '../../src/contexts/LoginContext';
import { useAuthContext } from '../../src/contexts/AuthContext';
import VerifiedLoginForm from '../../src/components/auth/VerifiedLoginForm';

/**
 * Login Verified Page Component
 * Special login page for users coming from email verification links
 * Shows a success message and simple login form
 */
export default function LoginVerifiedPage() {
  const router = useRouter();
  const { firebaseUser, loading } = useAuthContext();
  const [emailVerificationProcessed, setEmailVerificationProcessed] = useState(false);

  useEffect(() => {
    // Check if this is an email verification link and handle it
    const processEmailVerification = async () => {
      if (typeof window !== 'undefined' && !emailVerificationProcessed) {
        const currentUrl = window.location.href;
        
        // Check if this is a Firebase email action link
        const url = new URL(currentUrl);
        const mode = url.searchParams.get('mode');
        const oobCode = url.searchParams.get('oobCode');
        
        if (mode === 'verifyEmail' && oobCode) {
          // The email verification will be handled by Firebase automatically
          // We just mark it as processed to show the success message
          setEmailVerificationProcessed(true);
        }
      }
    };

    processEmailVerification();
  }, [emailVerificationProcessed]);

  // Show loading state while checking authentication
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#554099] mx-auto mb-4"></div>
          <p className="text-gray-600">Caricamento...</p>
        </div>
      </div>
    );
  }

  // If user is already logged in and verified, redirect to game
  if (firebaseUser && firebaseUser.emailVerified) {
    router.push('/gioca');
    return null;
  }

  return (
    <div className="min-h-screen bg-white flex flex-col px-4 py-8 relative">
      {/* Back Button */}
      <div className="absolute top-8 left-4">
        <button
          onClick={() => router.push('/welcome')}
          className="flex items-center justify-center w-10 h-10 text-gray-600 hover:text-gray-800 transition-colors"
        >
          <svg 
            className="w-6 h-6" 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={2} 
              d="M15 19l-7-7 7-7" 
            />
          </svg>
        </button>
      </div>

      <div className="flex-1 flex items-center justify-center">
        <div className="w-full h-full flex flex-col">
          {/* Header */}
          <div className="text-center">
            <h1 className="text-5xl text-[#554099] mb-8">
              swipick
            </h1>
          </div>

          {/* Success Message */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4">
              <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-[#554099] mb-2">Account Verificato!</h2>
            <p className="text-gray-600">Il tuo account è stato verificato con successo. Ora puoi accedere.</p>
          </div>

          {/* 40px spacing */}
          <div style={{ height: '40px' }}></div>

          <LoginProvider>
            <div className="w-full h-full max-w-sm mx-auto">
              <VerifiedLoginForm />
            </div>
          </LoginProvider>
        </div>
      </div>
    </div>
  );
}
