/**
 * CountdownTimer Component
 * Displays countdown to next match with days, hours, minutes, seconds
 */

import React from 'react';
import type { TimeToMatch } from '../../types';

interface CountdownTimerProps {
  timeToMatch: TimeToMatch;
  className?: string;
}

export function CountdownTimer({ timeToMatch, className = '' }: CountdownTimerProps) {
  const { days, hours, minutes, seconds } = timeToMatch;
  
  // Don't show anything if no time remaining
  if (days === 0 && hours === 0 && minutes === 0 && seconds === 0) {
    return (
      <div className={`text-sm opacity-90 ${className}`}>
        Partite in corso
      </div>
    );
  }

  return (
    <div className={`text-sm opacity-90 ${className}`}>
      <div className="flex justify-center items-center space-x-1">
        {days > 0 && (
          <>
            <span className="font-mono font-semibold">{days}</span>
            <span className="text-xs">g</span>
          </>
        )}
        
        <span className="font-mono font-semibold">{hours.toString().padStart(2, '0')}</span>
        <span className="text-xs">h</span>
        
        <span className="font-mono font-semibold">{minutes.toString().padStart(2, '0')}</span>
        <span className="text-xs">m</span>
        
        <span className="font-mono font-semibold">{seconds.toString().padStart(2, '0')}</span>
        <span className="text-xs">s</span>
      </div>
    </div>
  );
}