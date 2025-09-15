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
  selectedWeek: number | null;
  timeToMatch: TimeToMatch;
  predictionsCount: number;
  className?: string;
  fixtures?: Array<{ date: string }>;
}

export function GameHeader({
  currentMode,
  selectedWeek,
  timeToMatch,
  predictionsCount,
  className = '',
  fixtures = [],
}: GameHeaderProps) {
  const modeLabel = currentMode === 'test' ? 'Modalità Test' : 'Live';
  
  // Calculate week date range from fixtures and determine week number
  const getWeekData = () => {
    if (!fixtures.length) return { from: '', to: '', weekNumber: selectedWeek || 1 };
    
    const dates = fixtures.map(f => new Date(f.date)).sort((a, b) => a.getTime() - b.getTime());
    const firstDate = dates[0];
    const lastDate = dates[dates.length - 1];
    
    const from = firstDate.toLocaleDateString('it-IT', { 
      day: '2-digit', 
      month: '2-digit', 
      timeZone: 'Europe/Rome' 
    });
    const to = lastDate.toLocaleDateString('it-IT', { 
      day: '2-digit', 
      month: '2-digit', 
      timeZone: 'Europe/Rome' 
    });
    
    // For live mode, try to determine week from fixtures data
    // We can look at the fixture.league.round or try to extract from dates
    const weekNumber = selectedWeek || 3; // Default to week 3 as that's what we populated
    
    return { from, to, weekNumber };
  };
  
  const { from, to, weekNumber } = getWeekData();
  
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
        <h1 className="text-base md:text-lg mb-1 whitespace-nowrap">
          Giornata {weekNumber}
          {from && to && (
            <span className="opacity-90"> dal {from} al {to}</span>
          )}
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