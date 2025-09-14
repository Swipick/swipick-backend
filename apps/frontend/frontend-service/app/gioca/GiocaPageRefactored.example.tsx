/**
 * Example of how the GiocaPage would look after Phase 2 refactoring
 * This demonstrates the clean separation of concerns using custom hooks
 */

'use client';

import { Suspense } from "react";
import { motion, useAnimationControls, useMotionValue, useTransform } from 'framer-motion';
import { useRouter } from 'next/navigation';
import Image from 'next/image';

// Extracted hooks
import { 
  useFixtures, 
  usePredictions, 
  useCountdown, 
  useGameState 
} from './hooks';

// Extracted types and constants
import type { Fixture, MatchCard } from './types';
import { ANIMATION_CONFIG } from './utils/constants';

function GiocaPageContent() {
  const router = useRouter();
  
  // Use extracted hooks - clean separation of concerns
  const gameState = useGameState({
    fixtures: [], // Would be passed from useFixtures
    predictionsCount: 0, // Would come from usePredictions
    isComplete: false, // Would be computed
  });
  
  const fixtures = useFixtures({
    currentMode: gameState.currentMode,
    selectedWeek: gameState.selectedWeek,
    userKey: gameState.userKey,
    currentLiveWeek: null,
  });
  
  const predictions = usePredictions({
    currentMode: gameState.currentMode,
    selectedWeek: gameState.selectedWeek,
    userKey: gameState.userKey,
    fixtures: fixtures.fixtures,
  });
  
  const countdown = useCountdown({
    fixtures: fixtures.fixtures,
    currentMode: gameState.currentMode,
  });

  // Animation setup (could be extracted to useAnimation hook in Phase 3)
  const controls = useAnimationControls();
  const cardX = useMotionValue(0);
  const cardY = useTransform(cardX, ANIMATION_CONFIG.CARD_X_RANGE, ANIMATION_CONFIG.CARD_Y_RANGE);
  const cardRotate = useTransform(cardX, ANIMATION_CONFIG.CARD_X_RANGE, ANIMATION_CONFIG.CARD_ROTATE_RANGE);

  // Handle prediction (now just a clean hook call)
  const handlePredictionChoice = async (fixtureId: number, choice: '1' | 'X' | '2') => {
    await predictions.handlePrediction(fixtureId, choice);
  };

  // Loading state
  if (fixtures.loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center">
        <div className="text-center text-white">
          <div className="animate-spin w-12 h-12 border-4 border-white border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-xl">Caricamento...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (fixtures.error) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center text-red-600">
          <p className="text-xl mb-4">Errore nel caricamento</p>
          <p className="text-sm">{fixtures.error}</p>
        </div>
      </div>
    );
  }

  // Current fixture from clean state
  const currentFixture = fixtures.fixtures[gameState.currentFixtureIndex];
  const currentCard = fixtures.matchCards[gameState.currentFixtureIndex];

  return (
    <div className="min-h-screen bg-white pb-[max(env(safe-area-inset-bottom),96px)]">
      {/* Game Header - would be extracted to component in Phase 3 */}
      <div className="w-full mx-0 mt-0 mb-6 rounded-b-2xl rounded-t-none text-white bg-gradient-to-r from-purple-600 to-blue-600 p-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">
            Settimana {gameState.selectedWeek}
          </h1>
          <div className="text-sm opacity-90">
            {countdown.timeToMatch.days > 0 && `${countdown.timeToMatch.days}g `}
            {countdown.timeToMatch.hours}h {countdown.timeToMatch.minutes}m {countdown.timeToMatch.seconds}s
          </div>
          <div className="mt-4 bg-white/20 rounded-full h-2">
            <div 
              className="bg-white rounded-full h-2 transition-all duration-300"
              style={{ width: `${predictions.predictionsCount * 10}%` }}
            />
          </div>
          <div className="text-xs mt-1">
            {predictions.predictionsCount}/10 predizioni
          </div>
        </div>
      </div>

      {/* Match Card - would be extracted to component in Phase 3 */}
      {currentFixture && (
        <div className="px-3 mb-8 relative max-w-[390px] mx-auto w-full">
          <motion.div
            style={{ x: cardX, y: cardY, rotate: cardRotate }}
            className="match-card bg-white rounded-2xl p-6 shadow-lg border border-gray-200"
          >
            <div className="text-center mb-4">
              <p className="text-black text-sm mb-1">
                {currentCard ? currentCard.kickoff.display : new Date(currentFixture.date).toLocaleString()}
              </p>
              <p className="text-black text-xs">
                {currentCard?.stadium || currentFixture.venue.name}
              </p>
            </div>

            <div className="flex justify-between items-center mb-6">
              {/* Home Team */}
              <div className="flex-1 text-center">
                {currentFixture.teams.home.logo ? (
                  <Image
                    src={currentFixture.teams.home.logo}
                    alt={currentFixture.teams.home.name}
                    width={80}
                    height={80}
                    className="w-20 h-20 mx-auto mb-3 object-contain"
                  />
                ) : (
                  <div className="w-20 h-20 mx-auto mb-3 bg-blue-200 rounded-full flex items-center justify-center">
                    <span className="text-blue-600 font-bold text-2xl">
                      {currentFixture.teams.home.name.charAt(0)}
                    </span>
                  </div>
                )}
                <h3 className="font-bold text-lg text-black">
                  {currentFixture.teams.home.name}
                </h3>
              </div>

              <div className="text-2xl font-bold text-gray-400 mx-4">VS</div>

              {/* Away Team */}
              <div className="flex-1 text-center">
                {currentFixture.teams.away.logo ? (
                  <Image
                    src={currentFixture.teams.away.logo}
                    alt={currentFixture.teams.away.name}
                    width={80}
                    height={80}
                    className="w-20 h-20 mx-auto mb-3 object-contain"
                  />
                ) : (
                  <div className="w-20 h-20 mx-auto mb-3 bg-red-200 rounded-full flex items-center justify-center">
                    <span className="text-red-600 font-bold text-2xl">
                      {currentFixture.teams.away.name.charAt(0)}
                    </span>
                  </div>
                )}
                <h3 className="font-bold text-lg text-black">
                  {currentFixture.teams.away.name}
                </h3>
              </div>
            </div>

            {/* Prediction Buttons - would be extracted to component in Phase 3 */}
            <div className="flex justify-center items-center space-x-8">
              <button
                onClick={() => handlePredictionChoice(currentFixture.id, '1')}
                className="w-16 h-16 rounded-full bg-blue-500 text-white font-bold text-lg hover:bg-blue-600 transition-colors"
                disabled={predictions.isComplete}
              >
                1
              </button>
              <button
                onClick={() => handlePredictionChoice(currentFixture.id, 'X')}
                className="w-16 h-16 rounded-full bg-gray-500 text-white font-bold text-lg hover:bg-gray-600 transition-colors"
                disabled={predictions.isComplete}
              >
                X
              </button>
              <button
                onClick={() => handlePredictionChoice(currentFixture.id, '2')}
                className="w-16 h-16 rounded-full bg-red-500 text-white font-bold text-lg hover:bg-red-600 transition-colors"
                disabled={predictions.isComplete}
              >
                2
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Completion Modal - would be extracted to component in Phase 3 */}
      {gameState.canShowVeil && (
        <div className="fixed inset-0 z-50 pointer-events-none">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" />
          <div className="fixed top-[calc(env(safe-area-inset-top)+12px)] left-1/2 -translate-x-1/2 w-[88%] max-w-md pointer-events-auto">
            <div className="bg-white rounded-2xl shadow-2xl p-6 text-center">
              <h3 className="text-xl font-semibold text-black mb-2">Giornata completata</h3>
              <p className="text-sm text-gray-700 mb-5">
                Hai già effettuato 10 scelte per questa settimana. Vai alla pagina Risultati per vedere l'andamento.
              </p>
              <button
                onClick={() => router.push(`/risultati?mode=test&week=${gameState.selectedWeek}`)}
                className="px-5 py-2 rounded-md bg-purple-600 text-white font-medium hover:bg-purple-700"
              >
                Vai a Risultati
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function GiocaPageRefactored() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-600 to-blue-600">
        <div className="text-white text-xl">Caricamento...</div>
      </div>
    }>
      <GiocaPageContent />
    </Suspense>
  );
}