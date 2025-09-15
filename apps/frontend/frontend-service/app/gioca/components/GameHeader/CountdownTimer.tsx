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
    <div className={`${className}`}>
      <div className="flex gap-6 justify-center text-center">
        <div>
          <div className="text-2xl font-bold">{days}</div>
          <div className="text-xs opacity-80">giorni</div>
        </div>
        <div>
          <div className="text-2xl font-bold">{hours}</div>
          <div className="text-xs opacity-80">ore</div>
        </div>
        <div>
          <div className="text-2xl font-bold">{minutes}</div>
          <div className="text-xs opacity-80">minuti</div>
        </div>
        <div>
          <div className="text-2xl font-bold">{seconds}</div>
          <div className="text-xs opacity-80">secondi</div>
        </div>
      </div>
    </div>
  );
}