'use client';

import React, { useState, useCallback, Suspense, useEffect, useMemo } from "react";
import { useRouter, useSearchParams } from 'next/navigation';
import { useMotionValue, useTransform, PanInfo, animate, MotionValue } from 'framer-motion';
import { Toast } from '@/src/components/Toast';
import { useGameMode } from "@/src/contexts/GameModeContext";
import { apiClient } from "@/lib/api-client";

// Hooks
import { useFixtures } from './hooks/useFixtures';
import { usePredictions } from './hooks/usePredictions';
import { useCountdown } from './hooks/useCountdown';
import { useLiveWeek } from './hooks/useLiveWeek';

// Components
import {
  GameHeader,
  TestGameHeader,
  MatchCard,
  BottomNav,
  PredictionButtons,
  GameSummaryScreen,
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

  // Get reliable live week data (live mode only)
  const { liveWeekData, loading: liveWeekLoading, error: liveWeekError } = useLiveWeek({ mode: currentMode });

  // Selected week logic - reliable, no fallbacks
  const selectedWeek = useMemo(() => {
    if (currentMode === 'live') {
      // Live mode: use URL parameter if valid, otherwise use reliable database week
      const urlWeek = Number(searchParams?.get('week') ?? NaN);
      if (Number.isFinite(urlWeek) && urlWeek >= 1 && urlWeek <= 38) {
        console.log('[page] Using URL week:', urlWeek);
        return urlWeek; // Use URL week if valid
      }

      // Use reliable current week from database
      if (liveWeekData?.currentWeek) {
        console.log('[page] Using live week from database:', liveWeekData.currentWeek);
        return liveWeekData.currentWeek;
      }

      // If no reliable data available, return null (will cause error in useFixtures)
      console.log('[page] No live week data available yet, returning null');
      return null;
    } else {
      // Test mode logic unchanged
      const w = Number(searchParams?.get('week') ?? NaN);
      return Number.isFinite(w) && w >= 1 && w <= 38 ? w : 1;
    }
  }, [currentMode, searchParams, liveWeekData]);
  
  // UI state
  const [userKey, setUserKey] = useState<string | null>(null);
  const [weekComplete, setWeekComplete] = useState(false);
  const [rolledWeek1Once, setRolledWeek1Once] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // Helper function to generate week prediction keys (from original)
  const hasWeekPredsKey = useCallback((week: number | null, userId: string | null): string => {
    const user = userId ?? 'anon';
    const w = week ?? 0;
    return `swipick:gioca:hasWeekPreds:test:week${w}:user:${user}`;
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
  } = useFixtures({ currentMode, selectedWeek, userKey, currentLiveWeek: null });

  // Predictions management
  const {
    predictions,
    handlePrediction,
    predictionsCount,
    isComplete,
    resetPredictions,
  } = usePredictions({ currentMode, selectedWeek, userKey, fixtures });

  // Summary screen state
  const [showSummaryScreen, setShowSummaryScreen] = useState(false);
  const [headerHeight, setHeaderHeight] = useState<number>(160);

  // Handle game completion and show summary screen
  useEffect(() => {
    if (isComplete && currentMode === 'live' && fixtures.length > 0 && !showSummaryScreen) {
      // Small delay to allow last animation to complete
      const timer = setTimeout(() => {
        setShowSummaryScreen(true);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [isComplete, currentMode, fixtures.length, showSummaryScreen]);

  // Countdown timer
  const {
    timeToMatch,
  } = useCountdown({ currentMode, fixtures });

  // Check if selected week is already fully predicted (Test Mode) and set veil - EXACT ORIGINAL LOGIC
  useEffect(() => {
    const checkWeekCompletion = async () => {
      if (currentMode !== 'test' || !userKey || selectedWeek == null) {
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
  const [frozenPreviewIndex, setFrozenPreviewIndex] = useState<number | null>(null);
  const [cardZIndex, setCardZIndex] = useState<'normal' | 'above-buttons' | 'below-deck'>('normal');
  const cardOpacity = useMotionValue(1);

  // Skip card management - track skipped cards to loop back to them
  const [skippedCardIndexes, setSkippedCardIndexes] = useState<number[]>([]);
  const [isInSkippedMode, setIsInSkippedMode] = useState(false);
  const [isTransitioningToSkipped, setIsTransitioningToSkipped] = useState(false);
  const [previewCardOpacity, setPreviewCardOpacity] = useState(1);

  // Animation controls
  const cardX = useMotionValue(0);
  const cardY = useMotionValue(0);
  const cardRotate = useTransform(cardX, [-320, 0, 320], [-10, 0, 10]);

  // Summary screen handlers (defined after motion values are available)
  const handlePlayAgain = useCallback(() => {
    // Reset all game state
    resetPredictions();
    setCurrentFixtureIndex(0);
    setShowSummaryScreen(false);
    cardX.set(0);
    cardY.set(0);
    cardOpacity.set(1);
    setCardZIndex('normal');
    setIsSkipAnimating(false);
    setPreviewOnTop(false);
    setFrozenPreviewIndex(null);
    // Reset skip card management
    setSkippedCardIndexes([]);
    setIsInSkippedMode(false);
    setIsTransitioningToSkipped(false);
    setPreviewCardOpacity(1);
  }, [resetPredictions, cardX, cardY, cardOpacity]);

  const handleViewResults = useCallback(() => {
    setShowSummaryScreen(false);
    router.push(`/risultati?mode=${currentMode}`);
  }, [router, currentMode]);

  // Current fixture data
  const currentFixture = fixtures[currentFixtureIndex];
  const currentMatchCard = matchCards.find(mc => mc.fixtureId === currentFixture?.id);
  const currentPrediction = currentFixture ? predictions[currentFixture.id] : undefined;

  // Prediction handling (moved above preview card to avoid TDZ issues)
  const handleCardPrediction = useCallback(async (fixtureId: number, choice: PredictionChoice) => {
    await handlePrediction(fixtureId, choice);

    // Mark that the user has at least one prediction for this week (to enable weekly-stats checks later) - ORIGINAL LOGIC
    if (currentMode === 'test' && userKey) {
      try {
        const k = hasWeekPredsKey(selectedWeek, userKey);
        localStorage.setItem(k, '1');
      } catch {}
    }

    // Note: Auto-advance removed to avoid circular dependency - handled elsewhere
  }, [handlePrediction, currentMode, userKey, selectedWeek, hasWeekPredsKey]);

  // Preview card calculation - memoized to prevent flash re-renders
  const previewCard = React.useMemo(() => {
    // Calculate next card index more deterministically
    let nextCardIndex: number | null = null;

    if (isInSkippedMode) {
      // In skipped mode, show next skipped card
      const currentPos = skippedCardIndexes.indexOf(currentFixtureIndex);
      if (currentPos >= 0) {
        if (currentPos < skippedCardIndexes.length - 1) {
          nextCardIndex = skippedCardIndexes[currentPos + 1];
        } else if (skippedCardIndexes.length > 1) {
          nextCardIndex = skippedCardIndexes[0]; // Loop back
        }
      }
    } else {
      // Normal mode - show natural next card
      if (currentFixtureIndex < fixtures.length - 1) {
        nextCardIndex = currentFixtureIndex + 1;
      } else if (skippedCardIndexes.length > 0) {
        nextCardIndex = skippedCardIndexes[0]; // Show first skipped as preview
      }
    }

    // Use frozen preview only during actual animations and if it's still valid (ahead of current card)
    const displayIndex = (frozenPreviewIndex !== null && (isSkipAnimating || previewOnTop) && frozenPreviewIndex > currentFixtureIndex)
      ? frozenPreviewIndex
      : nextCardIndex;

    const previewFixture = displayIndex !== null ? fixtures[displayIndex] : null;

    return previewFixture ? (
      <div
        className={`absolute top-0 left-0 right-0 flex items-start justify-center ${previewOnTop ? 'z-20' : 'z-10'} pointer-events-none`}
      >
        <div className={`w-full max-w-sm transform scale-95 ${isSkipAnimating ? 'opacity-100' : 'opacity-60'}`}>
          <MatchCard
            key={`preview-${previewFixture.id}-${displayIndex}`}
            fixture={previewFixture}
            matchCard={matchCards.find(mc => mc.fixtureId === previewFixture.id)}
            onPrediction={handleCardPrediction}
            currentPrediction={predictions[previewFixture.id]}
            disabled={true}
          />
        </div>
      </div>
    ) : null;
  }, [currentFixtureIndex, skippedCardIndexes, isInSkippedMode, frozenPreviewIndex, isSkipAnimating, previewOnTop, fixtures, matchCards, predictions, handleCardPrediction]);

  // Navigation handlers
  const handleNext = useCallback(() => {
    if (isInSkippedMode) {
      // In skipped mode: cycle through skipped cards
      const currentSkippedIndex = skippedCardIndexes.indexOf(currentFixtureIndex);
      if (currentSkippedIndex < skippedCardIndexes.length - 1) {
        // Move to next skipped card
        setCurrentFixtureIndex(skippedCardIndexes[currentSkippedIndex + 1]);
      } else {
        // Loop back to first skipped card
        setCurrentFixtureIndex(skippedCardIndexes[0]);
      }
    } else {
      // Normal mode: advance through original fixtures
      if (currentFixtureIndex < fixtures.length - 1) {
        setCurrentFixtureIndex(prev => prev + 1);
      } else {
        // Reached end of original fixtures
        if (skippedCardIndexes.length > 0) {
          // Show transition loading state first
          setIsTransitioningToSkipped(true);
          // Brief delay for UX, then switch to skipped mode
          setTimeout(() => {
            setIsInSkippedMode(true);
            setCurrentFixtureIndex(skippedCardIndexes[0]);
            setIsTransitioningToSkipped(false);
          }, 0); // 500ms transition
        }
        // If no skipped cards, stay at last card (no more navigation)
      }
    }

    // Reset card state for next card
    cardX.set(0);
    cardY.set(0);
    cardOpacity.set(1);
    setCardZIndex('normal');

    // Clear preview states after navigation is complete
    setTimeout(() => {
      setFrozenPreviewIndex(null);
      setPreviewOnTop(false);
    }, 0);
  }, [currentFixtureIndex, fixtures.length, skippedCardIndexes, isInSkippedMode, cardX, cardY, cardOpacity]);

  const handlePrev = useCallback(() => {
    if (currentFixtureIndex > 0) {
      setCurrentFixtureIndex(prev => prev - 1);
      cardX.set(0);
      cardY.set(0);
      cardOpacity.set(1); // Ensure previous card is always visible
      setCardZIndex('normal'); // Reset z-index for previous card
    }
  }, [currentFixtureIndex, cardX, cardY, cardOpacity]);


  // Commit immediately (no delay) to avoid race with animations
  const commitPredictionImmediate = useCallback(async (fixtureId: number, choice: PredictionChoice) => {
    await handlePrediction(fixtureId, choice);
    if (currentMode === 'test' && userKey) {
      try {
        const k = hasWeekPredsKey(selectedWeek, userKey);
        localStorage.setItem(k, '1');
      } catch {}
    }
    handleNext();
  }, [handlePrediction, handleNext, currentMode, userKey, selectedWeek, hasWeekPredsKey]);

  // Swipe handling
  type MotionAnimateOptions = {
    type?: 'tween' | 'spring';
    ease?: 'linear' | 'easeIn' | 'easeOut' | 'easeInOut' | ((t: number) => number);
    duration?: number;
    stiffness?: number;
    damping?: number;
    onComplete?: () => void;
  };

  // Promise-based helper for MotionValue animations (type-safe, no .finished)
  const animateValue = useCallback(
    (axis: 'x' | 'y' | 'opacity', to: number, opts: MotionAnimateOptions = {}): Promise<void> => {
      return new Promise((resolve) => {
        const mv = axis === 'x' ? cardX : axis === 'y' ? cardY : cardOpacity;
        const anim = animate as unknown as (
          value: MotionValue<number>,
          to: number,
          options?: MotionAnimateOptions
        ) => { stop: () => void };
        anim(mv, to, {
          ...opts,
          onComplete: () => {
            if (typeof opts.onComplete === 'function') {
              try { (opts.onComplete as () => void)(); } catch {}
            }
            resolve();
          },
        });
      });
    },
    [cardX, cardY, cardOpacity]
  );

  // Skip animation - enhanced down motion that scrolls over buttons and bottom modal
  const handleSkip = useCallback(async () => {
    if (isSkipAnimating) return;
    setIsSkipAnimating(true);
    setPreviewOnTop(true);
    setFrozenPreviewIndex(currentFixtureIndex + 1);

    // Track this card as skipped (only if not already in skipped mode)
    if (!isInSkippedMode) {
      setSkippedCardIndexes(prev => {
        if (!prev.includes(currentFixtureIndex)) {
          return [...prev, currentFixtureIndex];
        }
        return prev;
      });
    }

    try {
      // Phase 1: Move card above everything and animate down to scroll over buttons and bottom modal
      setCardZIndex('above-buttons');
      await animateValue('y', 600, { type: 'tween', ease: 'easeOut', duration: 0.6 });

      // Phase 2: Move card behind deck and start fade out during snap back
      setCardZIndex('below-deck');

      // Start both animations simultaneously - snap back and fade out
      const snapBackPromise = animateValue('y', -100, { type: 'spring', stiffness: 150, damping: 25, duration: 0.84375 });
      const fadeOutPromise = animateValue('opacity', 0, { type: 'tween', ease: 'easeOut', duration: 0.421875 }); // 50% of snap back duration

      await Promise.all([snapBackPromise, fadeOutPromise]);

      // Phase 3: Fall to last position (invisible, still behind deck)
      await animateValue('y', 50, { type: 'tween', ease: 'easeInOut', duration: 0.4 });

      // IMPORTANT: Reset opacity to 1 immediately after animation completes
      // This ensures the card is ready when it becomes active again
      cardOpacity.set(1);

      // Reset position and advance to next card
      cardY.set(0);
      setCardZIndex('normal');
      handleNext();
    } finally {
      setIsSkipAnimating(false);
      // Delay clearing to allow navigation to complete smoothly
      setTimeout(() => {
        setFrozenPreviewIndex(null);
        setPreviewOnTop(false);
      }, 150);
    }
  }, [isSkipAnimating, handleNext, currentFixtureIndex, cardY, cardOpacity, animateValue, isInSkippedMode]);

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
    let isSkip = false;

    if (ax >= ay) {
      // Horizontal swipe dominates → Left= '1', Right= '2'
      if (ax > threshold || vx > 500) {
        choice = dx < 0 ? '1' : '2';
      }
    } else {
      // Vertical swipe dominates
      if (dy < -threshold || vy < -500) {
        // Up = 'X'
        choice = 'X';
      } else if (dy > threshold || vy > 500) {
        // Down = skip
        isSkip = true;
      }
    }

    if ((choice || isSkip) && currentFixture) {
      if (isSkip) {
        // Handle skip animation (down motion)
        void handleSkip();
      } else {
        setFrozenPreviewIndex(currentFixtureIndex + 1);
        // Animate off-screen for horizontal swipes; up uses vertical animation
        const distance = 350;
        if (choice === '1') {
          // Left
          void animateValue('x', -distance, { type: 'tween', ease: 'easeInOut', duration: 0.22 }).then(() => cardX.set(0));
        } else if (choice === '2') {
          // Right
          void animateValue('x', distance, { type: 'tween', ease: 'easeInOut', duration: 0.22 }).then(() => cardX.set(0));
        } else {
          // Up → animate upward for visual parity with backup
          setPreviewOnTop(true);
          void animateValue('y', -distance, { type: 'tween', ease: 'easeInOut', duration: 0.22 }).then(() => cardY.set(0));
        }

        // Commit prediction and advance immediately
        void commitPredictionImmediate(currentFixture.id, choice!).finally(() => {
          // Delay clearing to allow navigation to complete smoothly
          setTimeout(() => {
            setFrozenPreviewIndex(null);
            setPreviewOnTop(false);
          }, 150);
        });
      }
    } else {
      // Not enough movement → snap back
      animate(cardX, 0, { type: 'spring', stiffness: 300, damping: 30 });
      animate(cardY, 0, { type: 'spring', stiffness: 300, damping: 30 });
    }
  }, [cardX, cardY, currentFixture, currentFixtureIndex, commitPredictionImmediate, handleSkip, animateValue]);

  // (definition moved above)

  // Animation function for diamond buttons
  const animateAndCommit = useCallback(async (direction: 'up' | 'down' | 'left' | 'right') => {
    if (!currentFixture) return;
    
    const distance = 350;
    
    if (direction === 'down') {
      // Skip animation (bring preview on top during vertical move)
      await handleSkip();
      return;
    }
    
    setFrozenPreviewIndex(currentFixtureIndex + 1);
    // Animate based on direction
    if (direction === 'up') {
      setPreviewOnTop(true);
      await animateValue('y', -distance, { type: 'tween', ease: 'easeInOut', duration: 0.22 });
      cardY.set(0);
    } else if (direction === 'left' || direction === 'right') {
      const targetX = direction === 'left' ? -distance : distance;
      await animateValue('x', targetX, { type: 'tween', ease: 'easeInOut', duration: 0.22 });
      cardX.set(0);
    }
    
    // Handle prediction based on direction
    if (direction === 'up') {
      await commitPredictionImmediate(currentFixture.id, 'X');
    } else if (direction === 'left') {
      await commitPredictionImmediate(currentFixture.id, '1');
    } else if (direction === 'right') {
      await commitPredictionImmediate(currentFixture.id, '2');
    }
    setTimeout(() => { setFrozenPreviewIndex(null); setPreviewOnTop(false); }, 50);
  }, [currentFixture, handleSkip, cardX, cardY, currentFixtureIndex, commitPredictionImmediate, animateValue]);

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

  // Live week error state (live mode only)
  if (currentMode === 'live' && liveWeekError) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center p-6">
          <p className="text-red-600 mb-4">Impossibile determinare la settimana corrente: {liveWeekError}</p>
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

  // Loading state (including live week loading)
  if (loading || (currentMode === 'live' && liveWeekLoading)) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-600">
            {currentMode === 'live' && liveWeekLoading
              ? 'Caricamento settimana corrente...'
              : 'Caricamento partite...'
            }
          </p>
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
      {/* Header - conditional rendering based on mode */}
      {currentMode === 'test' ? (
        <TestGameHeader
          selectedWeek={selectedWeek}
          predictionsCount={predictionsCount}
          timeToMatch={timeToMatch}
          fixtures={fixtures}
          isSticky={showSummaryScreen}
          onHeightChange={setHeaderHeight}
        />
      ) : (
        <GameHeader
          currentMode={currentMode}
          selectedWeek={selectedWeek}
          predictionsCount={predictionsCount}
          timeToMatch={timeToMatch}
          fixtures={fixtures}
          isSticky={showSummaryScreen}
          onHeightChange={setHeaderHeight}
          onReset={handlePlayAgain}
          isInSkippedMode={isInSkippedMode}
          skippedCardIndexes={skippedCardIndexes}
          currentFixtureIndex={currentFixtureIndex}
        />
      )}


      {/* Main Content */}
      <div className="flex-1 relative overflow-hidden px-4">
        {/* Card Stack Container */}
        <div className="relative h-full flex items-start justify-center">
          {/* Preview Card (next card) - Memoized to prevent flash re-renders */}
          {previewCard}

          {/* Current Card */}
          {currentFixture && (
            <div className={`absolute top-0 left-0 right-0 flex items-start justify-center ${
              cardZIndex === 'above-buttons' ? 'z-40' :
              cardZIndex === 'below-deck' ? 'z-5' :
              'z-30'
            }`}>
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
                    opacity: cardOpacity,
                  }}
                />
              </div>
            </div>
          )}

          {/* Simple Loading for Skipped Cards */}
          {isTransitioningToSkipped && (
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
            </div>
          )}

          {/* End of Cards Message */}
          {!currentFixture && skippedCardIndexes.length === 0 && !isTransitioningToSkipped && (
            <div className="absolute top-0 left-0 right-0 flex items-start justify-center z-30">
              <div className="w-full max-w-sm bg-white rounded-2xl p-6 shadow-lg border border-gray-200 text-center">
                <h3 className="text-lg font-semibold text-gray-800 mb-2">Tutte le carte completate!</h3>
                <p className="text-gray-600 mb-4">Hai raggiunto la fine del mazzo.</p>
                <button
                  onClick={handlePlayAgain}
                  className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700"
                >
                  Ricomincia
                </button>
              </div>
            </div>
          )}
        </div>

      </div>

      {/* Prediction Buttons - Diamond Layout (in-flow; scrolls with content) */}
      {!canShowVeil && currentFixture && !showSummaryScreen && (
        <PredictionButtons
          currentPrediction={currentPrediction}
          canShowVeil={canShowVeil}
          isSkipAnimating={isSkipAnimating}
          onAnimateAndCommit={animateAndCommit}
        />
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

      {/* Game Summary Screen */}
      {showSummaryScreen && (
        <GameSummaryScreen
          predictions={predictions}
          fixtures={fixtures}
          headerHeight={headerHeight}
        />
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
