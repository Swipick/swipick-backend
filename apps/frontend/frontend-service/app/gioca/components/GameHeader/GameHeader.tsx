/**
 * GameHeader Component
 * Complete header with week info, countdown, and progress
 */

import React, { useState, useEffect, useRef } from 'react';
import { MdOutlineIosShare } from 'react-icons/md';
import { CountdownTimer } from './CountdownTimer';
import { ProgressBar } from './ProgressBar';
import { useLiveWeek } from '../../hooks/useLiveWeek';
import type { TimeToMatch, GameMode } from '../../types';
import { GAME_CONFIG } from '../../utils/constants';

interface GameHeaderProps {
  currentMode: GameMode;
  selectedWeek: number | null;
  timeToMatch: TimeToMatch;
  predictionsCount: number;
  className?: string;
  fixtures?: Array<{ date: string }>;
  isSticky?: boolean;
  onHeightChange?: (height: number) => void;
  // Testing props
  onReset?: () => void;
  isInSkippedMode?: boolean;
  skippedCardIndexes?: number[];
  currentFixtureIndex?: number;
}

export function GameHeader({
  currentMode,
  selectedWeek,
  timeToMatch,
  predictionsCount,
  className = '',
  fixtures = [],
  isSticky = false,
  onHeightChange,
  onReset,
  isInSkippedMode = false,
  skippedCardIndexes = [],
  currentFixtureIndex = 0,
}: GameHeaderProps) {
  const headerRef = useRef<HTMLDivElement | null>(null);
  const [headerHeight, setHeaderHeight] = useState<number>(160);

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
  }, [currentMode, onHeightChange]);

  // Share functionality
  const [shareLoading, setShareLoading] = useState(false);

  const handleShare = async () => {
    setShareLoading(true);
    try {
      if (navigator.share) {
        await navigator.share({
          title: 'Swipick - Football Predictions',
          text: 'Check out my football predictions on Swipick!',
          url: window.location.origin,
        });
      } else {
        // Fallback for browsers without Web Share API
        await navigator.clipboard.writeText(window.location.origin);
        // Could add a toast notification here
      }
    } catch (error) {
      console.log('Error sharing:', error);
    } finally {
      setShareLoading(false);
    }
  };

  const modeLabel = currentMode === 'test' ? 'Modalità Test' : 'Live';

  // Get reliable live week data from database (live mode only)
  const { liveWeekData, loading: liveWeekLoading, error: liveWeekError } = useLiveWeek({ mode: currentMode });

  // Determine week data based on mode
  const getWeekData = () => {
    if (currentMode === 'live') {
      // Live mode: use reliable database data, no fallbacks
      if (liveWeekError) {
        return {
          from: '',
          to: '',
          weekNumber: null,
          error: `Live week error: ${liveWeekError}`
        };
      }

      if (liveWeekLoading || !liveWeekData) {
        return {
          from: '',
          to: '',
          weekNumber: null,
          error: null
        };
      }

      // Use reliable data from database
      return {
        from: liveWeekData.weekDateRange.from,
        to: liveWeekData.weekDateRange.to,
        weekNumber: liveWeekData.currentWeek,
        error: null
      };
    } else {
      // Test mode: use selectedWeek with fixture-based date calculation fallback
      if (!fixtures.length) {
        return { from: '', to: '', weekNumber: selectedWeek || 1, error: null };
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

      return { from, to, weekNumber: selectedWeek || 1, error: null };
    }
  };

  const { from, to, weekNumber, error: weekDataError } = getWeekData();
  
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
        {/* Mode indicator */}
        {currentMode === 'test' && (
          <div className="inline-block px-2 py-1 mb-2 text-xs bg-white/20 rounded-full">
            {modeLabel}
          </div>
        )}
        
        {/* Week title */}
        <h1 className="text-base md:text-lg mb-1 whitespace-nowrap">
          {weekDataError ? (
            <span className="text-red-200">
              Errore settimana: {weekDataError}
            </span>
          ) : weekNumber ? (
            <>
              Giornata {weekNumber}
              {from && to && (
                <span className="opacity-90"> dal {from} al {to}</span>
              )}
            </>
          ) : (
            <span className="opacity-70">
              {currentMode === 'live' ? 'Caricamento settimana...' : 'Giornata --'}
            </span>
          )}
        </h1>
        
        {/* Countdown timer */}
        <CountdownTimer timeToMatch={timeToMatch} className="mb-4" />
        
        {/* Progress bar */}
        <ProgressBar
          current={predictionsCount}
          total={GAME_CONFIG.TOTAL_PREDICTIONS}
        />

        {/* Reset Button for Testing (Live Mode) */}
        {currentMode === 'live' && onReset && (
          <div className="mt-3 pt-3 border-t border-white/20">
            <div className="flex flex-wrap items-center justify-center gap-2 text-xs">
              <button
                onClick={onReset}
                className="bg-red-500 text-white px-3 py-1 rounded font-medium hover:bg-red-600"
              >
                🔄 Reset Game (Test Button)
              </button>
              <span className="text-white/80">
                Current: {predictionsCount}/10 predictions
              </span>
              {isInSkippedMode && (
                <span className="bg-orange-100 text-orange-800 px-2 py-1 rounded">
                  📄 Skipped Cards Mode ({skippedCardIndexes.length} cards) - Current: {currentFixtureIndex}
                </span>
              )}
              {skippedCardIndexes.length > 0 && !isInSkippedMode && (
                <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded">
                  🔄 Skipped: [{skippedCardIndexes.join(', ')}]
                </span>
              )}
            </div>
          </div>
        )}

        {/* Share Button (only when sticky/summary screen active) */}
        {isSticky && (
          <div className="mt-3 pt-3 border-t border-white/20">
            <div className="flex justify-center">
              <button
                className={`w-fit inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium shadow ${
                  shareLoading
                    ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                    : 'bg-white text-purple-600 hover:bg-gray-50'
                }`}
                onClick={handleShare}
                disabled={shareLoading}
                title="Condividi previsione"
              >
                <MdOutlineIosShare className="w-4 h-4" />
                Condividi previsione
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}