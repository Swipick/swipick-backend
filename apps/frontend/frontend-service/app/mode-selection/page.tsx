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
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-600 via-purple-700 to-purple-800">
        <div className="text-white text-xl">Caricamento...</div>
      </div>
    );
  }

  if (!firebaseUser) {
    return null; // Will redirect to login
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-purple-600 via-purple-700 to-purple-800 px-6">
      {/* Welcome Section */}
      <div className="text-center mb-12">
        <h1 className="text-white text-3xl md:text-4xl font-bold mb-4">
          Ciao {userName}!
        </h1>
        <p className="text-white/90 text-lg md:text-xl font-light">
          Cosa vorresti fare oggi?
        </p>
      </div>

      {/* Mode Selection Buttons */}
      <div className="flex flex-col space-y-6 w-full max-w-sm">
        {/* Live Mode Button */}
        <button
          onClick={handleLiveMode}
          className="bg-white text-purple-700 font-semibold py-4 px-8 rounded-xl shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200 text-lg"
        >
          🔴 Modalità Live
        </button>

        {/* Test Mode Button */}
        <button
          onClick={handleTestMode}
          className="bg-white text-purple-700 font-semibold py-4 px-8 rounded-xl shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200 text-lg"
        >
          🧪 Modalità Test
        </button>
      </div>

      {/* Optional Footer Note */}
      <div className="mt-12 text-center">
        <p className="text-white/70 text-sm">
          Seleziona la modalità per iniziare a giocare
        </p>
      </div>
    </div>
  );
}
