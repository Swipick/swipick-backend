/**
 * TeamInfo Component  
 * Displays team logo, name, and statistics
 */

import React from 'react';
import Image from 'next/image';
import { LastFiveResults } from './LastFiveResults';
import type { Team } from '../../types';

interface Last5Item {
  fixtureId: number;
  code: '1' | 'X' | '2';
  predicted: '1' | 'X' | '2' | null;
  correct: boolean | null;
  wasHome: boolean;
}

interface TeamInfoProps {
  team: Team;
  standingsPosition?: number | null;
  winRate?: number | null;
  winRateLabel?: string;
  last5?: Array<'1' | 'X' | '2'>;
  form?: Last5Item[];
  className?: string;
}

export function TeamInfo({
  team,
  standingsPosition,
  winRate,
  winRateLabel = 'Win Rate',
  last5 = [],
  form,
  className = '',
}: TeamInfoProps) {
  return (
    <div className={`flex-1 text-center ${className}`}>
      {/* Team logo */}
      {team.logo ? (
        <Image
          src={team.logo}
          alt={team.name}
          width={96}
          height={96}
          className="team-logo mx-auto mb-3 w-24 h-24 object-contain"
        />
      ) : (
        <div className="w-12 h-12 mx-auto mb-3 bg-purple-200 rounded-full flex items-center justify-center">
          <span className="text-purple-600 font-bold text-lg">
            {team.name.charAt(0)}
          </span>
        </div>
      )}
      
      {/* Team name */}
      <h3 className="font-bold text-lg mb-1 text-black">
        {team.name}
      </h3>
      
      {/* Statistics */}
      <p className="text-[11px] text-black">Posizione in classifica</p>
      <p className="text-sm font-bold text-black">{standingsPosition ?? '—'}</p>
      
      <p className="text-[11px] text-black mt-1">{winRateLabel}</p>
      <p className="text-sm font-bold text-black">{winRate !== null && winRate !== undefined ? `${winRate}%` : '0%'}</p>
      
      <p className="text-[11px] text-black mt-1">Ultimi 5 risultati</p>
      <LastFiveResults results={last5} form={form} />
    </div>
  );
}