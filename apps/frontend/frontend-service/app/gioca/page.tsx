'use client';

import { useState, useCallback, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from 'next/navigation';
import { useAnimationControls, useMotionValue, useTransform, PanInfo } from 'framer-motion';
import { Toast } from '@/src/components/Toast';
import { apiClient } from "@/lib/api-client";
import { useGameMode } from "@/src/contexts/GameModeContext";
import { useAuthContext } from "@/src/contexts/AuthContext";

// Hooks
import { useFixtures } from './hooks/useFixtures';
import { usePredictions } from './hooks/usePredictions';
import { useCountdown } from './hooks/useCountdown';

// Components
import {
  GameHeader,
  MatchCard,
  CompletionVeilModal,
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
  const { firebaseUser } = useAuthContext();
  
  // Get mode from URL parameters or context
  const currentMode = ((searchParams?.get('mode') as 'live' | 'test' | null) ?? null) || mode;
  
  // Live week state  
  const [currentLiveWeek] = useState<number | null>(null);
  
  // Selected week logic
  const selectedWeek = (() => {
    if (currentMode === 'live') {
      return currentLiveWeek || 1;
    } else {
      const w = Number(searchParams?.get('week') ?? NaN);
      return Number.isFinite(w) && w >= 1 && w <= 38 ? w : 1;
    }
  })();
  
  // UI state
  const [userKey, setUserKey] = useState<string | null>(null);
  const [userMissingModal, setUserMissingModal] = useState<{ show: boolean; triedUid?: string }>(() => ({ show: false }));
  const [weekComplete] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  
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

  // User resolution effect - convert Firebase UID to backend user ID
  useEffect(() => {
    const resolveUserId = async () => {
      if (!firebaseUser?.uid) {
        setUserKey(null);
        return;
      }
      try {
        const resp = await apiClient.getUserByFirebaseUid(firebaseUser.uid) as unknown as { success?: boolean; data?: { id?: string } };
        const idStr = resp?.data?.id;
        if (idStr && String(idStr).length > 0) {
          setUserKey(String(idStr));
          setUserMissingModal({ show: false });
          // If Firebase says verified, sync DB once when ID known
          if (firebaseUser.emailVerified === true) {
            try { await apiClient.updateEmailVerified(String(idStr), true); } catch {}
          }
        } else {
          setUserKey(null);
          setUserMissingModal({ show: true, triedUid: firebaseUser.uid });
        }
      } catch (e) {
        console.warn('Failed to resolve user id from Firebase UID', e);
        setUserKey(null);
        setUserMissingModal({ show: true, triedUid: firebaseUser.uid });
      }
    };
    resolveUserId();
  }, [firebaseUser?.uid, firebaseUser?.emailVerified]);

  // Card navigation state
  const [currentFixtureIndex, setCurrentFixtureIndex] = useState(0);
  const [isSkipAnimating, setIsSkipAnimating] = useState(false);
  const [previewOnTop, setPreviewOnTop] = useState(false);

  // Animation controls
  const controls = useAnimationControls();
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

  // Swipe handling
  const handleDragEnd = useCallback((_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    const { offset, velocity } = info;
    
    if (Math.abs(offset.x) > ANIMATION_CONFIG.SWIPE_THRESHOLD || Math.abs(velocity.x) > 500) {
      if (offset.x > 0) {
        handlePrev();
      } else {
        handleNext();
      }
    } else {
      cardX.set(0);
    }
  }, [handleNext, handlePrev, cardX]);

  // Skip animation
  const handleSkip = useCallback(async () => {
    if (isSkipAnimating) return;
    setIsSkipAnimating(true);
    setPreviewOnTop(true);
    
    try {
      await controls.start({
        y: [0, -400, 0],
        transition: { duration: 0.8, ease: "easeInOut" }
      });
      handleNext();
    } finally {
      setIsSkipAnimating(false);
      setPreviewOnTop(false);
    }
  }, [isSkipAnimating, controls, handleNext]);

  // Prediction handling
  const handleCardPrediction = useCallback((fixtureId: number, choice: PredictionChoice) => {
    handlePrediction(fixtureId, choice);
    
    // Auto-advance to next card after prediction
    setTimeout(() => {
      if (currentFixtureIndex < fixtures.length - 1) {
        handleNext();
      }
    }, 500);
  }, [handlePrediction, currentFixtureIndex, fixtures.length, handleNext]);

  // Debug log for rendering decision
  console.log('[gioca-page] render state:', { 
    loading, 
    error, 
    fixturesLength: fixtures.length, 
    currentMode, 
    selectedWeek,
    userKey: userKey ? 'set' : 'null'
  });

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
      />

      {/* Main Content */}
      <div className="flex-1 relative overflow-hidden px-4">
        {/* Card Stack Container */}
        <div className="relative h-full flex items-center justify-center">
          {/* Preview Card (next card) */}
          {currentFixtureIndex < fixtures.length - 1 && (
            <div 
              className={`absolute inset-0 flex items-center justify-center ${previewOnTop ? 'z-20' : 'z-10'}`}
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
          <div className={`absolute inset-0 flex items-center justify-center ${previewOnTop ? 'z-10' : 'z-20'}`}>
            <div className="w-full max-w-sm">
              <MatchCard
                fixture={currentFixture}
                matchCard={currentMatchCard}
                onPrediction={handleCardPrediction}
                currentPrediction={currentPrediction}
                disabled={weekComplete || isComplete}
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

        {/* Skip Button */}
        {!weekComplete && !isComplete && fixtures.length > 1 && (
          <button
            onClick={handleSkip}
            disabled={isSkipAnimating}
            className="absolute top-4 right-4 z-30 px-3 py-1 bg-gray-800/20 backdrop-blur-sm text-white text-sm rounded-full hover:bg-gray-800/30 transition-colors disabled:opacity-50"
          >
            Salta
          </button>
        )}

        {/* Progress Indicator */}
        <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 z-30">
          <div className="flex space-x-2">
            {fixtures.map((_, index) => (
              <div
                key={index}
                className={`w-2 h-2 rounded-full transition-colors ${
                  index === currentFixtureIndex
                    ? 'bg-purple-600'
                    : index < currentFixtureIndex
                    ? 'bg-green-500'
                    : 'bg-gray-300'
                }`}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Bottom Navigation */}
      <BottomNav
        currentMode={currentMode}
        selectedWeek={selectedWeek}
        onNavigateToResults={handleGoToResults}
        onNavigateToProfile={handleGoToProfile}
      />

      {/* Completion Veil Modal */}
      <CompletionVeilModal
        isOpen={weekComplete || isComplete}
        selectedWeek={selectedWeek}
        onGoToResults={handleGoToResults}
      />

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