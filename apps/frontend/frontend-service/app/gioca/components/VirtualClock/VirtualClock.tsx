/**
 * VirtualClock Component
 * Simulates time progression from a fixed start date (September 9, 2023 13:35)
 * Includes fast-forward capability for testing and week transitions
 */

'use client';

import React, { useState, useEffect, useCallback } from 'react';

// Virtual clock configuration
const VIRTUAL_START_DATE = new Date('2023-08-18T13:35:00.000Z');
const STORAGE_KEY = 'swipick:virtual-clock:reference';

interface VirtualClockState {
  realStartTime: number;
  fastForwardOffset: number; // Additional time offset for fast-forward
}

interface VirtualClockProps {
  onTimeUpdate?: (virtualTime: Date) => void;
  showControls?: boolean; // Show fast-forward controls
  className?: string;
}

interface VirtualClockReturn {
  virtualTime: Date;
  fastForwardToNextWeek: () => void;
  resetClock: () => void;
  formatDisplay: () => string;
}

export function useVirtualClock(): VirtualClockReturn {
  const [state, setState] = useState<VirtualClockState>(() => {
    // Initialize from localStorage or create new with consistent start time
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          return JSON.parse(stored);
        }
      } catch (error) {
        console.warn('Failed to load virtual clock state:', error);
      }
    }

    // Create default state and immediately save it to localStorage for consistency
    const defaultState = {
      realStartTime: Date.now(),
      fastForwardOffset: 0,
    };

    // Save to localStorage immediately to ensure consistency across components
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(defaultState));
      } catch (error) {
        console.warn('Failed to save initial virtual clock state:', error);
      }
    }

    return defaultState;
  });

  const [virtualTime, setVirtualTime] = useState<Date>(new Date());

  // Calculate current virtual time
  const calculateVirtualTime = useCallback((): Date => {
    const now = Date.now();
    const realElapsed = now - state.realStartTime;
    const totalOffset = realElapsed + state.fastForwardOffset;
    return new Date(VIRTUAL_START_DATE.getTime() + totalOffset);
  }, [state]);

  // Update virtual time every 10 seconds to reduce excessive recalculations
  useEffect(() => {
    const updateTime = () => {
      setVirtualTime(calculateVirtualTime());
    };

    updateTime(); // Initial update
    const interval = setInterval(updateTime, 10000); // Changed from 1000ms to 10000ms

    return () => clearInterval(interval);
  }, [calculateVirtualTime]);

  // Persist state to localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      } catch (error) {
        console.warn('Failed to save virtual clock state:', error);
      }
    }
  }, [state]);

  // Fast forward to next week (7 days)
  const fastForwardToNextWeek = useCallback(() => {
    const oneWeekMs = 7 * 24 * 60 * 60 * 1000;
    setState(prev => ({
      ...prev,
      fastForwardOffset: prev.fastForwardOffset + oneWeekMs,
    }));
  }, []);

  // Reset clock to original start time
  const resetClock = useCallback(() => {
    setState({
      realStartTime: Date.now(),
      fastForwardOffset: 0,
    });
  }, []);

  // Format virtual time for display
  const formatDisplay = useCallback((): string => {
    return virtualTime.toLocaleDateString('it-IT', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      timeZone: 'Europe/Rome'
    }) + ' [' + virtualTime.toLocaleTimeString('it-IT', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      timeZone: 'Europe/Rome'
    }) + ']';
  }, [virtualTime]);

  return {
    virtualTime,
    fastForwardToNextWeek,
    resetClock,
    formatDisplay,
  };
}

export function VirtualClock({
  onTimeUpdate,
  showControls = false,
  className = ''
}: VirtualClockProps) {
  const { virtualTime, fastForwardToNextWeek, resetClock, formatDisplay } = useVirtualClock();

  // Notify parent of time updates
  useEffect(() => {
    onTimeUpdate?.(virtualTime);
  }, [virtualTime, onTimeUpdate]);

  if (!showControls) {
    // Just display the time
    return (
      <div className={`text-xs text-white/80 ${className}`}>
        📅 Data simulata: {formatDisplay()}
      </div>
    );
  }

  // Display with controls
  return (
    <div className={`${className}`}>
      <div className="text-xs text-white/80 mb-2">
        📅 Data simulata: {formatDisplay()}
      </div>

      {showControls && (
        <div className="flex gap-2">
          <button
            onClick={fastForwardToNextWeek}
            className="inline-flex items-center px-2 py-1 text-xs bg-blue-500/80 hover:bg-blue-600/80 rounded-full transition-colors"
            title="Avanza di una settimana"
          >
            <svg className="-ml-0.5 mr-1 h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 9l3 3-3 3m-6 0l3-3-3-3" />
            </svg>
            +1 Settimana
          </button>

          <button
            onClick={resetClock}
            className="inline-flex items-center px-2 py-1 text-xs bg-gray-500/80 hover:bg-gray-600/80 rounded-full transition-colors"
            title="Reset al tempo iniziale"
          >
            <svg className="-ml-0.5 mr-1 h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 1v6m0 0l4-4m-4 4L8 3m8 8a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Reset
          </button>
        </div>
      )}
    </div>
  );
}

export default VirtualClock;