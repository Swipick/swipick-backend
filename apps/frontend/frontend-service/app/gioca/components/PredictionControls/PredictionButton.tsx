/**
 * PredictionButton Component
 * Individual prediction button (1, X, 2) with styling and interaction
 */

import React from 'react';
import type { PredictionChoice } from '../../types';

interface PredictionButtonProps {
  choice: PredictionChoice;
  onClick: () => void;
  disabled?: boolean;
  isSelected?: boolean;
  className?: string;
}

const buttonStyles: Record<PredictionChoice, string> = {
  '1': 'bg-blue-500 hover:bg-blue-600 focus:ring-blue-300',
  'X': 'bg-gray-500 hover:bg-gray-600 focus:ring-gray-300', 
  '2': 'bg-red-500 hover:bg-red-600 focus:ring-red-300',
};

const selectedStyles: Record<PredictionChoice, string> = {
  '1': 'bg-blue-700 ring-2 ring-blue-300',
  'X': 'bg-gray-700 ring-2 ring-gray-300',
  '2': 'bg-red-700 ring-2 ring-red-300',
};

export function PredictionButton({
  choice,
  onClick,
  disabled = false,
  isSelected = false,
  className = '',
}: PredictionButtonProps) {
  const baseStyle = buttonStyles[choice];
  const selectedStyle = isSelected ? selectedStyles[choice] : '';
  
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`
        w-16 h-16 rounded-full text-white font-bold text-lg
        transition-all duration-200 transform
        focus:outline-none focus:ring-2 focus:ring-offset-2
        active:scale-95
        disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none
        ${isSelected ? selectedStyle : baseStyle}
        ${className}
      `}
      aria-label={`Predict ${choice === '1' ? 'home win' : choice === 'X' ? 'draw' : 'away win'}`}
    >
      {choice}
    </button>
  );
}