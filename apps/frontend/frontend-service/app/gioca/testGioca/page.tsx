'use client';

import React, { useState, useCallback, Suspense, useEffect, useMemo } from "react";
import { useRouter, useSearchParams } from 'next/navigation';
import { useMotionValue, useTransform, PanInfo, animate, MotionValue } from 'framer-motion';
import { Toast } from '@/src/components/Toast';
import { useAuthContext } from "@/src/contexts/AuthContext";
import { apiClient } from "@/lib/api-client";

// Hooks
import { useFixtures } from '../hooks/useFixtures';
import { usePredictions } from '../hooks/usePredictions';
import { useCountdown } from '../hooks/useCountdown';

// Components
import {
  TestGameHeader,
  MatchCard,
  BottomNav,
  PredictionButtons,
  TestGameSummaryScreen,
} from '../components';


// Types and constants
import type { PredictionChoice } from '../types';
import { ANIMATION_CONFIG } from '../utils/constants';

function TestGiocaPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Test mode is hardcoded
  const currentMode = 'test' as const;

  // For test mode, receive active week from TestGameHeader (source of truth)
  const [testModeActiveWeek, setTestModeActiveWeek] = useState<number | null>(null);

  // Callback to receive active week from TestGameHeader
  const handleActiveWeekChange = useCallback((activeWeek: number) => {
    setTestModeActiveWeek(activeWeek);
    console.log(`[TestGioca] Active week received from TestGameHeader: ${activeWeek}`);
  }, []);

  // Selected week logic - simplified for test mode only
  const selectedWeek = useMemo(() => {
    // Test mode: wait for TestGameHeader to provide the authoritative week
    // Don't load any fixtures until we have the correct week calculation
    if (testModeActiveWeek === null) {
      console.log('[TestGioca] Waiting for TestGameHeader to provide active week...');
      return null;
    }

    console.log(`[TestGioca] Using TestGameHeader active week: ${testModeActiveWeek}`);
    return testModeActiveWeek;
  }, [testModeActiveWeek]);

  // Firebase authentication
  const { firebaseUser } = useAuthContext();

  // Use Firebase user's UID as userKey
  const userKey = firebaseUser?.uid || null;

  // UI state
  const [weekComplete, setWeekComplete] = useState(false);
  const [rolledWeek1Once, setRolledWeek1Once] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // Helper function to generate week prediction keys
  const hasWeekPredsKey = useCallback((week: number | null, userId: string | null): string => {
    const user = userId ?? 'anon';
    const w = week ?? 0;
    return `swipick:gioca:hasWeekPreds:test:week${w}:user:${user}`;
  }, []);

  // Navigation handlers
  const handleGoToResults = useCallback(() => {
    router.push(`/risultati/test-risultati?week=${selectedWeek}`);
  }, [router, selectedWeek]);

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
    if (isComplete && fixtures.length > 0 && !showSummaryScreen) {
      // Small delay to allow last animation to complete
      const timer = setTimeout(() => {
        setShowSummaryScreen(true);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [isComplete, fixtures.length, showSummaryScreen]);

  // Countdown timer
  const {
    timeToMatch,
  } = useCountdown({ currentMode, fixtures });

  // Check if selected week is already fully predicted (Test Mode) and set veil
  useEffect(() => {
    const checkWeekCompletion = async () => {
      if (!userKey || selectedWeek == null) {
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
  }, [selectedWeek, userKey, hasWeekPredsKey]);

  // Ensure no veil appears for Week 2 until the user has at least one prediction there
  useEffect(() => {
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
  }, [selectedWeek, userKey, hasWeekPredsKey]);

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
    setWeekComplete(false); // Reset week completion veil
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
    router.push(`/risultati/test-risultati?week=${selectedWeek}`);
  }, [router, selectedWeek]);

  // Current fixture data
  const currentFixture = fixtures[currentFixtureIndex];
  const currentMatchCard = matchCards.find(mc => mc.fixtureId === currentFixture?.id);
  const currentPrediction = currentFixture ? predictions[currentFixture.id] : undefined;

  // Prediction handling (moved above preview card to avoid TDZ issues)
  const handleCardPrediction = useCallback(async (fixtureId: number, choice: PredictionChoice) => {
    await handlePrediction(fixtureId, choice);

    // Mark that the user has at least one prediction for this week (to enable weekly-stats checks later)
    if (userKey) {
      try {
        const k = hasWeekPredsKey(selectedWeek, userKey);
        localStorage.setItem(k, '1');
      } catch {}
    }

    // Note: Auto-advance removed to avoid circular dependency - handled elsewhere
  }, [handlePrediction, userKey, selectedWeek, hasWeekPredsKey]);

  // Preview card calculation - memoized with stable keys to prevent flash re-renders
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
            key={`test-preview-card-${previewFixture.id}-idx-${displayIndex}-frozen-${frozenPreviewIndex}-current-${currentFixtureIndex}`}
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

    // Clear preview states first to prevent flash
    setFrozenPreviewIndex(null);
    setPreviewOnTop(false);

    // Reset card state for next card with slight delay to prevent flash
    setTimeout(() => {
      cardX.set(0);
      cardY.set(0);
      cardOpacity.set(1);
      setCardZIndex('normal');
    }, 16); // One frame delay
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


  // Commit prediction and advance immediately, save prediction in background
  const commitPredictionImmediate = useCallback(async (fixtureId: number, choice: PredictionChoice) => {
    // Advance to next card immediately for smooth visual transition
    handleNext();

    // Save prediction in background (non-blocking)
    Promise.resolve().then(async () => {
      try {
        await handlePrediction(fixtureId, choice);
        if (userKey) {
          try {
            const k = hasWeekPredsKey(selectedWeek, userKey);
            localStorage.setItem(k, '1');
          } catch {}
        }
      } catch (error) {
        console.error('Failed to save prediction:', error);
      }
    });
  }, [handleNext, handlePrediction, userKey, selectedWeek, hasWeekPredsKey]);

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
        void commitPredictionImmediate(currentFixture.id, choice!);

        // Clear states after animation completes
        setTimeout(() => {
          setFrozenPreviewIndex(null);
          setPreviewOnTop(false);
        }, 220 + 16); // Animation duration + one frame
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

    // Handle prediction based on direction - advance immediately
    if (direction === 'up') {
      commitPredictionImmediate(currentFixture.id, 'X');
    } else if (direction === 'left') {
      commitPredictionImmediate(currentFixture.id, '1');
    } else if (direction === 'right') {
      commitPredictionImmediate(currentFixture.id, '2');
    }

    // Clear states after animation
    setTimeout(() => {
      setFrozenPreviewIndex(null);
      setPreviewOnTop(false);
    }, 220 + 16);
  }, [currentFixture, handleSkip, cardX, cardY, currentFixtureIndex, commitPredictionImmediate, animateValue]);

  // Decide if the completion veil should be displayed for the current context
  const canShowVeil = (() => {
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

  // No fixtures state - render TestGameHeader to provide active week
  if (fixtures.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        {/* TestGameHeader renders to calculate and provide active week */}
        <TestGameHeader
          selectedWeek={selectedWeek}
          predictionsCount={predictionsCount}
          timeToMatch={timeToMatch}
          fixtures={fixtures}
          isSticky={false}
          onHeightChange={setHeaderHeight}
          userKey={userKey}
          onReset={resetPredictions}
          onActiveWeekChange={handleActiveWeekChange}
        />

        {/* Loading message while waiting for active week calculation */}
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center p-6">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto mb-4"></div>
            <p className="text-gray-600 mb-4">Caricamento settimana attiva...</p>
          </div>
        </div>

        <BottomNav
          currentMode={currentMode}
          selectedWeek={selectedWeek}
          onNavigateToResults={handleGoToResults}
          onNavigateToGioca={() => {}}
          onNavigateToProfile={handleGoToProfile}
          activeTab="gioca"
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* TestGameHeader */}
      <TestGameHeader
        selectedWeek={selectedWeek}
        predictionsCount={predictionsCount}
        timeToMatch={timeToMatch}
        fixtures={fixtures}
        isSticky={showSummaryScreen}
        onHeightChange={setHeaderHeight}
        userKey={userKey}
        onReset={resetPredictions}
        onActiveWeekChange={handleActiveWeekChange}
      />

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
                  key={`test-current-card-${currentFixture.id}-idx-${currentFixtureIndex}-zindex-${cardZIndex}`}
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
        onNavigateToGioca={() => {}}
        onNavigateToProfile={handleGoToProfile}
        activeTab="gioca"
      />

      {/* Veil when week is completed (Test Mode). Hidden for Week 1 once rollover occurred, to avoid blocking UI when user navigates back. Also hidden when summary screen is showing. */}
      {canShowVeil && !showSummaryScreen && (
        <div className="fixed inset-0 z-50 pointer-events-none">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" />
          <div className="fixed top-[calc(env(safe-area-inset-top)+12px)] left-1/2 -translate-x-1/2 w-[88%] max-w-md pointer-events-auto">
            <div className="bg-white rounded-2xl shadow-2xl p-6 text-center">
              <h3 className="text-xl font-semibold text-black mb-2">Giornata completata</h3>
              <p className="text-sm text-gray-700 mb-5">Hai già effettuato 10 scelte per questa settimana. Vai alla pagina Risultati per rivelare e vedere l&apos;andamento.</p>
              <div className="flex gap-3 justify-center">
                <button
                  onClick={() => router.push(`/risultati/test-risultati?week=${selectedWeek}`)}
                  className="px-5 py-2 rounded-md bg-purple-600 text-white font-medium hover:bg-purple-700"
                >
                  Vai a Risultati
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Test Game Summary Screen */}
      {showSummaryScreen && userKey && selectedWeek && (
        <TestGameSummaryScreen
          fixtures={fixtures}
          userId={userKey}
          week={selectedWeek}
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

export default function TestGiocaPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
        </div>
      }
    >
      <TestGiocaPageContent />
    </Suspense>
  );
}