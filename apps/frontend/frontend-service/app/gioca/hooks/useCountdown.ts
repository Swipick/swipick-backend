/**
 * useCountdown Hook
 * Manages countdown timer calculations and next match logic
 */

import { useState, useEffect, useCallback } from 'react';
import type { Fixture, TimeToMatch, GameMode } from '../types';
import { DEBUG_GIOCA, GAME_CONFIG } from '../utils/constants';

interface UseCountdownParams {
  fixtures: Fixture[];
  currentMode: GameMode;
}

interface UseCountdownReturn {
  nextTarget: Date | null;
  timeToMatch: TimeToMatch;
  setNextTarget: (target: Date | null) => void;
}

export function useCountdown({
  fixtures,
  currentMode,
}: UseCountdownParams): UseCountdownReturn {
  const [nextTarget, setNextTarget] = useState<Date | null>(null);
  const [timeToMatch, setTimeToMatch] = useState<TimeToMatch>({ days: 0, hours: 0, minutes: 0, seconds: 0 });

  // Compute the next target date from fixtures
  const computeNextTarget = useCallback((fixtureList: Fixture[]): Date | null => {
    if (fixtureList.length === 0) {
      if (DEBUG_GIOCA) {
        console.log('[DEBUG] computeNextTarget: No fixtures available');
      }
      return null;
    }
    
    const now = Date.now();
    
    if (currentMode === 'live') {
      // Live mode: use actual dates, find next upcoming match
      const upcomingMatches = fixtureList
        .map(f => new Date(f.date))
        .filter(date => date.getTime() > now)
        .sort((a, b) => a.getTime() - b.getTime());
      
      if (DEBUG_GIOCA) {
        console.log('[DEBUG] Upcoming matches found:', upcomingMatches.length, upcomingMatches[0]?.toISOString());
      }
      return upcomingMatches.length > 0 ? upcomingMatches[0] : null;
    } else {
      // Test mode: normalize to this year to keep a forward-looking countdown
      const year = new Date(now).getFullYear();
      const candidates = fixtureList.map((f) => {
        const c = new Date(f.date);
        c.setFullYear(year);
        // If the date this year has already passed, try next year
        if (c.getTime() < now) {
          c.setFullYear(year + 1);
        }
        return c.getTime();
      });
      
      const nextTs = candidates.reduce((min, ts) => (ts < min ? ts : min), Number.POSITIVE_INFINITY);
      return Number.isFinite(nextTs) ? new Date(nextTs) : null;
    }
  }, [currentMode]);

  // Calculate time remaining to target
  const getTimeToNextMatch = useCallback((): TimeToMatch => {
    if (!nextTarget) {
      if (DEBUG_GIOCA) {
        console.log('[DEBUG] getTimeToNextMatch: nextTarget is null');
      }
      return { days: 0, hours: 0, minutes: 0, seconds: 0 };
    }
    
    const now = Date.now();
    const diff = nextTarget.getTime() - now;
    
    if (DEBUG_GIOCA) {
      console.log('[DEBUG] Countdown calculation:', { 
        nextTarget: nextTarget.toISOString(), 
        now: new Date(now).toISOString(), 
        diff 
      });
    }
    
    if (diff <= 0) {
      if (DEBUG_GIOCA) {
        console.log('[DEBUG] Target date has passed, showing zeros');
      }
      return { days: 0, hours: 0, minutes: 0, seconds: 0 };
    }
    
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);
    
    if (DEBUG_GIOCA) {
      console.log('[DEBUG] Countdown result:', { days, hours, minutes, seconds });
    }
    
    return { days, hours, minutes, seconds };
  }, [nextTarget]);

  // Recompute next target whenever fixtures change
  useEffect(() => {
    if (fixtures.length > 0) {
      const computed = computeNextTarget(fixtures);
      setNextTarget(computed);
    }
  }, [fixtures, computeNextTarget]);

  // Update countdown every second
  useEffect(() => {
    const timer = setInterval(() => {
      setTimeToMatch(getTimeToNextMatch());
    }, GAME_CONFIG.COUNTDOWN_INTERVAL);
    
    return () => clearInterval(timer);
  }, [getTimeToNextMatch]);

  // Periodically recompute target to handle date changes
  useEffect(() => {
    const interval = setInterval(() => {
      if (fixtures.length > 0) {
        const computed = computeNextTarget(fixtures);
        setNextTarget(current => {
          if (computed !== null || current === null) {
            return computed;
          }
          return current; // Keep existing synthetic target
        });
      }
    }, GAME_CONFIG.TARGET_RECOMPUTE_INTERVAL);
    
    return () => clearInterval(interval);
  }, [fixtures, computeNextTarget]);

  return {
    nextTarget,
    timeToMatch,
    setNextTarget,
  };
}