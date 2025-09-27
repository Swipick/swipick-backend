/**
 * PredictionButtons Component
 * Diamond layout buttons for making predictions
 */

import React from 'react';
import type { PredictionChoice } from '../../types';

interface PredictionButtonsProps {
  currentPrediction?: PredictionChoice;
  canShowVeil: boolean;
  isSkipAnimating: boolean;
  onAnimateAndCommit: (direction: 'up' | 'down' | 'left' | 'right') => void;
}

export function PredictionButtons({
  currentPrediction,
  canShowVeil,
  isSkipAnimating,
  onAnimateAndCommit,
}: PredictionButtonsProps) {
  // Button styles for diamond layout
  const buttonStyle: React.CSSProperties = {
    background: 'radial-gradient(circle at center, #7956f3, #7d57f8)',
    boxShadow: '0 8px 16px rgba(85, 64, 153, 0.3), 0 4px 8px rgba(0, 0, 0, 0.2)',
  };

  const skipStyle: React.CSSProperties = {
    background: '#ffffff',
    boxShadow: '0 8px 16px rgba(85, 64, 153, 0.2), 0 4px 8px rgba(0, 0, 0, 0.1)',
    border: '1px solid rgba(85, 64, 153, 0.2)',
  };

  return (
    <div className="relative left-0 right-0 px-4 mt-3 mb-14 prediction-buttons-main-responsive">
      <div className="flex justify-center">
        <div className="grid grid-cols-3 gap-x-4 gap-y-0 justify-items-center items-center max-w-[340px] w-full mx-auto prediction-buttons-container-responsive">
          {/* Top: X */}
          <div className="col-start-2">
            <button
              onClick={() => onAnimateAndCommit('up')}
              disabled={canShowVeil || isSkipAnimating}
              className={`relative w-16 text-center text-white text-sm font-bold py-2.5 px-4 rounded-md shadow-lg transition-all duration-200 hover:scale-105 prediction-button-responsive ${
                currentPrediction === 'X' ? 'scale-105' : ''
              }`}
              style={buttonStyle}
            >
              X
            </button>
          </div>

          {/* Middle Left: 1 */}
          <div className="col-start-1 row-start-2">
            <button
              onClick={() => onAnimateAndCommit('left')}
              disabled={canShowVeil || isSkipAnimating}
              className={`relative w-16 text-center text-white text-sm font-bold py-2.5 px-4 rounded-md shadow-lg transition-all duration-200 hover:scale-105 prediction-button-responsive ${
                currentPrediction === '1' ? 'scale-105' : ''
              }`}
              style={buttonStyle}
            >
              1
            </button>
          </div>

          {/* Middle Right: 2 */}
          <div className="col-start-3 row-start-2">
            <button
              onClick={() => onAnimateAndCommit('right')}
              disabled={canShowVeil || isSkipAnimating}
              className={`relative w-16 text-center text-white text-sm font-bold py-2.5 px-4 rounded-md shadow-lg transition-all duration-200 hover:scale-105 prediction-button-responsive ${
                currentPrediction === '2' ? 'scale-105' : ''
              }`}
              style={buttonStyle}
            >
              2
            </button>
          </div>

          {/* Bottom: Skip */}
          <div className="col-start-2 row-start-3 -mt-2">
            <button
              onClick={() => onAnimateAndCommit('down')}
              disabled={canShowVeil}
              className="relative w-16 text-center bg-white text-[#3d2d73] text-sm font-bold py-2.5 px-4 rounded-md shadow-lg transition-all duration-200 hover:scale-105 disabled:opacity-60 prediction-button-responsive"
              style={skipStyle}
            >
              skip
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}