/**
 * GameSummaryScreen Component
 * Full-screen comprehensive summary showing all predictions like backup file
 */

import React, { useState } from 'react';
import { resolveTeamLogo } from '../../../../lib/club-logos';
import type { Fixture, PredictionRecord } from '../../types';

interface GameSummaryScreenProps {
  predictions: PredictionRecord;
  fixtures: Fixture[];
  headerHeight?: number;
}

// Team logo component with fallback
const TeamLogo: React.FC<{
  src?: string;
  alt: string;
  teamName: string;
}> = ({ src, alt, teamName }) => {
  const [imageError, setImageError] = useState(false);
  // Centralized resolver: normalizes names (e.g. "AS Roma", "Salernitana",
  // "Frosinone") and falls back to the backend logo path.
  const logoPath = resolveTeamLogo(teamName, src);

  if (!logoPath || imageError) {
    return (
      <div className="w-12 h-12 rounded-full bg-purple-100 flex items-center justify-center">
        <span className="text-purple-800 font-bold text-lg">
          {teamName.charAt(0)}
        </span>
      </div>
    );
  }

  return (
    <img
      src={logoPath}
      alt={alt}
      className="w-12 h-12 object-contain"
      onError={() => setImageError(true)}
    />
  );
};

// Choice badge component
const ChoiceBadge: React.FC<{
  label: '1' | 'X' | '2';
  isSelected: boolean;
}> = ({ label, isSelected }) => (
  <div
    className={
      `min-w-[36px] h-7 px-2 rounded-md grid place-items-center text-xs font-semibold border ` +
      (isSelected
        ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
        : 'bg-white text-gray-700 border-gray-300')
    }
  >
    {label}
  </div>
);

export function GameSummaryScreen({
  predictions,
  fixtures,
  headerHeight = 160,
}: GameSummaryScreenProps) {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Spacer for fixed header */}
      <div
        aria-hidden
        className="w-full"
        style={{ height: headerHeight + 24 }}
      />
      {/* Main content - scrollable predictions list */}
      <div className="flex-1 overflow-y-auto px-4 pb-20">
        <div className="space-y-4 max-w-md mx-auto">
          {fixtures.map((fixture) => {
            const prediction = predictions[fixture.id];
            const kickoff = new Date(fixture.date).toLocaleDateString('it-IT', {
              weekday: 'short',
              day: '2-digit',
              month: '2-digit',
              hour: '2-digit',
              minute: '2-digit'
            });

            const homeLogo = fixture.teams.home.logo;
            const awayLogo = fixture.teams.away.logo;
            const homeName = fixture.teams.home.name;
            const awayName = fixture.teams.away.name;

            return (
              <div
                key={fixture.id}
                className="bg-white rounded-2xl p-4 shadow-sm border border-gray-200 mb-4 flex items-center"
              >
                {/* Teams and details section */}
                <div className="flex-1">
                  {/* Home team */}
                  <div className="flex items-center gap-3 mb-2">
                    <TeamLogo
                      src={homeLogo}
                      alt={homeName}
                      teamName={homeName}
                    />
                    <span className="text-sm font-semibold text-black">
                      {homeName}
                    </span>
                  </div>

                  {/* Away team */}
                  <div className="flex items-center gap-3">
                    <TeamLogo
                      src={awayLogo}
                      alt={awayName}
                      teamName={awayName}
                    />
                    <span className="text-sm font-semibold text-black">
                      {awayName}
                    </span>
                  </div>
                </div>

                {/* Kickoff time pill */}
                <div className="mx-3">
                  <div className="px-3 py-1 rounded-md border text-[11px] text-gray-700 border-gray-200 whitespace-nowrap">
                    {kickoff}
                  </div>
                </div>

                {/* Choice badges (1/X/2) */}
                <div className="flex flex-col gap-2 items-center">
                  <ChoiceBadge label="1" isSelected={prediction === '1'} />
                  <ChoiceBadge label="X" isSelected={prediction === 'X'} />
                  <ChoiceBadge label="2" isSelected={prediction === '2'} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}