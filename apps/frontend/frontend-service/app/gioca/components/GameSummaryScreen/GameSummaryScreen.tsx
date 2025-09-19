/**
 * GameSummaryScreen Component
 * Shows completed game summary with user predictions and provides restart option
 */

import React from 'react';
import type { Fixture, PredictionRecord } from '../../types';

interface GameSummaryScreenProps {
  predictions: PredictionRecord;
  fixtures: Fixture[];
  onPlayAgain: () => void;
  onViewResults: () => void;
}

export function GameSummaryScreen({
  predictions,
  fixtures,
  onPlayAgain,
  onViewResults,
}: GameSummaryScreenProps) {
  // Get predictions with fixture details
  const predictedFixtures = fixtures.filter(fixture => predictions[fixture.id]);

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[80vh] overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white p-6 text-center">
          <h2 className="text-2xl font-bold mb-2">Gioco Completato! 🎉</h2>
          <p className="text-purple-100">Hai fatto tutte le 10 predizioni</p>
        </div>

        {/* Predictions Summary */}
        <div className="p-6 max-h-96 overflow-y-auto">
          <h3 className="font-semibold text-gray-800 mb-4">Le tue predizioni:</h3>
          <div className="space-y-3">
            {predictedFixtures.map((fixture) => (
              <div key={fixture.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex-1">
                  <div className="text-sm font-medium text-gray-800">
                    {fixture.teams.home.name} vs {fixture.teams.away.name}
                  </div>
                  <div className="text-xs text-gray-500">
                    {new Date(fixture.date).toLocaleDateString('it-IT', {
                      weekday: 'short',
                      day: '2-digit',
                      month: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </div>
                </div>
                <div className="ml-4">
                  <span className={`
                    inline-flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold text-white
                    ${predictions[fixture.id] === '1' ? 'bg-green-500' :
                      predictions[fixture.id] === 'X' ? 'bg-blue-500' :
                      'bg-orange-500'}
                  `}>
                    {predictions[fixture.id]}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="p-6 border-t border-gray-200 space-y-3">
          <button
            onClick={onPlayAgain}
            className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-semibold py-3 px-6 rounded-lg hover:from-purple-700 hover:to-indigo-700 transition-all duration-200"
          >
            Gioca Ancora
          </button>
          <button
            onClick={onViewResults}
            className="w-full bg-white border-2 border-purple-600 text-purple-600 font-semibold py-3 px-6 rounded-lg hover:bg-purple-50 transition-all duration-200"
          >
            Vai ai Risultati
          </button>
        </div>
      </div>
    </div>
  );
}