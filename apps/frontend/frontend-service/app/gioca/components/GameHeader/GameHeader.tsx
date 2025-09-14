/**
 * GameHeader Component
 * Complete header with week info, countdown, and progress
 */

import React from 'react';
import { CountdownTimer } from './CountdownTimer';
import { ProgressBar } from './ProgressBar';
import type { TimeToMatch, GameMode } from '../../types';
import { GAME_CONFIG } from '../../utils/constants';

interface GameHeaderProps {
  currentMode: GameMode;
  selectedWeek: number;
  timeToMatch: TimeToMatch;
  predictionsCount: number;
  className?: string;
}

export function GameHeader({
  currentMode,
  selectedWeek,
  timeToMatch,
  predictionsCount,
  className = '',
}: GameHeaderProps) {
  const modeLabel = currentMode === 'test' ? 'Modalità Test' : 'Live';
  
  return (
    <div className={`
      w-full mx-0 mt-0 mb-6 rounded-b-2xl rounded-t-none text-white p-6
      ${className}
    `}
    style={{
      background: 'radial-gradient(circle at center, #554099, #3d2d73)',
      boxShadow: '0 8px 16px rgba(85, 64, 153, 0.3), 0 4px 8px rgba(0, 0, 0, 0.2)',
    }}>
      <div className="text-center">
        {/* Mode indicator */}
        {currentMode === 'test' && (
          <div className="inline-block px-2 py-1 mb-2 text-xs bg-white/20 rounded-full">
            {modeLabel}
          </div>
        )}
        
        {/* Week title */}
        <h1 className="text-2xl font-bold mb-2">
          {currentMode === 'test' ? `Settimana ${selectedWeek}` : 'Live Mode'}
        </h1>
        
        {/* Countdown timer */}
        <CountdownTimer timeToMatch={timeToMatch} className="mb-4" />
        
        {/* Progress bar */}
        <ProgressBar 
          current={predictionsCount} 
          total={GAME_CONFIG.TOTAL_PREDICTIONS} 
        />
      </div>
    </div>
  );
}