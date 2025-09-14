/**
 * ProgressBar Component
 * Visual progress indicator for predictions completion
 */

import React from 'react';

interface ProgressBarProps {
  current: number;
  total: number;
  className?: string;
  showLabel?: boolean;
}

export function ProgressBar({ 
  current, 
  total, 
  className = '', 
  showLabel = true 
}: ProgressBarProps) {
  const percentage = Math.min((current / total) * 100, 100);
  
  return (
    <div className={className}>
      <div className="bg-white/20 rounded-full h-2 mb-1">
        <div 
          className="bg-white rounded-full h-2 transition-all duration-300 ease-out"
          style={{ width: `${percentage}%` }}
        />
      </div>
      
      {showLabel && (
        <div className="text-xs text-center opacity-90">
          {current}/{total} predizioni
        </div>
      )}
    </div>
  );
}