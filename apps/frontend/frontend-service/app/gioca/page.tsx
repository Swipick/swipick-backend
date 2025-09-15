'use client';

import { useState, useCallback, Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from 'next/navigation';
import { useMotionValue, useTransform, PanInfo, animate } from 'framer-motion';
import { Toast } from '@/src/components/Toast';
import { useGameMode } from "@/src/contexts/GameModeContext";
import { apiClient } from "@/lib/api-client";

// Hooks
import { useFixtures } from './hooks/useFixtures';
import { usePredictions } from './hooks/usePredictions';
import { useCountdown } from './hooks/useCountdown';

// Components
import {
  GameHeader,
  MatchCard,
  BottomNav,
} from './components';

// Types and constants
import type { PredictionChoice } from './types';
import { ANIMATION_CONFIG } from './utils/constants';

function GiocaPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  // Game state management (simplified for this demo)
  const { mode } = useGameMode();
  
  // Get mode from URL parameters or context
  const currentMode = ((searchParams?.get('mode') as 'live' | 'test' | null) ?? null) || mode;
  
  // Live week state  
  const [currentLiveWeek] = useState<number | null>(null);
  
  // Selected week logic
  const selectedWeek = (() => {
    if (currentMode === 'live') {
      // In live mode, if no specific week is set, let useFixtures find the active week
      const urlWeek = Number(searchParams?.get('week') ?? NaN);
      if (Number.isFinite(urlWeek) && urlWeek >= 1 && urlWeek <= 38) {
        return urlWeek; // Use URL week if valid
      }
      return currentLiveWeek || null; // Let useFixtures auto-find the week
    } else {
      const w = Number(searchParams?.get('week') ?? NaN);
      return Number.isFinite(w) && w >= 1 && w <= 38 ? w : 1;
    }
  })();
  
  // UI state
  const [userKey, setUserKey] = useState<string | null>(null);
  const [weekComplete, setWeekComplete] = useState(false);
  const [rolledWeek1Once, setRolledWeek1Once] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // Helper function to generate week prediction keys (from original)
  const hasWeekPredsKey = useCallback((week: number, userId: string | null): string => {
    const user = userId ?? 'anon';
    return `swipick:gioca:hasWeekPreds:test:week${week}:user:${user}`;
  }, []);
  
  // Navigation handlers
  const handleGoToResults = useCallback(() => {
    router.push('/risultati?mode=' + currentMode);
  }, [router, currentMode]);
  
  const handleGoToProfile = useCallback(() => {
    router.push('/profilo');
  }, [router]);
  
  // Fixtures and match cards
  const {
    fixtures,
    matchCards,
    loading,
    error,
  } = useFixtures({ currentMode, selectedWeek, userKey, currentLiveWeek });
  
  // Predictions management
  const {
    predictions,
    handlePrediction,
    predictionsCount,
    isComplete,
  } = usePredictions({ currentMode, selectedWeek, userKey, fixtures });
  
  // Countdown timer
  const {
    timeToMatch,
  } = useCountdown({ currentMode, fixtures });

  // Check if selected week is already fully predicted (Test Mode) and set veil - EXACT ORIGINAL LOGIC
  useEffect(() => {
    const checkWeekCompletion = async () => {
      if (currentMode !== 'test' || !userKey) {
        setWeekComplete(false);
        return;
      }

      try {
        // Check localStorage flag first - if this week has any predictions recorded
        const k = hasWeekPredsKey(selectedWeek, userKey);
        const hasAnyFlag = typeof window !== 'undefined' ? localStorage.getItem(k) === '1' : false;
        if (!hasAnyFlag) {
          setWeekComplete(false);
          return;
        }

        // Query backend for actual weekly completion status
        const weekly = await apiClient.getTestWeeklyStats(userKey, selectedWeek);
        const totalPreds = (() => {
          const r = weekly as unknown;
          if (r && typeof r === 'object') {
            const obj = r as Record<string, unknown>;
            if (typeof obj.totalPredictions === 'number') return obj.totalPredictions;
            if (typeof obj.total === 'number') return obj.total;
            if (Array.isArray(obj.predictions)) return obj.predictions.length;
          }
          return 0;
        })();

        setWeekComplete(totalPreds >= 10);
      } catch {
        // If weekly endpoint not available, fall back to no veil
        setWeekComplete(false);
      }
    };
    checkWeekCompletion();
  }, [currentMode, selectedWeek, userKey, hasWeekPredsKey]);

  // Ensure no veil appears for Week 2 until the user has at least one prediction there - EXACT ORIGINAL LOGIC
  useEffect(() => {
    if (currentMode !== 'test') return;
    if (selectedWeek !== 2) return;
    try {
      const k = hasWeekPredsKey(2, userKey);
      const hasAny = typeof window !== 'undefined' ? localStorage.getItem(k) === '1' : false;
      if (!hasAny) {
        setWeekComplete(false);
      }
    } catch {
      setWeekComplete(false);
    }
  }, [currentMode, selectedWeek, userKey, hasWeekPredsKey]);

  // Card navigation state
  const [currentFixtureIndex, setCurrentFixtureIndex] = useState(0);
  const [isSkipAnimating, setIsSkipAnimating] = useState(false);
  const [previewOnTop, setPreviewOnTop] = useState(false);

  // Animation controls
  const cardX = useMotionValue(0);
  const cardY = useTransform(cardX, [-320, 0, 320], [-24, 0, 24]);
  const cardRotate = useTransform(cardX, [-320, 0, 320], [-10, 0, 10]);

  // Current fixture data
  const currentFixture = fixtures[currentFixtureIndex];
  const currentMatchCard = matchCards.find(mc => mc.fixtureId === currentFixture?.id);
  const currentPrediction = currentFixture ? predictions[currentFixture.id] : undefined;

  // Navigation handlers
  const handleNext = useCallback(() => {
    if (currentFixtureIndex < fixtures.length - 1) {
      setCurrentFixtureIndex(prev => prev + 1);
      cardX.set(0);
    }
  }, [currentFixtureIndex, fixtures.length, cardX]);

  const handlePrev = useCallback(() => {
    if (currentFixtureIndex > 0) {
      setCurrentFixtureIndex(prev => prev - 1);
      cardX.set(0);
    }
  }, [currentFixtureIndex, cardX]);

  // Prediction handling (moved above drag handler to avoid TDZ issues)
  const handleCardPrediction = useCallback(async (fixtureId: number, choice: PredictionChoice) => {
    await handlePrediction(fixtureId, choice);
    
    // Mark that the user has at least one prediction for this week (to enable weekly-stats checks later) - ORIGINAL LOGIC
    if (currentMode === 'test' && userKey) {
      try {
        const k = hasWeekPredsKey(selectedWeek, userKey);
        localStorage.setItem(k, '1');
      } catch {}
    }
    
    // Auto-advance to next card after prediction
    setTimeout(() => {
      if (currentFixtureIndex < fixtures.length - 1) {
        handleNext();
      }
    }, 500);
  }, [handlePrediction, currentFixtureIndex, fixtures.length, handleNext, currentMode, userKey, selectedWeek, hasWeekPredsKey]);

  // Swipe handling
  const handleDragEnd = useCallback((_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    const { offset, velocity } = info;
    const dx = offset.x;
    const dy = offset.y;
    const ax = Math.abs(dx);
    const ay = Math.abs(dy);
    const vx = Math.abs(velocity.x || 0);
    const vy = velocity.y || 0;
    const threshold = ANIMATION_CONFIG.SWIPE_THRESHOLD;

    // Determine primary swipe direction and map to a choice
    let choice: PredictionChoice | null = null;
    if (ax >= ay) {
      // Horizontal swipe dominates → Left= '1', Right= '2'
      if (ax > threshold || vx > 500) {
        choice = dx < 0 ? '1' : '2';
      }
    } else {
      // Vertical swipe dominates → Up = 'X' only
      if (dy < -threshold || vy < -500) {
        choice = 'X';
      }
    }

    if (choice && currentFixture) {
      // Animate off-screen for horizontal swipes; up can just commit
      const distance = 350;
      if (choice === '1') {
        // Left
        void animate(cardX, -distance, { type: 'tween', ease: 'easeOut', duration: 0.4 }).finished.then(() => {
          cardX.set(0);
        });
      } else if (choice === '2') {
        // Right
        void animate(cardX, distance, { type: 'tween', ease: 'easeOut', duration: 0.4 }).finished.then(() => {
          cardX.set(0);
        });
      } else {
        // Up → keep position; snap back after commit below
      }

      // Commit prediction and auto-advance per existing logic
      void handleCardPrediction(currentFixture.id, choice);
    } else {
      // Not enough movement → snap back
      animate(cardX, 0, { type: 'spring', stiffness: 300, damping: 30 });
    }
  }, [cardX, currentFixture, handleCardPrediction]);

  // Skip animation
  const handleSkip = useCallback(async () => {
    if (isSkipAnimating) return;
    setIsSkipAnimating(true);
    setPreviewOnTop(true);
    try {
      // Directly advance without separate control-based animation
      handleNext();
    } finally {
      setIsSkipAnimating(false);
      setPreviewOnTop(false);
    }
  }, [isSkipAnimating, handleNext]);

  // (definition moved above)

  // Button styles for diamond layout
  const buttonStyle: React.CSSProperties = {
    background: 'radial-gradient(circle at center, #554099, #3d2d73)',
    boxShadow: '0 8px 16px rgba(85, 64, 153, 0.3), 0 4px 8px rgba(0, 0, 0, 0.2)',
  };
  
  const skipStyle: React.CSSProperties = {
    background: '#ffffff',
    boxShadow: '0 8px 16px rgba(85, 64, 153, 0.2), 0 4px 8px rgba(0, 0, 0, 0.1)',
    border: '1px solid rgba(85, 64, 153, 0.2)',
  };

  // Animation function for diamond buttons
  const animateAndCommit = useCallback(async (direction: 'up' | 'down' | 'left' | 'right') => {
    if (!currentFixture) return;
    
    const distance = 350;
    
    if (direction === 'down') {
      // Skip animation
      handleSkip();
      return;
    }
    
    // Animate horizontal swipe using the MotionValue to keep a single source of truth
    const targetX = direction === 'left' ? -distance : direction === 'right' ? distance : 0;
    if (targetX !== 0) {
      await animate(cardX, targetX, { type: 'tween', ease: 'easeOut', duration: 0.56 }).finished;
      // Reset immediately for the next card
      cardX.set(0);
    }
    
    // Handle prediction based on direction
    if (direction === 'up') {
      await handleCardPrediction(currentFixture.id, 'X');
    } else if (direction === 'left') {
      await handleCardPrediction(currentFixture.id, '1');
    } else if (direction === 'right') {
      await handleCardPrediction(currentFixture.id, '2');
    }
  }, [currentFixture, handleSkip, cardX, handleCardPrediction]);

  // Decide if the completion veil should be displayed for the current context - EXACT ORIGINAL LOGIC
  const canShowVeil = (() => {
    if (currentMode === 'test') {
      if (weekComplete !== true) return false;
      if (selectedWeek === 1 && rolledWeek1Once) return false;
      if (selectedWeek === 2) {
        try {
          const k = hasWeekPredsKey(2, userKey);
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
      const upcomingMatches = fixtures.filter(f => new Date(f.date).getTime() > now);
      if (upcomingMatches.length > 0) return false;
      return false;
    }
    return false;
  })();

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Caricamento partite...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center p-6">
          <p className="text-red-600 mb-4">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
          >
            Riprova
          </button>
        </div>
      </div>
    );
  }

  // No fixtures state
  if (fixtures.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center p-6">
          <p className="text-gray-600 mb-4">Nessuna partita disponibile per questa settimana.</p>
          <BottomNav
            currentMode={currentMode}
            selectedWeek={selectedWeek}
            onNavigateToResults={handleGoToResults}
            onNavigateToProfile={handleGoToProfile}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <GameHeader
        currentMode={currentMode}
        selectedWeek={selectedWeek}
        predictionsCount={predictionsCount}
        timeToMatch={timeToMatch}
        fixtures={fixtures}
      />

      {/* Main Content */}
      <div className="flex-1 relative overflow-hidden px-4">
        {/* Card Stack Container */}
        <div className="relative h-full flex items-start justify-center pt-8">
          {/* Preview Card (next card) */}
          {currentFixtureIndex < fixtures.length - 1 && (
            <div 
              className={`absolute top-0 left-0 right-0 flex items-start justify-center pt-8 ${previewOnTop ? 'z-20' : 'z-10'} pointer-events-none`}
            >
              <div className="w-full max-w-sm transform scale-95 opacity-60">
                <MatchCard
                  fixture={fixtures[currentFixtureIndex + 1]}
                  matchCard={matchCards.find(mc => mc.fixtureId === fixtures[currentFixtureIndex + 1]?.id)}
                  onPrediction={handleCardPrediction}
                  currentPrediction={predictions[fixtures[currentFixtureIndex + 1]?.id]}
                  disabled={true}
                />
              </div>
            </div>
          )}

          {/* Current Card */}
          <div className={`absolute top-0 left-0 right-0 flex items-start justify-center pt-8 ${previewOnTop ? 'z-10' : 'z-20'}`}>
            <div className="w-full max-w-sm">
              <MatchCard
                fixture={currentFixture}
                matchCard={currentMatchCard}
                onPrediction={handleCardPrediction}
                currentPrediction={currentPrediction}
                disabled={canShowVeil}
                dragProps={{
                  drag: true,
                  dragElastic: 0.2,
                  onDragEnd: handleDragEnd,
                }}
                style={{
                  x: cardX,
                  y: cardY,
                  rotate: cardRotate,
                }}
              />
            </div>
          </div>
        </div>

      </div>

      {/* Prediction Buttons - Diamond Layout (in-flow; scrolls with content) */}
      {!canShowVeil && currentFixture && (
        <div className="relative left-0 right-0 px-4 mt-3 mb-6">
          <div className="flex justify-center">
            <div className="grid grid-cols-3 gap-x-4 gap-y-0 justify-items-center items-center max-w-[340px] w-full mx-auto">
              {/* Top: X */}
              <div className="col-start-2">
                <button
                  onClick={() => animateAndCommit('up')}
                  disabled={canShowVeil || isSkipAnimating}
                  className={`relative w-16 text-center text-white text-sm font-bold py-2.5 px-4 rounded-md shadow-lg transition-all duration-200 hover:scale-105 ${
                    currentPrediction === 'X' ? 'scale-105' : ''
                  }`}
                  style={buttonStyle}
                >
                  X
                </button>
              </div>
              
              {/* Middle Left: 1 */}
              <div className="col-start-1 row-start-2">
                <button
                  onClick={() => animateAndCommit('left')}
                  disabled={canShowVeil || isSkipAnimating}
                  className={`relative w-16 text-center text-white text-sm font-bold py-2.5 px-4 rounded-md shadow-lg transition-all duration-200 hover:scale-105 ${
                    currentPrediction === '1' ? 'scale-105' : ''
                  }`}
                  style={buttonStyle}
                >
                  1
                </button>
              </div>
              
              {/* Middle Right: 2 */}
              <div className="col-start-3 row-start-2">
                <button
                  onClick={() => animateAndCommit('right')}
                  disabled={canShowVeil || isSkipAnimating}
                  className={`relative w-16 text-center text-white text-sm font-bold py-2.5 px-4 rounded-md shadow-lg transition-all duration-200 hover:scale-105 ${
                    currentPrediction === '2' ? 'scale-105' : ''
                  }`}
                  style={buttonStyle}
                >
                  2
                </button>
              </div>
              
              {/* Bottom: Skip */}
              <div className="col-start-2 row-start-3 -mt-2">
                <button
                  onClick={() => animateAndCommit('down')}
                  disabled={canShowVeil}
                  className="relative w-16 text-center bg-white text-[#3d2d73] text-sm font-bold py-2.5 px-4 rounded-md shadow-lg transition-all duration-200 hover:scale-105 disabled:opacity-60"
                  style={skipStyle}
                >
                  skip
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* spacer to avoid overlap with bottom nav on short screens */}
      <div aria-hidden className="w-full" style={{ height: 'calc(env(safe-area-inset-bottom) + 64px)' }} />

      {/* Bottom Navigation */}
      <BottomNav
        currentMode={currentMode}
        selectedWeek={selectedWeek}
        onNavigateToResults={handleGoToResults}
        onNavigateToProfile={handleGoToProfile}
      />

      {/* Veil when week is completed (Test Mode). Hidden for Week 1 once rollover occurred, to avoid blocking UI when user navigates back. */}
      {canShowVeil && (
        <div className="fixed inset-0 z-50 pointer-events-none">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" />
          <div className="fixed top-[calc(env(safe-area-inset-top)+12px)] left-1/2 -translate-x-1/2 w-[88%] max-w-md pointer-events-auto">
            <div className="bg-white rounded-2xl shadow-2xl p-6 text-center">
              <h3 className="text-xl font-semibold text-black mb-2">Giornata completata</h3>
              <p className="text-sm text-gray-700 mb-5">Hai già effettuato 10 scelte per questa settimana. Vai alla pagina Risultati per rivelare e vedere l&apos;andamento.</p>
              <div className="flex gap-3 justify-center">
                <button
                  onClick={() => router.push(`/risultati?mode=${currentMode}&week=${selectedWeek}`)}
                  className="px-5 py-2 rounded-md bg-purple-600 text-white font-medium hover:bg-purple-700"
                >
                  Vai a Risultati
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <Toast
          message={toast}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
}

export default function GiocaPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
        </div>
      }
    >
      <GiocaPageContent />
    </Suspense>
  );
}
