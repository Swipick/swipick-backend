/**
 * LastFiveResults Component
 * Displays the last 5 match results with color-coded buttons
 */

import React from 'react';

interface Last5Item {
  fixtureId: number;
  code: '1' | 'X' | '2';
  predicted: '1' | 'X' | '2' | null;
  correct: boolean | null;
  wasHome: boolean;
}

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
        
        let color = 'bg-gray-100 text-gray-700 border border-gray-700';
        let titleStr: string = it.code;
        
        // Color based on team perspective (win/loss/draw)
        if (it.code === 'X') {
          // Draw - gray for both teams
          color = 'bg-gray-100 text-gray-700 border border-gray-700';
          titleStr = 'X — Pareggio';
        } else if (it.wasHome !== undefined) {
          // Win/Loss based on whether team was home/away in this specific match
          // it.code: '1' = home won, '2' = away won
          // it.wasHome: true = this team was home, false = this team was away
          const isGoodResult = (it.wasHome && it.code === '1') || (!it.wasHome && it.code === '2');
          if (isGoodResult) {
            // Win - green with darker green text and border
            color = 'bg-green-100 text-green-800 font-bold border border-green-800';
            titleStr = `${it.code} — Vittoria`;
          } else {
            // Loss - red with darker red text and border
            color = 'bg-red-100 text-red-800 font-bold border border-red-800';
            titleStr = `${it.code} — Sconfitta`;
          }
        } else {
          // Fallback to prediction-based coloring if team perspective unknown
          const pick = it.predicted;
          if (pick === '1' || pick === 'X' || pick === '2') {
            const matchesPrediction = pick === it.code;
            if (matchesPrediction) {
              color = 'bg-green-100 text-green-800 font-bold border border-green-800';
              titleStr = `${it.code} — Predizione corretta`;
            } else {
              color = 'bg-red-100 text-red-800 font-bold border border-red-800';
              titleStr = `${it.code} — Predizione errata`;
            }
          }
        }

        return (
          <div
            key={idx}
            className={`w-5 h-5 rounded-md text-[10px] font-bold leading-none flex items-center justify-center ${color}`}
            title={titleStr}
            aria-label={titleStr}
          >
            {it.code}
          </div>
        );
      })}
    </div>
  );
}