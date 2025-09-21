/**
 * TestGameSummaryScreen Component
 * Full-screen comprehensive summary for test mode showing database-stored predictions
 */

import React, { useState, useEffect } from 'react';
import { apiClient } from '../../../../lib/api-client';
import type { Fixture, PredictionRecord } from '../../types';

interface TestGameSummaryScreenProps {
  fixtures: Fixture[];
  userId: string;
  week: number;
  headerHeight?: number;
}

interface BackendPrediction {
  id: string;
  user_id: string;
  fixture_id: string;
  choice: '1' | 'X' | '2';
  result?: '1' | 'X' | '2';
  is_correct?: boolean;
  week: number;
  timestamp: string;
  match_display: string;
  choice_display: string;
}

interface WeeklyStatsResponse {
  week: number;
  total_predictions: number;
  correct_predictions: number;
  success_rate: number;
  predictions: BackendPrediction[];
}

// Helper function to get team logo path
const getTeamLogoPath = (teamName: string): string => {
  // Map team names to logo files
  const logoMap: Record<string, string> = {
    'Juventus': 'JuventusFcLogo.png',
    'AC Milan': 'AcMilanLogo.png',
    'Inter': 'FcInternazionaleMilano.png',
    'Roma': 'AsRomaLogo.png',
    'Napoli': 'NapolLogo.png',
    'Lazio': 'StemmaLazioCentenarioLogo.png',
    'Atalanta': 'AtalantaBcLogo.png',
    'Fiorentina': 'AcfFiorentinaLogo.png',
    'Bologna': 'LogobolognaLogo.png',
    'Torino': 'TorinoFcLogo.png',
    'Udinese': 'UdineseLogo.png',
    'Sassuolo': 'SassuoloLogo.png',
    'Verona': 'HellasVeronaFcLogo.png',
    'Genoa': 'GenoaCfcLogo.png',
    'Cagliari': 'CagliariCalcioLogo.png',
    'Lecce': 'LecceLogo.png',
    'Monza': 'AcMonzaLogo.png',
    'Empoli': 'EmpolFcLogo.png',
    'Como': 'ComoCalcioLogo.png',
    'Parma': 'ParmaLogo.png'
  };

  return logoMap[teamName] ? `/teams/${logoMap[teamName]}` : '';
};

// Team logo component with fallback
const TeamLogo: React.FC<{
  src?: string;
  alt: string;
  teamName: string;
}> = ({ src, alt, teamName }) => {
  const [imageError, setImageError] = useState(false);
  const logoPath = src || getTeamLogoPath(teamName);

  if (!logoPath || imageError) {
    return (
      <div className="w-12 h-12 rounded-full bg-purple-100 flex items-center justify-center">
        <span className="text-purple-800 font-bold text-lg">
          {teamName.charAt(0)}
        </span>
      </div>
    );
  }

  return (
    <img
      src={logoPath}
      alt={alt}
      className="w-12 h-12 object-contain"
      onError={() => setImageError(true)}
    />
  );
};

// Enhanced choice badge component with result indicators
const ChoiceBadge: React.FC<{
  label: '1' | 'X' | '2';
  isSelected: boolean;
  isCorrect?: boolean;
  actualResult?: '1' | 'X' | '2';
}> = ({ label, isSelected, isCorrect, actualResult }) => {
  // Determine badge styling based on selection and correctness
  let badgeClass = `min-w-[36px] h-7 px-2 rounded-md grid place-items-center text-xs font-semibold border relative `;

  if (isSelected) {
    if (isCorrect === true) {
      badgeClass += 'bg-green-600 text-white border-green-600 shadow-sm';
    } else if (isCorrect === false) {
      badgeClass += 'bg-red-600 text-white border-red-600 shadow-sm';
    } else {
      badgeClass += 'bg-indigo-600 text-white border-indigo-600 shadow-sm';
    }
  } else if (actualResult === label) {
    // Show the actual result if it wasn't the user's choice
    badgeClass += 'bg-gray-200 text-gray-700 border-gray-300 ring-2 ring-green-400';
  } else {
    badgeClass += 'bg-white text-gray-700 border-gray-300';
  }

  return (
    <div className={badgeClass}>
      {label}
      {isSelected && isCorrect === true && (
        <span className="absolute -top-1 -right-1 text-green-600">✓</span>
      )}
      {isSelected && isCorrect === false && (
        <span className="absolute -top-1 -right-1 text-red-600">✗</span>
      )}
    </div>
  );
};

export function TestGameSummaryScreen({
  fixtures,
  userId,
  week,
  headerHeight = 160,
}: TestGameSummaryScreenProps) {
  const [weeklyStats, setWeeklyStats] = useState<WeeklyStatsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [predictions, setPredictions] = useState<PredictionRecord>({});

  useEffect(() => {
    const fetchWeeklyStats = async () => {
      try {
        setLoading(true);
        setError(null);

        console.log(`[TestGameSummaryScreen] Fetching stats for user ${userId}, week ${week}`);

        const stats = await apiClient.getTestWeeklyStats(userId, week);
        setWeeklyStats(stats);

        // Convert backend predictions to PredictionRecord format
        const predictionsRecord: PredictionRecord = {};
        stats.predictions.forEach((pred: BackendPrediction) => {
          const fixtureId = parseInt(pred.fixture_id);
          predictionsRecord[fixtureId] = pred.choice;
        });
        setPredictions(predictionsRecord);

        console.log(`[TestGameSummaryScreen] Loaded ${stats.predictions.length} predictions`);
      } catch (err) {
        console.error('[TestGameSummaryScreen] Error fetching weekly stats:', err);
        setError(err instanceof Error ? err.message : 'Failed to load predictions');
      } finally {
        setLoading(false);
      }
    };

    if (userId && week) {
      fetchWeeklyStats();
    }
  }, [userId, week]);

  // Helper function to get prediction data for a fixture
  const getPredictionData = (fixtureId: number) => {
    const backendPred = weeklyStats?.predictions.find(
      p => parseInt(p.fixture_id) === fixtureId
    );
    return {
      choice: predictions[fixtureId],
      isCorrect: backendPred?.is_correct,
      actualResult: backendPred?.result
    };
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <div
          aria-hidden
          className="w-full"
          style={{ height: headerHeight + 24 }}
        />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading your predictions...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <div
          aria-hidden
          className="w-full"
          style={{ height: headerHeight + 24 }}
        />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <p className="text-red-600 mb-2">Error loading predictions</p>
            <p className="text-gray-600 text-sm">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Spacer for fixed header */}
      <div
        aria-hidden
        className="w-full"
        style={{ height: headerHeight + 24 }}
      />

      {/* Performance Summary */}
      {weeklyStats && (
        <div className="px-4 mb-4">
          <div className="max-w-md mx-auto bg-white rounded-2xl p-4 shadow-sm border border-gray-200">
            <div className="text-center">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Week {week} Summary
              </h3>
              <div className="flex justify-center items-center gap-6">
                <div className="text-center">
                  <div className="text-2xl font-bold text-indigo-600">
                    {weeklyStats.correct_predictions}
                  </div>
                  <div className="text-xs text-gray-600">Correct</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-gray-900">
                    {weeklyStats.total_predictions}
                  </div>
                  <div className="text-xs text-gray-600">Total</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">
                    {Math.round(weeklyStats.success_rate)}%
                  </div>
                  <div className="text-xs text-gray-600">Accuracy</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main content - scrollable predictions list */}
      <div className="flex-1 overflow-y-auto px-4 pb-20">
        <div className="space-y-4 max-w-md mx-auto">
          {fixtures.map((fixture) => {
            const predictionData = getPredictionData(fixture.id);
            const kickoff = new Date(fixture.date).toLocaleDateString('it-IT', {
              weekday: 'short',
              day: '2-digit',
              month: '2-digit',
              hour: '2-digit',
              minute: '2-digit'
            });

            const homeLogo = fixture.teams.home.logo;
            const awayLogo = fixture.teams.away.logo;
            const homeName = fixture.teams.home.name;
            const awayName = fixture.teams.away.name;

            return (
              <div
                key={fixture.id}
                className="bg-white rounded-2xl p-4 shadow-sm border border-gray-200 mb-4 flex items-center"
              >
                {/* Teams and details section */}
                <div className="flex-1">
                  {/* Home team */}
                  <div className="flex items-center gap-3 mb-2">
                    <TeamLogo
                      src={homeLogo}
                      alt={homeName}
                      teamName={homeName}
                    />
                    <span className="text-sm font-semibold text-black">
                      {homeName}
                    </span>
                  </div>

                  {/* Away team */}
                  <div className="flex items-center gap-3">
                    <TeamLogo
                      src={awayLogo}
                      alt={awayName}
                      teamName={awayName}
                    />
                    <span className="text-sm font-semibold text-black">
                      {awayName}
                    </span>
                  </div>
                </div>

                {/* Kickoff time pill */}
                <div className="mx-3">
                  <div className="px-3 py-1 rounded-md border text-[11px] text-gray-700 border-gray-200 whitespace-nowrap">
                    {kickoff}
                  </div>
                </div>

                {/* Enhanced choice badges (1/X/2) with results */}
                <div className="flex flex-col gap-2 items-center">
                  <ChoiceBadge
                    label="1"
                    isSelected={predictionData.choice === '1'}
                    isCorrect={predictionData.choice === '1' ? predictionData.isCorrect : undefined}
                    actualResult={predictionData.actualResult}
                  />
                  <ChoiceBadge
                    label="X"
                    isSelected={predictionData.choice === 'X'}
                    isCorrect={predictionData.choice === 'X' ? predictionData.isCorrect : undefined}
                    actualResult={predictionData.actualResult}
                  />
                  <ChoiceBadge
                    label="2"
                    isSelected={predictionData.choice === '2'}
                    isCorrect={predictionData.choice === '2' ? predictionData.isCorrect : undefined}
                    actualResult={predictionData.actualResult}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}