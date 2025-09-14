/**
 * MatchDetails Component
 * Displays match date, time, and stadium information
 */

import React from 'react';
import type { MatchCardKickoff } from '../../types';

interface MatchDetailsProps {
  kickoff?: MatchCardKickoff;
  stadium?: string | null;
  date?: string; // fallback if no kickoff
  venue?: { name: string }; // fallback if no stadium
  className?: string;
}

export function MatchDetails({
  kickoff,
  stadium,
  date,
  venue,
  className = '',
}: MatchDetailsProps) {
  const displayDate = kickoff?.display || (date ? new Date(date).toLocaleString('it-IT') : '');
  const displayStadium = stadium || venue?.name || '';

  return (
    <div className={`text-center mb-4 ${className}`}>
      <p className="text-black text-sm mb-1">
        {displayDate}
      </p>
      {displayStadium && (
        <p className="text-black text-xs opacity-75">
          {displayStadium}
        </p>
      )}
    </div>
  );
}