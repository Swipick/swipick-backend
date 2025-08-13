'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { LoginProvider } from '../../src/contexts/LoginContext';
import { useAuthContext } from '../../src/contexts/AuthContext';
import LoginForm from '../../src/components/auth/LoginForm';

/**
 * Login Page Component
 * Handles user authentication with email/password
 * Integrates with Firebase AuthContext for authentication state
 */
export default function LoginPage() {
  const router = useRouter();
  const { firebaseUser, loading } = useAuthContext();

  // Don't automatically redirect authenticated users - let them choose
  // They might want to login with a different account
  useEffect(() => {
    // We remove the automatic redirect to allow users to access login page
    // even when already authenticated
  }, [firebaseUser, loading, router]);

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

  // If user is logged in but email not verified, show verification prompt
  if (firebaseUser && !firebaseUser.emailVerified) {
    return (
      <div className="min-h-screen bg-white">
        {/* EmailVerificationPrompt component will be created in Phase 3 */}
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-[#554099] mb-4">Verifica Email Richiesta</h2>
            <p className="text-gray-600">Controlla la tua email per verificare l&apos;account.</p>
          </div>
        </div>
      </div>
    );
  }

  // Show login form even if user is authenticated (they may want to switch accounts)

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

      <div className="flex-1 flex items-center justify-center ">
        <div className='w-full h-full flex flex-col'>
          <div className="text-center">
            <h1 className="text-5xl text-[#554099]">
              swipick
            </h1>
          </div>

          {/* 80px spacing between header and form */}
          <div style={{ height: '90px' }}></div>

        <LoginProvider>
          <div className="w-full h-full max-w-sm space-y-8" >
          {/* Header */}


          {/* Show login form or already logged in message */}
          {firebaseUser && firebaseUser.emailVerified ? (
            <div className="bg-white space-y-6">
              <div className="text-center">
                <h2 className="text-2xl font-bold text-[#554099] mb-6">Già autenticato</h2>
                <p className="text-gray-600 mb-4">Sei già collegato come:</p>
                <p className="text-[#554099] font-medium mb-6">{firebaseUser.email}</p>
                <div className="space-y-4">
                  <button
                    onClick={() => router.push('/mode-selection')}
                    className="w-full bg-[#554099] hover:bg-[#443077] text-white font-semibold py-4 text-lg rounded-lg transition-colors shadow-sm"
                  >
                    Continua al Gioco
                  </button>
                  <button
                    onClick={() => {
                      // Add logout functionality here
                      router.push('/welcome');
                    }}
                    className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold py-4 text-lg rounded-lg transition-colors border border-gray-200"
                  >
                    Torna alla Home
                  </button>
                </div>
              </div>
              
              {/* Registration Link - keeping consistency */}
              <div className="text-center">
                <p className="text-gray-600">
                  Vuoi accedere con un altro account?{' '}
                  <button
                    onClick={() => {
                      // Here we could add logout functionality and show login form
                      // For now, just navigate to registro
                      router.push('/registro');
                    }}
                    className="text-[#554099] hover:text-[#443077] font-medium hover:underline transition-colors"
                  >
                    Cambia account
                  </button>
                </p>
              </div>
            </div>
          ) : (
            <LoginForm />
          )}


        </div>
      </LoginProvider>

        </div>
      </div>
    </div>
  );
}
