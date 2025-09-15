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
    <div className={`px-4 pb-6 ${className}`}>
      <div className="relative w-full max-w-xs mx-auto">
        <div className="bg-white bg-opacity-30 rounded-sm overflow-hidden" style={{ height: '18px' }}>
          <div
            className="bg-indigo-300 h-full rounded-sm transition-all duration-[350ms]"
            style={{ width: `${percentage}%` }}
          />
        </div>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-xs font-medium text-[#3d2d73]">
            {Math.min(current, total)}/{total}
          </span>
        </div>
      </div>
    </div>
  );
}