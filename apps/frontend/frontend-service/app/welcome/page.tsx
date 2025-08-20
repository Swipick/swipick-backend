'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import Button from '../../components/ui/Button';
import TeamLogo from '../../components/ui/TeamLogo';

export default function WelcomePage() {
  const router = useRouter();

  const handleLogin = () => {
    router.push('/login');
  };

  const handleRegister = () => {
    router.push('/registro');
  };

  return (
    <div className="min-h-[100dvh] bg-white flex flex-col px-4 pb-[max(env(safe-area-inset-bottom),16px)] pt-4">
      <div className="w-full max-w-sm mx-auto flex-1 flex flex-col justify-between">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-4xl md:text-5xl font-bold text-[#554099] mb-1">swipick</h1>
        </div>

        {/* Middle: tagline, logos, 1-X-2, dots */}
        <div className="flex flex-col items-center justify-center">
          <p className="text-black text-base md:text-lg font-medium mt-1 mb-2 text-center">
            Ogni giornata fai la tua giocata
          </p>
          <div className="flex items-center justify-center space-x-6 py-3">
            <div className="-rotate-12">
              <TeamLogo src="/juventusLogo.png" alt="Juventus" size="lg" />
            </div>
            <div className="rotate-12">
              <TeamLogo src="/napoliLogo.png" alt="Napoli" size="lg" />
            </div>
          </div>

          {/* 1-X-2 Buttons in Arched Row */}
          <div className="relative flex justify-center items-end space-x-3 py-3">
            <button
              className="relative text-white font-bold py-2.5 px-6 rounded-full shadow-lg transition-all duration-200 hover:scale-105 text-sm"
              style={{
                background: `radial-gradient(circle at center, #554099, #3d2d73)`,
                boxShadow: '0 8px 16px rgba(85, 64, 153, 0.3), 0 4px 8px rgba(0, 0, 0, 0.2)'
              }}
            >
              1
            </button>
            <button
              className="relative text-white font-bold py-2.5 px-6 rounded-full -translate-y-1 shadow-lg transition-all duration-200 hover:scale-105 text-sm"
              style={{
                background: `radial-gradient(circle at center, #554099, #3d2d73)`,
                boxShadow: '0 8px 16px rgba(85, 64, 153, 0.3), 0 4px 8px rgba(0, 0, 0, 0.2)'
              }}
            >
              X
            </button>
            <button
              className="relative text-white font-bold py-2.5 px-6 rounded-full shadow-lg transition-all duration-200 hover:scale-105 text-sm"
              style={{
                background: `radial-gradient(circle at center, #554099, #3d2d73)`,
                boxShadow: '0 8px 16px rgba(8, 7, 11, 0.63), 0 4px 8px rgba(0, 0, 0, 0.2)'
              }}
            >
              2
            </button>
          </div>

          {/* Decorative dots slider */}
          <div className="flex justify-center space-x-2 py-2">
            <div className="w-2.5 h-2.5 bg-[#554099] rounded-full" />
            <div className="w-2.5 h-2.5 bg-gray-300 rounded-full" />
            <div className="w-2.5 h-2.5 bg-gray-300 rounded-full" />
          </div>
        </div>

        {/* Bottom: Authentication Buttons */}
        <div className="pt-2">
          <Button
            onClick={handleLogin}
            variant="primary"
            fullWidth
            className="text-white font-semibold py-3 text-base flex items-center justify-center mb-3"
          >
            Login
          </Button>

          <Button
            onClick={handleRegister}
            variant="secondary"
            fullWidth
            className="text-black font-semibold py-3 text-base flex items-center justify-center"
          >
            Registrati
          </Button>
        </div>
      </div>
    </div>
  );
}
