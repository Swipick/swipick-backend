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

// Simple choice badge component (like live mode)
const ChoiceBadge: React.FC<{
  label: '1' | 'X' | '2';
  isSelected: boolean;
}> = ({ label, isSelected }) => (
  <div
    className={
      `min-w-[36px] h-7 px-2 rounded-md grid place-items-center text-xs font-semibold border ` +
      (isSelected
        ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
        : 'bg-white text-gray-700 border-gray-300')
    }
  >
    {label}
  </div>
);

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

  // Helper function to get prediction choice for a fixture
  const getPredictionChoice = (fixtureId: number) => {
    return predictions[fixtureId];
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


      {/* Main content - scrollable predictions list */}
      <div className="flex-1 overflow-y-auto px-4 pb-20">
        <div className="space-y-4 max-w-md mx-auto">
          {fixtures.map((fixture) => {
            const prediction = getPredictionChoice(fixture.id);
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

                {/* Simple choice badges (1/X/2) like live mode */}
                <div className="flex flex-col gap-2 items-center">
                  <ChoiceBadge label="1" isSelected={prediction === '1'} />
                  <ChoiceBadge label="X" isSelected={prediction === 'X'} />
                  <ChoiceBadge label="2" isSelected={prediction === '2'} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}