/**
 * MatchCard Component
 * Complete match card with teams, details, and prediction controls
 */

import React from 'react';
import { motion, MotionValue, PanInfo } from 'framer-motion';
import { TeamInfo } from './TeamInfo';
import { MatchDetails } from './MatchDetails';
import type { Fixture, MatchCard as MatchCardType, PredictionChoice } from '../../types';

interface MatchCardProps {
  fixture: Fixture;
  matchCard?: MatchCardType;
  onPrediction: (fixtureId: number, choice: PredictionChoice) => void;
  currentPrediction?: PredictionChoice;
  disabled?: boolean;
  
  // Animation props
  dragProps?: {
    drag?: boolean;
    dragElastic?: number;
    onDragEnd?: (event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => void;
  };
  style?: {
    x?: MotionValue<number>;
    y?: MotionValue<number>;
    rotate?: MotionValue<number>;
  };
  
  className?: string;
}

export function MatchCard({
  fixture,
  matchCard,
  onPrediction,
  currentPrediction,
  disabled = false,
  dragProps,
  style,
  className = '',
}: MatchCardProps) {
  const handlePrediction = (choice: PredictionChoice) => {
    onPrediction(fixture.id, choice);
  };

  return (
    <motion.div
      {...dragProps}
      style={style}
      className={`match-card bg-white rounded-2xl p-6 shadow-lg border border-gray-200 ${className}`}
    >
      {/* Match details */}
      <MatchDetails
        kickoff={matchCard?.kickoff}
        stadium={matchCard?.stadium}
        date={fixture.date}
        venue={fixture.venue}
      />

      {/* Teams */}
      <div className="flex justify-between items-center mb-6">
        <TeamInfo
          team={fixture.teams.home}
          standingsPosition={matchCard?.home.standingsPosition}
          winRate={matchCard?.home.winRateHome}
          winRateLabel="Vittorie in casa"
          last5={matchCard?.home.last5 || []}
          form={matchCard?.home.form}
        />
        
        <TeamInfo
          team={fixture.teams.away}
          standingsPosition={matchCard?.away.standingsPosition}
          winRate={matchCard?.away.winRateAway}
          winRateLabel="Vittorie in trasferta"
          last5={matchCard?.away.last5 || []}
          form={matchCard?.away.form}
        />
      </div>

      {/* Prediction buttons removed - they're now on page level */}
    </motion.div>
  );
}