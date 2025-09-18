/**
 * LastFiveResults Component
 * Displays the last 5 match results showing team position ('1' for home, '2' for away)
 * with color-coded buttons based on result (green=win, gray=draw, red=loss)
 */

import React from 'react';
import type { Last5Item } from '../../types/matchCards';

interface LastFiveResultsProps {
  results: Array<'1' | 'X' | '2'>;
  form?: Last5Item[];
  className?: string;
}

export function LastFiveResults({ results, form, className = '' }: LastFiveResultsProps) {
  // Normalize to Last5Item[], pad to 5, then render right-to-left (most recent on the right)
  const base: (Last5Item | null)[] = (form && form.length)
    ? form
    : results.map((code) => ({ fixtureId: 0, code, predicted: null, correct: null, wasHome: false }));
  const filled: Array<Last5Item | null> = base.slice(0, 5);
  while (filled.length < 5) filled.push(null);

  // Render left-to-right so the first (oldest) appears on the left and the last (newest) on the right
  return (
    <div className={`flex justify-center gap-1 mt-1 ${className}`}>
      {filled.map((it, idx) => {
        if (it === null) {
          return (
            <div
              key={idx}
              className="w-5 h-5 rounded-md text-[10px] leading-none flex items-center justify-center bg-gray-100 text-gray-700 border border-gray-700"
              aria-label="no data"
              title="—"
            >
              —
            </div>
          );
        }
        
        // Display team position: '1' if home, '2' if away
        const displayCode = it.wasHome ? '1' : '2';
        const positionLabel = it.wasHome ? 'Casa' : 'Trasferta';

        let color = 'bg-gray-100 text-gray-700 border border-gray-700';
        let resultLabel = '';

        // Color based on team's actual result in this match
        if (it.code === 'X') {
          // Draw - gray for both teams
          color = 'bg-gray-100 text-gray-700 border border-gray-700';
          resultLabel = 'Pareggio';
        } else if (it.wasHome !== undefined) {
          // Determine if this team won or lost
          // it.code: '1' = home won, '2' = away won
          // it.wasHome: true = this team was home, false = this team was away
          const teamWon = (it.wasHome && it.code === '1') || (!it.wasHome && it.code === '2');
          if (teamWon) {
            // Win - green
            color = 'bg-green-100 text-green-800 font-bold border border-green-800';
            resultLabel = 'Vittoria';
          } else {
            // Loss - red
            color = 'bg-red-100 text-red-800 font-bold border border-red-800';
            resultLabel = 'Sconfitta';
          }
        }

        const titleStr = `${displayCode} — ${positionLabel} — ${resultLabel}`;

        return (
          <div
            key={idx}
            className={`w-5 h-5 rounded-md text-[10px] font-bold leading-none flex items-center justify-center ${color}`}
            title={titleStr}
            aria-label={titleStr}
          >
            {displayCode}
          </div>
        );
      })}
    </div>
  );
}