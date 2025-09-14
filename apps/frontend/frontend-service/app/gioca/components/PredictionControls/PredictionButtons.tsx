/**
 * PredictionButtons Component
 * Container for all three prediction buttons (1, X, 2) in diamond layout
 */

import React from 'react';
import { PredictionButton } from './PredictionButton';
import type { PredictionChoice } from '../../types';

interface PredictionButtonsProps {
  onPrediction: (choice: PredictionChoice) => void;
  disabled?: boolean;
  currentPrediction?: PredictionChoice;
  className?: string;
}

export function PredictionButtons({
  onPrediction,
  disabled = false,
  currentPrediction,
  className = '',
}: PredictionButtonsProps) {
  return (
    <div className={`flex justify-center items-center space-x-8 ${className}`}>
      <PredictionButton
        choice="1"
        onClick={() => onPrediction('1')}
        disabled={disabled}
        isSelected={currentPrediction === '1'}
      />
      
      <PredictionButton
        choice="X"
        onClick={() => onPrediction('X')}
        disabled={disabled}
        isSelected={currentPrediction === 'X'}
      />
      
      <PredictionButton
        choice="2"
        onClick={() => onPrediction('2')}
        disabled={disabled}
        isSelected={currentPrediction === '2'}
      />
    </div>
  );
}