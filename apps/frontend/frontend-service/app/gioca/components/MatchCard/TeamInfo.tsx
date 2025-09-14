/**
 * TeamInfo Component  
 * Displays team logo, name, and statistics
 */

import React from 'react';
import Image from 'next/image';
import type { Team } from '../../types';

interface TeamInfoProps {
  team: Team;
  standingsPosition?: number | null;
  winRate?: number | null;
  winRateLabel?: string;
  className?: string;
}

export function TeamInfo({
  team,
  standingsPosition,
  winRate,
  winRateLabel = 'Win Rate',
  className = '',
}: TeamInfoProps) {
  return (
    <div className={`flex-1 text-center ${className}`}>
      {/* Team logo */}
      {team.logo ? (
        <Image
          src={team.logo}
          alt={team.name}
          width={80}
          height={80}
          className="w-20 h-20 mx-auto mb-3 object-contain"
        />
      ) : (
        <div className="w-20 h-20 mx-auto mb-3 bg-gray-200 rounded-full flex items-center justify-center">
          <span className="text-gray-600 font-bold text-2xl">
            {team.name.charAt(0)}
          </span>
        </div>
      )}
      
      {/* Team name */}
      <h3 className="font-bold text-lg mb-1 text-black">
        {team.name}
      </h3>
      
      {/* Statistics */}
      <div className="space-y-1">
        {standingsPosition && (
          <div>
            <p className="text-xs text-gray-600">Posizione in classifica</p>
            <p className="font-bold text-black">{standingsPosition}°</p>
          </div>
        )}
        
        {winRate !== null && winRate !== undefined && (
          <div>
            <p className="text-xs text-gray-600">{winRateLabel}</p>
            <p className="font-bold text-black">{winRate}%</p>
          </div>
        )}
      </div>
    </div>
  );
}