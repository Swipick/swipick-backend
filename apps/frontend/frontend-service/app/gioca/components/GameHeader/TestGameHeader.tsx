/**
 * TestGameHeader Component
 * Dedicated header for test mode with fixed date (September 24th, 2023)
 * Simplified version focused on test mode functionality
 */

import React, { useState, useEffect, useRef } from 'react';
import { CountdownTimer } from './CountdownTimer';
import { ProgressBar } from './ProgressBar';
import type { TimeToMatch } from '../../types';
import { GAME_CONFIG } from '../../utils/constants';

interface TestGameHeaderProps {
  selectedWeek: number | null;
  timeToMatch: TimeToMatch;
  predictionsCount: number;
  className?: string;
  fixtures?: Array<{ date: string }>;
  isSticky?: boolean;
  onHeightChange?: (height: number) => void;
}

export function TestGameHeader({
  selectedWeek,
  timeToMatch,
  predictionsCount,
  className = '',
  fixtures = [],
  isSticky = false,
  onHeightChange,
}: TestGameHeaderProps) {
  const headerRef = useRef<HTMLDivElement | null>(null);
  const [headerHeight, setHeaderHeight] = useState<number>(160);

  // Fixed test date: September 24th, 2023
  const FIXED_TEST_DATE = new Date('2023-09-24T12:00:00.000Z');

  // Measure header height and notify parent
  useEffect(() => {
    const measure = () => {
      if (headerRef.current) {
        const height = headerRef.current.getBoundingClientRect().height;
        setHeaderHeight(height);
        onHeightChange?.(height);
      }
    };

    // Measure on mount and resize
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [onHeightChange]);

  // Calculate week data based on fixtures and fixed test date
  const getWeekData = () => {
    if (!fixtures.length) {
      return { from: '', to: '', weekNumber: selectedWeek || 1 };
    }

    const dates = fixtures.map(f => new Date(f.date)).sort((a, b) => a.getTime() - b.getTime());
    const firstDate = dates[0];
    const lastDate = dates[dates.length - 1];

    const from = firstDate.toLocaleDateString('it-IT', {
      day: '2-digit',
      month: '2-digit',
      timeZone: 'Europe/Rome'
    });
    const to = lastDate.toLocaleDateString('it-IT', {
      day: '2-digit',
      month: '2-digit',
      timeZone: 'Europe/Rome'
    });

    return { from, to, weekNumber: selectedWeek || 1 };
  };

  const { from, to, weekNumber } = getWeekData();

  return (
    <div
      ref={headerRef}
      className={`
        w-full mx-0 mt-0 rounded-b-2xl rounded-t-none text-white p-6
        ${isSticky ? 'fixed left-0 right-0 top-0 z-40 pt-[max(env(safe-area-inset-top),8px)]' : 'mb-6'}
        ${className}
      `}
      style={{
        background: 'radial-gradient(circle at center, #554099, #3d2d73)',
        boxShadow: '0 8px 16px rgba(85, 64, 153, 0.3), 0 4px 8px rgba(0, 0, 0, 0.2)',
      }}>
      <div className="text-center">
        {/* Test Mode indicator */}
        <div className="inline-block px-2 py-1 mb-2 text-xs bg-white/20 rounded-full">
          Modalità Test
        </div>

        {/* Week title */}
        <h1 className="text-base md:text-lg mb-1 whitespace-nowrap">
          {weekNumber ? (
            <>
              Giornata {weekNumber}
              {from && to && (
                <span className="opacity-90"> dal {from} al {to}</span>
              )}
            </>
          ) : (
            <span className="opacity-70">Giornata --</span>
          )}
        </h1>

        {/* Countdown timer */}
        <CountdownTimer timeToMatch={timeToMatch} className="mb-4" />

        {/* Progress bar */}
        <ProgressBar
          current={predictionsCount}
          total={GAME_CONFIG.TOTAL_PREDICTIONS}
        />

        {/* Test mode info - shows current fixed date */}
        <div className="mt-3 pt-3 border-t border-white/20">
          <div className="text-xs text-white/80">
            📅 Data simulata: {FIXED_TEST_DATE.toLocaleDateString('it-IT', {
              day: '2-digit',
              month: '2-digit',
              year: 'numeric',
              timeZone: 'Europe/Rome'
            })}
          </div>
        </div>
      </div>
    </div>
  );
}