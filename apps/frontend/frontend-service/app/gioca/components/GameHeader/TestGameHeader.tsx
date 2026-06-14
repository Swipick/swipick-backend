/**
 * TestGameHeader Component
 * Dedicated header for test mode starting from August 18th, 2023
 * Simplified version focused on test mode functionality
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { MdOutlineIosShare } from 'react-icons/md';
import { CountdownTimer } from './CountdownTimer';
import { ProgressBar } from './ProgressBar';
import { useVirtualClock } from '../VirtualClock';
import { getWeekFixtures, WeekInfo } from '../../utils/weekCalculator';
import type { TimeToMatch } from '../../types';
import { GAME_CONFIG } from '../../utils/constants';
import { apiClient } from "@/lib/api-client";

interface TestGameHeaderProps {
  selectedWeek: number | null;
  timeToMatch: TimeToMatch;
  predictionsCount: number;
  className?: string;
  fixtures?: Array<{ date: string }>;
  isSticky?: boolean;
  onHeightChange?: (height: number) => void;
  userKey?: string | null;
  onReset?: () => void;
  onActiveWeekChange?: (activeWeek: number) => void;
}

export function TestGameHeader({
  selectedWeek,
  timeToMatch,
  predictionsCount,
  className = '',
  fixtures = [],
  isSticky = false,
  onHeightChange,
  userKey,
  onReset,
  onActiveWeekChange,
}: TestGameHeaderProps) {
  const headerRef = useRef<HTMLDivElement | null>(null);

  // Virtual clock retained only for the cosmetic countdown timer; giornata
  // selection is now driven by server-side sequential progression.
  const { virtualTime, resetClock } = useVirtualClock();

  // Dynamic active week state - start with null to prevent showing incorrect week
  const [activeWeekInfo, setActiveWeekInfo] = useState<WeekInfo | null>(null);
  const [activeWeekFixtures, setActiveWeekFixtures] = useState<Array<{ date: string; id: number }>>([]);

  // Virtual timeToMatch state for test mode
  const [virtualTimeToMatch, setVirtualTimeToMatch] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });

  // Sequential progression state (server-driven, replaces the virtual clock)
  const [maxWeek, setMaxWeek] = useState<number>(38);
  const [advanceLoading, setAdvanceLoading] = useState(false);
  const [progressionTick, setProgressionTick] = useState(0);

  // Reset state
  const [isResetting, setIsResetting] = useState(false);

  // Share state
  const [shareLoading, setShareLoading] = useState(false);

  // Calculate time to next match using virtual date
  const calculateTimeToMatch = useCallback(() => {
    if (activeWeekFixtures.length === 0) {
      return { days: 0, hours: 0, minutes: 0, seconds: 0 };
    }

    // Find the next upcoming match from active week fixtures based on virtual date
    const virtualNow = virtualTime.getTime();
    const upcomingMatches = activeWeekFixtures
      .map(f => new Date(f.date))
      .filter(date => date.getTime() > virtualNow)
      .sort((a, b) => a.getTime() - b.getTime());

    if (upcomingMatches.length === 0) {
      return { days: 0, hours: 0, minutes: 0, seconds: 0 };
    }

    const nextMatch = upcomingMatches[0];

    // For test mode countdown: simulate time progressing from virtual date
    // Calculate the original diff at virtual date (e.g., 7 days from Sep 9 to Sep 16)
    const originalDiff = nextMatch.getTime() - virtualNow;

    // To create a countdown effect, we simulate that time has passed since the virtual date
    // We'll use the page load time as the starting point to avoid negative values
    const now = Date.now();
    const timeElapsedSincePageLoad = now - virtualNow; // This will be a large positive number

    // But we want a realistic countdown, so let's just use the original diff
    // and subtract a small amount of time to simulate progression
    const simulatedElapsed = (now % 60000); // Use current seconds as simulation
    const remainingTime = Math.max(0, originalDiff - simulatedElapsed);

    if (remainingTime <= 0) {
      return { days: 0, hours: 0, minutes: 0, seconds: 0 };
    }

    const days = Math.floor(remainingTime / (1000 * 60 * 60 * 24));
    const hours = Math.floor((remainingTime % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((remainingTime % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((remainingTime % (1000 * 60)) / 1000);

    return { days, hours, minutes, seconds };
  }, [activeWeekFixtures, virtualTime]);

  // Measure header height and notify parent
  useEffect(() => {
    const measure = () => {
      if (headerRef.current) {
        const height = headerRef.current.getBoundingClientRect().height;
        onHeightChange?.(height);
      }
    };

    // Measure on mount and resize
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [onHeightChange]);

  // Determine the active giornata from the server-side per-user progression
  // (sequential, explicit "Prossima giornata" advance — no virtual clock).
  useEffect(() => {
    if (!userKey) return;
    const updateActiveWeek = async () => {
      try {
        const resp = await apiClient.getTestProgression(userKey);
        const data = (resp as { data?: { currentWeek?: number; maxWeek?: number } })?.data ?? resp;
        const currentWeek = Number((data as { currentWeek?: number })?.currentWeek ?? 1);
        const max = Number((data as { maxWeek?: number })?.maxWeek ?? 38);
        setMaxWeek(max);

        const weekInfo: WeekInfo = { activeWeek: currentWeek, status: 'prediction' };
        setActiveWeekInfo(weekInfo);

        // Notify parent component of active week change
        onActiveWeekChange?.(currentWeek);

        // Fetch fixtures for the active week (date-range display)
        const fixtures = await getWeekFixtures(currentWeek);
        setActiveWeekFixtures(fixtures);

        console.log(`[TestGameHeader] Active giornata (progression): ${currentWeek}/${max}`);
      } catch (error) {
        console.error('[TestGameHeader] Error loading progression:', error);
      }
    };

    updateActiveWeek();
  }, [userKey, onActiveWeekChange, progressionTick]); // Reload after advance/reset

  // Advance to the next giornata in sequence ("Prossima giornata")
  const handleNextGiornata = useCallback(async () => {
    if (!userKey || advanceLoading) return;
    try {
      setAdvanceLoading(true);
      // Clear local prediction flags so the new giornata starts fresh in the UI
      try {
        const keysToRemove: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.includes('swipick:gioca:') && key.includes(`:user:${userKey}`)) {
            keysToRemove.push(key);
          }
        }
        keysToRemove.forEach((k) => localStorage.removeItem(k));
      } catch {}

      await apiClient.advanceTestProgression(userKey);
      onReset?.(); // reset local game state for the new giornata
      setProgressionTick((t) => t + 1); // re-fetch progression
    } catch (error) {
      console.error('[TestGameHeader] Failed to advance giornata:', error);
    } finally {
      setAdvanceLoading(false);
    }
  }, [userKey, advanceLoading, onReset]);

  // Update virtual countdown every second
  useEffect(() => {
    const updateVirtualCountdown = () => {
      setVirtualTimeToMatch(calculateTimeToMatch());
    };

    // Initial calculation
    updateVirtualCountdown();

    // Update every second
    const timer = setInterval(updateVirtualCountdown, 1000);

    return () => clearInterval(timer);
  }, [calculateTimeToMatch]);

  // Handle reset function
  const handleReset = useCallback(async () => {
    if (!userKey || isResetting) return;

    const confirmed = window.confirm(
      'Sei sicuro di voler resettare tutte le tue previsioni? Questa azione non può essere annullata.'
    );

    if (!confirmed) return;

    try {
      setIsResetting(true);

      // Clear all localStorage prediction data for this user
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.includes('swipick:gioca:') && key.includes(`:user:${userKey}`)) {
          keysToRemove.push(key);
        }
      }

      // Remove all prediction localStorage keys
      keysToRemove.forEach(key => {
        localStorage.removeItem(key);
        console.log(`[TestGameHeader] 🧹 Cleared prediction localStorage: ${key}`);
      });

      // Call API to reset user's test data
      await apiClient.resetTestData(userKey);

      // Reset virtual clock to default start date (August 18, 2023)
      resetClock();

      // Call parent reset callback to clear local state
      onReset?.();

      console.log('✅ Test data, localStorage, and virtual clock reset successfully');

      // Small delay to ensure localStorage clearing completes before navigation
      setTimeout(() => {
        window.location.href = '/gioca?mode=test';
      }, 150);
    } catch (error) {
      console.error('❌ Failed to reset test data:', error);
      alert('Errore durante il reset. Riprova più tardi.');
    } finally {
      setIsResetting(false);
    }
  }, [userKey, isResetting, onReset, resetClock]);

  // Handle share function
  const handleShare = async () => {
    setShareLoading(true);
    try {
      const shareData = {
        title: 'Swipick - Previsioni Calcio',
        text: 'Ho fatto su Swipick le mie previsioni per la prossima giornata di calcio. Puoi battermi? https://mindful-sparkle-production.up.railway.app/registro',
        url: window.location.origin,
      };

      if (navigator.share && navigator.canShare?.(shareData)) {
        await navigator.share(shareData);
      } else {
        // Fallback: copy to clipboard
        const shareText = `Ho fatto su Swipick le mie previsioni per la prossima giornata di calcio. Puoi battermi?https://mindful-sparkle-production.up.railway.app/registro\n${window.location.origin}`;
        await navigator.clipboard.writeText(shareText);
        // Could show a toast notification here if available
      }
    } catch (error) {
      console.log('Error sharing:', error);
      // Silently fail - user might have cancelled the share
    } finally {
      setShareLoading(false);
    }
  };

  // Calculate week data based on dynamic active week and fixtures
  const getWeekData = () => {
    // If activeWeekInfo is null, we're still calculating - show loading state
    if (!activeWeekInfo) {
      return { from: '', to: '', weekNumber: null, isLoading: true };
    }

    const weekNumber = activeWeekInfo.activeWeek;

    // Use active week fixtures for date range if available
    if (activeWeekFixtures.length > 0) {
      const dates = activeWeekFixtures.map(f => new Date(f.date)).sort((a, b) => a.getTime() - b.getTime());
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

      return { from, to, weekNumber, isLoading: false };
    }

    // Don't use fixtures prop as fallback to avoid showing wrong week
    // Wait for proper active week calculation instead
    return { from: '', to: '', weekNumber, isLoading: false };
  };

  const { from, to, weekNumber, isLoading } = getWeekData();

  return (
    <div
      ref={headerRef}
      className={`
        w-full mx-0 mt-0 rounded-b-2xl rounded-t-none text-white p-6 game-header-responsive
        ${isSticky ? 'fixed left-0 right-0 top-0 z-40 pt-[max(env(safe-area-inset-top),8px)]' : 'mb-6'}
        ${className}
      `}
      style={{
        background: 'linear-gradient(to bottom, #52418d, #7a57f6)',
        boxShadow: '0 8px 16px rgba(85, 64, 153, 0.3), 0 4px 8px rgba(0, 0, 0, 0.2)',
      }}>
      <div className="text-center">
        {/* Test Mode indicator with Reset button */}
        <div className="flex items-center justify-center gap-2 mb-2">
          <div className="inline-block px-2 py-1 text-xs bg-white/20 rounded-full game-header-mode-responsive">
            Modalità Test
          </div>
          {userKey && (
            <button
              onClick={handleReset}
              disabled={isResetting}
              className="inline-flex items-center px-2 py-1 text-xs bg-red-500/80 hover:bg-red-600/80 disabled:bg-red-500/40 rounded-full transition-colors"
              title="Reset tutte le previsioni"
            >
              {isResetting ? (
                <>
                  <svg className="animate-spin -ml-0.5 mr-1 h-3 w-3 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Reset...
                </>
              ) : (
                <>
                  <svg className="-ml-0.5 mr-1 h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Reset
                </>
              )}
            </button>
          )}
        </div>

        {/* Week title */}
        <h1 className="text-base md:text-lg mb-1 whitespace-nowrap game-header-title-responsive">
          {isLoading ? (
            <span className="opacity-70">Caricamento settimana...</span>
          ) : weekNumber ? (
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
        <CountdownTimer timeToMatch={virtualTimeToMatch} className="mb-4 game-header-countdown-responsive" />

        {/* Progress bar */}
        <ProgressBar
          current={predictionsCount}
          total={GAME_CONFIG.TOTAL_PREDICTIONS}
        />

        {/* Share Button (only when sticky/summary screen active) */}
        {isSticky && (
          <div className="mt-3 flex justify-center">
            <button
              onClick={handleShare}
              disabled={shareLoading}
              className="inline-flex items-center gap-2 px-4 py-2 bg-white hover:bg-gray-100 disabled:bg-gray-200 rounded-lg transition-colors text-sm font-medium text-purple-700"
              title="Sfida i tuoi amici"
            >
              {shareLoading ? (
                <div className="w-4 h-4 border-2 border-purple-300 border-t-purple-700 rounded-full animate-spin" />
              ) : (
                <MdOutlineIosShare className="w-4 h-4 text-purple-700" />
              )}
              Sfida i tuoi amici
            </button>
          </div>
        )}

        {/* Sequential giornata progression controls */}
        <div className="mt-3 pt-3 border-t border-white/20 game-header-reset-responsive">
          <div className="text-xs text-white/80 mb-2">
            Giornata {weekNumber ?? '--'} di {maxWeek}
          </div>

          <div className="flex justify-center gap-2">
            <button
              onClick={handleNextGiornata}
              disabled={advanceLoading || (weekNumber != null && weekNumber >= maxWeek)}
              className="inline-flex items-center px-3 py-1 text-xs bg-blue-500/80 hover:bg-blue-600/80 disabled:bg-blue-500/40 rounded-full transition-colors"
              title="Vai alla prossima giornata"
            >
              {advanceLoading ? (
                <svg className="animate-spin -ml-0.5 mr-1 h-3 w-3 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                </svg>
              ) : (
                <svg className="-ml-0.5 mr-1 h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 9l3 3-3 3m-6 0l3-3-3-3" />
                </svg>
              )}
              Prossima giornata
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}