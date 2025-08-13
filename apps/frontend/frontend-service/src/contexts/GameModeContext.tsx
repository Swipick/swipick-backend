'use client';

import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';

export type GameMode = 'live' | 'test';

interface GameModeContextType {
  mode: GameMode;
  setMode: (mode: GameMode) => void;
  isTestMode: boolean;
  isLiveMode: boolean;
  toggleMode: () => void;
}

const GameModeContext = createContext<GameModeContextType | undefined>(undefined);

export const useGameMode = () => {
  const context = useContext(GameModeContext);
  if (context === undefined) {
    throw new Error('useGameMode must be used within a GameModeProvider');
  }
  return context;
};

interface GameModeProviderProps {
  children: ReactNode;
}

export const GameModeProvider: React.FC<GameModeProviderProps> = ({ children }) => {
  const [mode, setModeState] = useState<GameMode>('live');

  // Load mode from localStorage on mount
  useEffect(() => {
    // Only access localStorage on client side
    if (typeof window !== 'undefined') {
      const savedMode = localStorage.getItem('swipick-game-mode') as GameMode;
      if (savedMode && (savedMode === 'live' || savedMode === 'test')) {
        setModeState(savedMode);
      }
    }
  }, []);

  // Save mode to localStorage when it changes
  const setMode = (newMode: GameMode) => {
    setModeState(newMode);
    // Only access localStorage on client side
    if (typeof window !== 'undefined') {
      localStorage.setItem('swipick-game-mode', newMode);
    }
  };

  const toggleMode = () => {
    const newMode = mode === 'live' ? 'test' : 'live';
    setMode(newMode);
  };

  const contextValue: GameModeContextType = {
    mode,
    setMode,
    isTestMode: mode === 'test',
    isLiveMode: mode === 'live',
    toggleMode,
  };

  return (
    <GameModeContext.Provider value={contextValue}>
      {children}
    </GameModeContext.Provider>
  );
};
