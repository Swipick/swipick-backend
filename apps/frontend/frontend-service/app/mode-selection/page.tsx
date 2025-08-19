'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthContext } from '../../src/contexts/AuthContext';
import { useGameMode } from '../../src/contexts/GameModeContext';

export default function ModeSelectionPage() {
  const router = useRouter();
  const { firebaseUser, loading } = useAuthContext();
  const { setMode } = useGameMode();
  const [userName, setUserName] = useState<string>('');

  useEffect(() => {
    if (loading) return;
    
    if (!firebaseUser) {
      router.push('/login');
      return;
    }

    // Get user name from Firebase user or display name
    const name = firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'User';
    setUserName(name);
  }, [firebaseUser, loading, router]);

  const handleLiveMode = () => {
    setMode('live');
    router.push('/gioca?mode=live');
  };

  const handleTestMode = () => {
    setMode('test');
    router.push('/gioca?mode=test');
  };

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

  if (!firebaseUser) {
    return null; // Will redirect to login
  }

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center px-6">
      {/* Welcome Section */}
      <div className="text-center mb-12">
        <h1 className="text-3xl md:text-4xl font-bold mb-4 text-[#554099]">
          Ciao {userName}!
        </h1>
        <p className="text-lg md:text-xl text-[#554099]">
          Cosa vorresti fare oggi?
        </p>
      </div>

      {/* Mode Selection Buttons */}
      <div className="flex flex-col space-y-6 w-full max-w-sm">
        {/* Live Mode Button */}
        <button
          onClick={handleLiveMode}
          className="w-full bg-[#554099] hover:bg-[#443077] text-white font-semibold py-4 text-lg rounded-lg transition-colors shadow-sm"
        >
          Modalità Live
        </button>

        {/* Test Mode Button */}
        <button
          onClick={handleTestMode}
          className="w-full bg-[#554099] hover:bg-[#443077] text-white font-semibold py-4 text-lg rounded-lg transition-colors shadow-sm"
        >
          Modalità Test
        </button>
      </div>

      {/* Footer Note */}
      <div className="mt-12 text-center">
        <p className="text-sm text-[#554099]">
          Seleziona la modalità per iniziare a giocare
        </p>
      </div>
    </div>
  );
}
