/**
 * useGameState Hook
 * Manages overall game state including modals, completion status, and UI state
 */

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useGameMode } from "@/src/contexts/GameModeContext";
import { useAuthContext } from "@/src/contexts/AuthContext";
import { apiClient } from "@/lib/api-client";

import type { 
  GameMode, 
  UserMissingModalState,
  Fixture,
} from '../types';
import { 
  DEBUG_GIOCA, 
  MISSED_WEEK_GATING, 
  TERMINAL_WEEK, 
  STORAGE_KEYS,
} from '../utils/constants';

interface UseGameStateParams {
  fixtures: Fixture[];
  predictionsCount: number;
  isComplete: boolean;
}

interface UseGameStateReturn {
  // Core game state
  currentMode: GameMode;
  selectedWeek: number;
  currentFixtureIndex: number;
  setCurrentFixtureIndex: (index: number) => void;
  
  // User state
  userKey: string | null;
  setUserKey: (key: string | null) => void;
  
  // Modal states
  missedWeekModalOpen: boolean;
  setMissedWeekModalOpen: (open: boolean) => void;
  testingModalOpen: boolean;
  setTestingModalOpen: (open: boolean) => void;
  userMissingModal: UserMissingModalState;
  setUserMissingModal: (modal: UserMissingModalState) => void;
  
  // Completion state
  weekComplete: boolean;
  setWeekComplete: (complete: boolean) => void;
  rolledWeek1Once: boolean;
  setRolledWeek1Once: (rolled: boolean) => void;
  
  // UI state
  toast: string | null;
  setToast: (toast: string | null) => void;
  isSkipAnimating: boolean;
  setIsSkipAnimating: (animating: boolean) => void;
  previewOnTop: boolean;
  setPreviewOnTop: (onTop: boolean) => void;
  completeHeaderH: number;
  setCompleteHeaderH: (height: number) => void;
  
  // Computed state
  canShowVeil: boolean;
}

export function useGameState({
  fixtures,
  predictionsCount,
  isComplete,
}: UseGameStateParams): UseGameStateReturn {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { mode, setMode } = useGameMode();
  const { firebaseUser } = useAuthContext();

  // Core game state
  const currentMode = ((searchParams?.get('mode') as 'live' | 'test' | null) ?? null) || mode;
  const selectedWeek = (() => {
    if (currentMode === 'live') {
      return 1; // For live mode, could be computed differently
    } else {
      const w = Number(searchParams?.get('week') ?? NaN);
      return Number.isFinite(w) && w >= 1 && w <= 38 ? w : 1;
    }
  })();

  // State variables
  const [currentFixtureIndex, setCurrentFixtureIndex] = useState(0);
  const [userKey, setUserKey] = useState<string | null>(null);
  const [missedWeekModalOpen, setMissedWeekModalOpen] = useState(false);
  const [testingModalOpen, setTestingModalOpen] = useState(false);
  const [userMissingModal, setUserMissingModal] = useState<UserMissingModalState>({ show: false });
  const [weekComplete, setWeekComplete] = useState(false);
  const [rolledWeek1Once, setRolledWeek1Once] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [isSkipAnimating, setIsSkipAnimating] = useState(false);
  const [previewOnTop, setPreviewOnTop] = useState(false);
  const [completeHeaderH, setCompleteHeaderH] = useState<number>(160);

  // Update context if mode changed via URL
  useEffect(() => {
    if (currentMode !== mode) {
      setMode(currentMode);
    }
  }, [currentMode, mode, setMode]);

  // Resolve Firebase user to backend user ID
  useEffect(() => {
    const resolveUser = async () => {
      if (!firebaseUser) {
        setUserKey(null);
        return;
      }
      
      try {
        const resp = await apiClient.getUserByFirebaseUid(firebaseUser.uid) as unknown as { 
          success?: boolean; 
          data?: { id?: string } 
        };
        
        if (resp?.success && resp?.data?.id) {
          setUserKey(resp.data.id);
          if (DEBUG_GIOCA) {
            console.log('[gioca] resolved user', { 
              uid: firebaseUser.uid, 
              backendId: resp.data.id 
            });
          }
        } else {
          console.warn('[gioca] user resolution failed', resp);
          setUserMissingModal({ show: true, triedUid: firebaseUser.uid });
        }
      } catch (error) {
        console.error('[gioca] user resolution error:', error);
        setUserMissingModal({ show: true, triedUid: firebaseUser.uid });
      }
    };

    resolveUser();
  }, [firebaseUser]);

  // Load rollover flag
  useEffect(() => {
    if (!userKey) return;
    try {
      const k = STORAGE_KEYS.WEEK1_ROLLOVER(userKey);
      setRolledWeek1Once(localStorage.getItem(k) === '1');
    } catch {}
  }, [userKey]);

  // Check for missed week modal
  const computeEarliestNormalized = useCallback((items: Fixture[]): Date | null => {
    if (!items || items.length === 0) return null;
    const now = Date.now();
    const year = new Date(now).getFullYear();
    const times = items.map((f) => {
      const c = new Date(f.date);
      c.setFullYear(year);
      return c.getTime();
    });
    const minTs = times.reduce((min, ts) => (ts < min ? ts : min), Number.POSITIVE_INFINITY);
    return Number.isFinite(minTs) ? new Date(minTs) : null;
  }, []);

  useEffect(() => {
    const checkMissedWeek = () => {
      if (currentMode === 'test') {
        if (fixtures.length === 0) return;
        const gatingApplies = MISSED_WEEK_GATING ? 
          (selectedWeek >= 1 && selectedWeek <= TERMINAL_WEEK) : 
          (selectedWeek === 1);
        if (!gatingApplies) return;
        const earliest = computeEarliestNormalized(fixtures);
        if (!earliest) return;
        if (Date.now() >= earliest.getTime()) {
          setMissedWeekModalOpen(true);
        }
      } else if (currentMode === 'live') {
        if (fixtures.length === 0) return;
        const now = Date.now();
        const hasStartedMatches = fixtures.some(f => new Date(f.date).getTime() <= now);
        if (hasStartedMatches) {
          // Could show live missed modal here
        }
      }
    };

    checkMissedWeek();
  }, [currentMode, selectedWeek, fixtures, computeEarliestNormalized]);

  // Reset week complete when mode/week changes
  useEffect(() => {
    if (currentMode !== 'test') return;
    setWeekComplete(false);
    if (DEBUG_GIOCA) {
      console.log('[gioca] reset weekComplete due to week/mode change', { 
        week: selectedWeek, 
        mode: currentMode 
      });
    }
  }, [selectedWeek, currentMode]);

  // Compute veil visibility
  const canShowVeil = (() => {
    if (currentMode === 'test') {
      if (weekComplete !== true) return false;
      if (selectedWeek === 1 && rolledWeek1Once) return false;
      if (selectedWeek === 2) {
        try {
          const k = STORAGE_KEYS.HAS_WEEK_PREDICTIONS(2, userKey || '');
          const hasAny = typeof window !== 'undefined' ? localStorage.getItem(k) === '1' : false;
          return hasAny;
        } catch { 
          return false; 
        }
      }
      return true;
    } else if (currentMode === 'live') {
      if (fixtures.length === 0) return false;
      const now = Date.now();
      const hasStartedMatches = fixtures.some(f => new Date(f.date).getTime() <= now);
      if (hasStartedMatches) {
        // Could check if user has live predictions
        return true;
      }
      return false;
    }
    return false;
  })();

  return {
    // Core game state
    currentMode,
    selectedWeek,
    currentFixtureIndex,
    setCurrentFixtureIndex,
    
    // User state
    userKey,
    setUserKey,
    
    // Modal states
    missedWeekModalOpen,
    setMissedWeekModalOpen,
    testingModalOpen,
    setTestingModalOpen,
    userMissingModal,
    setUserMissingModal,
    
    // Completion state
    weekComplete,
    setWeekComplete,
    rolledWeek1Once,
    setRolledWeek1Once,
    
    // UI state
    toast,
    setToast,
    isSkipAnimating,
    setIsSkipAnimating,
    previewOnTop,
    setPreviewOnTop,
    completeHeaderH,
    setCompleteHeaderH,
    
    // Computed state
    canShowVeil,
  };
}