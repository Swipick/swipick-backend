/**
 * usePredictions Hook
 * Manages prediction state, persistence, and submission logic
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { apiClient } from "@/lib/api-client";

import type { 
  PredictionRecord, 
  GiocaPersistState, 
  Fixture, 
  GameMode 
} from '../types';
import { DEBUG_GIOCA, STORAGE_KEYS } from '../utils/constants';

interface UsePredictionsParams {
  currentMode: GameMode;
  selectedWeek: number | null; // live mode can pass null
  userKey: string | null;
  fixtures: Fixture[];
}

interface UsePredictionsReturn {
  predictions: PredictionRecord;
  setPredictions: (predictions: PredictionRecord) => void;
  handlePrediction: (fixtureId: number, choice: '1' | 'X' | '2') => Promise<void>;
  predictionsCount: number;
  isComplete: boolean;
  localComplete: boolean;
  setLocalComplete: (complete: boolean) => void;
}

export function usePredictions({
  currentMode,
  selectedWeek,
  userKey,
  fixtures,
}: UsePredictionsParams): UsePredictionsReturn {
  const [predictions, setPredictions] = useState<PredictionRecord>({});
  const [localComplete, setLocalComplete] = useState(false);
  const readyToPersistRef = useRef<boolean>(false);

  // Generate persistence key
  const persistKey = useCallback((): string => {
    const modeKey = currentMode;
    const weekKey = selectedWeek ?? 0; // 0 = auto/live-no-week
    const user = userKey ?? 'anon';
    return STORAGE_KEYS.PERSISTENCE_STATE(modeKey, weekKey, user);
  }, [currentMode, selectedWeek, userKey]);

  // Safe localStorage operations
  const safeReadState = useCallback((): GiocaPersistState | null => {
    try {
      if (typeof window === 'undefined') return null;
      const raw = localStorage.getItem(persistKey());
      if (!raw) return null;
      const parsed = JSON.parse(raw) as Partial<GiocaPersistState> | null;
      if (!parsed || parsed.v !== 1) return null;
      if (!Array.isArray(parsed.deck)) return null;
      if (typeof parsed.lastIndex !== 'number') return null;
      if (!parsed.predictions || typeof parsed.predictions !== 'object') return null;
      return { 
        v: 1, 
        lastIndex: parsed.lastIndex, 
        predictions: parsed.predictions as PredictionRecord, 
        deck: parsed.deck as number[] 
      };
    } catch { 
      return null; 
    }
  }, [persistKey]);

  const safeWriteState = useCallback((state: GiocaPersistState) => {
    try {
      if (typeof window === 'undefined') return;
      localStorage.setItem(persistKey(), JSON.stringify(state));
    } catch {}
  }, [persistKey]);

  // Handle prediction submission
  const handlePrediction = useCallback(async (fixtureId: number, choice: '1' | 'X' | '2') => {
    if (DEBUG_GIOCA) {
      console.log('[gioca] handlePrediction called', { fixtureId, choice, mode: currentMode });
    }

    // Optimistic UI update
    const newPredictions = { ...predictions, [fixtureId]: choice };
    setPredictions(newPredictions);

    // Check if this completes all predictions
    const completedCount = Object.keys(newPredictions).length;
    const nowComplete = completedCount >= 10; // Using hardcoded value for now, could use GAME_CONFIG.TOTAL_PREDICTIONS
    
    if (nowComplete) {
      setLocalComplete(true);
    }

    // Submit to backend if we have a user
    if (userKey && currentMode === 'test') {
      try {
        await apiClient.createTestPrediction({
          userId: userKey,
          fixtureId,
          choice,
        });
        
        if (DEBUG_GIOCA) {
          console.log('[gioca] prediction submitted successfully', { fixtureId, choice });
        }
      } catch (error) {
        console.error('[gioca] prediction submission failed:', error);
        // Could implement retry logic or revert optimistic update here
      }
    }
  }, [predictions, userKey, currentMode]);

  // Persist state to localStorage
  useEffect(() => {
    try {
      if (!readyToPersistRef.current) return;
      if (!fixtures.length) return;
      const deck = fixtures.map((f) => f.id);
      const idx = 0; // Could be current index if needed
      const state = { v: 1 as const, lastIndex: idx, predictions, deck };
      safeWriteState(state);
    } catch {}
  }, [fixtures, predictions, safeWriteState]);

  // Load persisted state on mount
  useEffect(() => {
    const saved = safeReadState();
    if (saved?.predictions) {
      setPredictions(saved.predictions);
      if (DEBUG_GIOCA) {
        console.log('[gioca] loaded persisted predictions', { 
          count: Object.keys(saved.predictions).length,
          week: selectedWeek 
        });
      }
    }
    readyToPersistRef.current = true;
  }, [safeReadState, selectedWeek]);

  // Calculate derived state
  const predictionsCount = Object.keys(predictions).length;
  const isComplete = localComplete || predictionsCount >= 10; // Could use GAME_CONFIG.TOTAL_PREDICTIONS

  return {
    predictions,
    setPredictions,
    handlePrediction,
    predictionsCount,
    isComplete,
    localComplete,
    setLocalComplete,
  };
}
