'use client';

import React from 'react';
import Button from '../../components/ui/Button';
import TeamLogo from '../../components/ui/TeamLogo';

export default function LoginPage() {
  const handleLogin = () => {
    // TODO: Implement login functionality
    console.log('Login button clicked');
  };

  const handleRegister = () => {
    // TODO: Implement registration functionality
    console.log('Register button clicked');
  };

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center px-4 py-8">
      <div className="w-full h-full max-w-sm space-y-8 ">
        {/* Header */}
        <div className="text-center ">
          <h1 className="text-5xl font-bold text-[#554099] 900 mb-4">
            swipick
          </h1>
        </div>

        {/* Team Logos Row - Slightly Slanted */}
        <div className="flex flex-col items-center justify-center space-y-4 py-6">




          <p className="text-black text-lg font-medium mt-12 ">
            Ogni giornata fai la tua giocata
          </p>
        <div className="flex items-center justify-center space-x-8 py-6">
          <div className="transform -rotate-12">
            <TeamLogo 
              src="/juventusLogo.png" 
              alt="Juventus" 
              size="lg"
            />
          </div>
          <div className="transform rotate-12">
            <TeamLogo 
              src="/napoliLogo.png" 
              alt="Napoli" 
              size="lg"
            />
          </div>
        </div>
        </div>

        {/* 1-X-2 Buttons in Arched Row */}
        <div className="relative flex justify-center items-end space-x-4 py-6">
          <button className="relative text-white font-bold py-3 px-8 rounded-full shadow-lg transition-all duration-200 hover:scale-105"
                  style={{
                    background: `radial-gradient(circle at center, #554099, #3d2d73)`,
                    boxShadow: '0 8px 16px rgba(85, 64, 153, 0.3), 0 4px 8px rgba(0, 0, 0, 0.2)'
                  }}>
            1
          </button>
          <button className="relative text-white font-bold py-3 px-8 rounded-full transform -translate-y-2 shadow-lg transition-all duration-200 hover:scale-105"
                  style={{
                    background: `radial-gradient(circle at center, #554099, #3d2d73)`,
                    boxShadow: '0 8px 16px rgba(85, 64, 153, 0.3), 0 4px 8px rgba(0, 0, 0, 0.2)'
                  }}>
            X
          </button>
          <button className="relative text-white font-bold py-3 px-8 rounded-full shadow-lg transition-all duration-200 hover:scale-105"
                  style={{
                    background: `radial-gradient(circle at center, #554099, #3d2d73)`,
                    boxShadow: '0 8px 16px rgba(8, 7, 11, 0.63), 0 4px 8px rgba(0, 0, 0, 0.2)'
                  }}>
            2
          </button>
        </div>

        {/* Decorative dots slider */}
        <div className="flex justify-center space-x-2 py-4">
          <div className="w-3 h-3 bg-[#554099] rounded-full"></div>
          <div className="w-3 h-3 bg-gray-300 rounded-full"></div>
          <div className="w-3 h-3 bg-gray-300 rounded-full"></div>
        </div>

        {/* Authentication Buttons */}
        <div className="px-4 py-4 pt-8">
          <Button
            onClick={handleLogin}
            variant="primary"
            fullWidth
            className="text-white font-semibold py-4 text-lg h-10 flex items-center justify-center mb-4"
          >
            Login
          </Button>
          
          <Button
            onClick={handleRegister}
            variant="secondary"
            fullWidth
            className="text-black font-semibold py-4 text-lg h-10 flex items-center justify-center"
          >
            Registrati
          </Button>
        </div>
      </div>
    </div>
  );
}
