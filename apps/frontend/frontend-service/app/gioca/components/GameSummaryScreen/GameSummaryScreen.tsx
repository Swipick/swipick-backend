/**
 * GameSummaryScreen Component
 * Full-screen comprehensive summary showing all predictions like backup file
 */

import React from 'react';
import type { Fixture, PredictionRecord } from '../../types';

interface GameSummaryScreenProps {
  predictions: PredictionRecord;
  fixtures: Fixture[];
}

export function GameSummaryScreen({
  predictions,
  fixtures,
}: GameSummaryScreenProps) {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Main content - scrollable predictions list */}
      <div className="flex-1 overflow-y-auto px-4 pt-20 pb-20">
        <div className="space-y-4 max-w-md mx-auto">
          {fixtures.map((fixture) => {
            const prediction = predictions[fixture.id];
            return (
              <div key={fixture.id} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                <div className="flex items-center justify-between">
                  {/* Teams */}
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-3">
                        <div className="text-sm font-semibold text-gray-800">
                          {fixture.teams.home.name}
                        </div>
                      </div>
                      {prediction && (
                        <div className="flex items-center space-x-2">
                          <span className={`
                            inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold text-white
                            ${prediction === '1' ? 'bg-purple-600' :
                              prediction === 'X' ? 'bg-purple-600' :
                              'bg-purple-600'}
                          `}>
                            {prediction}
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="text-sm font-semibold text-gray-800">
                          {fixture.teams.away.name}
                        </div>
                      </div>
                      <div className="text-xs text-gray-500">
                        {new Date(fixture.date).toLocaleDateString('it-IT', {
                          weekday: 'short',
                          day: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}