'use client';

import React, { useState, useEffect, useMemo, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuthContext } from '@/src/contexts/AuthContext';
import { apiClient } from '@/lib/api-client';
import { RiFootballLine } from 'react-icons/ri';
import { IoShareOutline } from 'react-icons/io5';
import { FaMedal } from 'react-icons/fa';
import { BsFillFilePersonFill } from 'react-icons/bs';
import { AnimatePresence, motion } from 'framer-motion';

interface Fixture {
  id: number;
  date: string;
  kickoff?: string;
  datetime?: string;
  match_date?: string;
  teams?: {
    home: { name: string; logo?: string };
    away: { name: string; logo?: string };
  };
  // Alternative structure from backend
  homeTeam?: string;
  awayTeam?: string;
  home_team?: string;
  away_team?: string;
}

interface WeeklyStatsResponse {
  week: number;
  total_predictions: number;
  correct_predictions: number;
  success_rate: number;
  predictions: Array<{
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
  }>;
}

// Helper function to get team logo path
const getTeamLogoPath = (teamName: string): string => {
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
      <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center">
        <span className="text-purple-800 font-bold text-sm">
          {teamName.charAt(0)}
        </span>
      </div>
    );
  }

  return (
    <img
      src={logoPath}
      alt={alt}
      className="w-10 h-10 object-contain"
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
  let badgeClass = `min-w-[32px] h-6 px-2 rounded-md grid place-items-center text-xs font-semibold border relative `;

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
        <span className="absolute -top-1 -right-1 text-green-600 text-xs">✓</span>
      )}
      {isSelected && isCorrect === false && (
        <span className="absolute -top-1 -right-1 text-red-600 text-xs">✗</span>
      )}
    </div>
  );
};

// Simple circular meter component
const CircularMeter: React.FC<{
  percent: number;
  onShare: () => void;
  shareEnabled: boolean;
}> = ({ percent, onShare, shareEnabled }) => {
  const radius = 45;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percent / 100) * circumference;

  return (
    <div className="flex items-center justify-center">
      <div className="relative w-24 h-24">
        <svg
          className="w-24 h-24 transform -rotate-90"
          viewBox="0 0 100 100"
        >
          {/* Background circle */}
          <circle
            cx="50"
            cy="50"
            r={radius}
            stroke="currentColor"
            strokeWidth="8"
            fill="transparent"
            className="text-gray-200"
          />
          {/* Progress circle */}
          <circle
            cx="50"
            cy="50"
            r={radius}
            stroke="currentColor"
            strokeWidth="8"
            fill="transparent"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            className="text-indigo-600 transition-all duration-500 ease-in-out"
            strokeLinecap="round"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-lg font-bold text-gray-900">{Math.round(percent)}%</span>
        </div>
      </div>
      {shareEnabled && (
        <button
          onClick={onShare}
          className="ml-4 p-2 rounded-full bg-indigo-600 text-white hover:bg-indigo-700 transition-colors"
          title="Condividi risultati"
        >
          <IoShareOutline className="w-4 h-4" />
        </button>
      )}
    </div>
  );
};

const TestRisultatiPageContent = React.memo(function TestRisultatiPageContent() {
  console.log('[TestRisultati] 🚀 COMPONENT MOUNTING/RENDERING', {
    timestamp: new Date().toISOString(),
    renderCount: Math.random() // Random number to track re-renders
  });

  const router = useRouter();
  const searchParams = useSearchParams();
  const { firebaseUser } = useAuthContext();

  // State for selected week (like original)
  const [selectedWeek, setSelectedWeek] = useState<number>(1);

  const userKey = firebaseUser?.uid || null;

  // Data cache for preloaded weeks
  const [weekDataCache, setWeekDataCache] = useState<Map<number, {
    weeklyStats: WeeklyStatsResponse | null;
    fixtures: Fixture[];
    loading: boolean;
    error: string | null;
    timestamp: number;
  }>>(new Map());

  // Global loading state (only for initial load)
  const [globalLoading, setGlobalLoading] = useState(true);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [isResetting, setIsResetting] = useState(false);
  const [shareSupported, setShareSupported] = useState(false);

  // Get current week data from cache - memoized to prevent re-renders
  const currentWeekData = useMemo(() => weekDataCache.get(selectedWeek), [weekDataCache, selectedWeek]);
  const weeklyStats = useMemo(() => currentWeekData?.weeklyStats || null, [currentWeekData]);
  const fixtures = useMemo(() => currentWeekData?.fixtures || [], [currentWeekData]);

  // Derived states for current week - only show loading for uncached weeks
  const loading = globalLoading || (!currentWeekData && !globalLoading);
  const error = globalError || currentWeekData?.error || null;

  // Debug cache performance
  useEffect(() => {
    if (currentWeekData) {
      console.log(`[TestRisultati] 🎯 CACHE HIT for week ${selectedWeek}:`, {
        hasStats: !!currentWeekData.weeklyStats,
        fixturesCount: currentWeekData.fixtures.length,
        timestamp: new Date(currentWeekData.timestamp).toISOString()
      });
    } else {
      console.log(`[TestRisultati] ❌ CACHE MISS for week ${selectedWeek}`);
    }
  }, [selectedWeek, currentWeekData]);

  // Animation state (exact same types as original)
  const [navDir, setNavDir] = useState<1 | -1 | 0>(0);
  const [pendingWeekForUrl, setPendingWeekForUrl] = useState<number | null>(null);


  // Initialize week from query string on mount only - DISABLED FOR TESTING
  // useEffect(() => {
  //   if (!searchParams) return;
  //   const qWeek = searchParams.get('week');
  //   const w = qWeek ? Number(qWeek) : NaN;
  //   if (Number.isFinite(w) && w >= 1 && w <= 38) {
  //     setSelectedWeek(w);
  //   }
  // }, [searchParams]);

  // Component lifecycle tracking
  useEffect(() => {
    console.log('[TestRisultati] 🎯 COMPONENT MOUNTED', {
      timestamp: new Date().toISOString(),
      selectedWeek,
      userKey
    });

    return () => {
      console.log('[TestRisultati] 💀 COMPONENT UNMOUNTING', {
        timestamp: new Date().toISOString(),
        selectedWeek
      });
    };
  }, []);

  // Cache management functions
  const updateWeekCache = useCallback((week: number, data: {
    weeklyStats?: WeeklyStatsResponse | null;
    fixtures?: Fixture[];
    loading?: boolean;
    error?: string | null;
  }) => {
    setWeekDataCache(prev => {
      const newCache = new Map(prev);
      const existing = newCache.get(week) || {
        weeklyStats: null,
        fixtures: [],
        loading: false,
        error: null,
        timestamp: Date.now()
      };

      newCache.set(week, {
        ...existing,
        ...data,
        timestamp: Date.now()
      });

      console.log(`[TestRisultati] 💾 Cache updated for week ${week}:`, data);
      return newCache;
    });
  }, []);

  const isWeekCached = useCallback((week: number) => {
    const cached = weekDataCache.get(week);
    const isValid = cached && !cached.loading && !cached.error;
    console.log(`[TestRisultati] 🔍 Cache check week ${week}:`, { isValid, cached: !!cached });
    return isValid;
  }, [weekDataCache]);

  // Check for share support
  useEffect(() => {
    setShareSupported(typeof navigator !== 'undefined' && !!navigator.share);
  }, []);

  // Single week data fetcher (for cache)
  const fetchWeekData = useCallback(async (week: number): Promise<void> => {
    if (!userKey || isWeekCached(week)) {
      console.log(`[TestRisultati] ⚡ Skipping fetch for week ${week} (cached or no user)`);
      return;
    }

    console.log(`[TestRisultati] 📡 Fetching data for user ${userKey}, week ${week}`);

    // Mark as loading
    updateWeekCache(week, { loading: true, error: null });

    try {
      // Fetch weekly stats and fixtures in parallel
      const [stats, fixturesResponse] = await Promise.all([
        apiClient.getTestWeeklyStats(userKey, week),
        apiClient.getFixturesByWeek(week)
      ]);

      const fixturesData = Array.isArray(fixturesResponse) ? fixturesResponse : fixturesResponse?.data ?? [];

      // Update cache with successful data
      updateWeekCache(week, {
        weeklyStats: stats,
        fixtures: fixturesData,
        loading: false,
        error: null
      });

      console.log(`[TestRisultati] ✅ Week ${week} loaded: ${stats.predictions.length} predictions, ${fixturesData.length} fixtures`);
    } catch (err) {
      console.error(`[TestRisultati] ❌ Error fetching week ${week}:`, err);
      updateWeekCache(week, {
        loading: false,
        error: err instanceof Error ? err.message : 'Failed to load data'
      });
    }
  }, [userKey, isWeekCached, updateWeekCache]);

  // Preload multiple weeks (10-week lookahead for maximum smoothness)
  const preloadWeeks = useCallback(async (centerWeek: number) => {
    const weeksToPreload = [
      centerWeek - 2,  // 2 weeks back
      centerWeek - 1,  // 1 week back
      centerWeek,      // Current week
      centerWeek + 1,  // 1 week forward
      centerWeek + 2,  // 2 weeks forward
      centerWeek + 3,  // 3 weeks forward
      centerWeek + 4,  // 4 weeks forward
      centerWeek + 5,  // 5 weeks forward
      centerWeek + 6,  // 6 weeks forward
      centerWeek + 7   // 7 weeks forward
    ].filter(w => w >= 1 && w <= 38); // Valid week range

    console.log(`[TestRisultati] 🔄 Preloading 10 weeks around ${centerWeek}:`, weeksToPreload);

    // Fetch all weeks in parallel for maximum speed
    await Promise.all(weeksToPreload.map(week => fetchWeekData(week)));

    console.log(`[TestRisultati] ✅ 10-week preloading completed for weeks:`, weeksToPreload);
  }, [fetchWeekData]);

  // Initial data loading and preloading
  useEffect(() => {
    if (!userKey) return;

    const loadInitialData = async () => {
      console.log(`[TestRisultati] 🚀 Initial load starting - will preload 10 weeks around week ${selectedWeek}`);
      setGlobalLoading(true);
      setGlobalError(null);

      try {
        // Preload 10 weeks around selected week for ultra-smooth navigation
        await preloadWeeks(selectedWeek);

        console.log(`[TestRisultati] 🔍 10-week preload completed for week ${selectedWeek}`);
        // Note: currentData will be checked via the derived state, not here
      } catch (err) {
        console.error('[TestRisultati] ❌ Initial 10-week preload failed:', err);
        setGlobalError(err instanceof Error ? err.message : 'Failed to load data');
      } finally {
        setGlobalLoading(false);
      }
    };

    loadInitialData();
  }, [userKey]); // Only trigger on userKey change, not selectedWeek

  // Background preloading when week changes - debounced to prevent excessive calls
  useEffect(() => {
    if (!userKey || globalLoading) return;

    const timer = setTimeout(() => {
      console.log(`[TestRisultati] 📍 Week changed to ${selectedWeek}, checking preload needs`);

      // Check if current week is cached, if not trigger preload
      if (!isWeekCached(selectedWeek)) {
        console.log(`[TestRisultati] 🔄 Week ${selectedWeek} not cached, triggering background preload`);
        preloadWeeks(selectedWeek);
      } else {
        console.log(`[TestRisultati] ✅ Week ${selectedWeek} already cached, skipping preload`);
      }
    }, 100); // Small delay to debounce rapid week changes

    return () => clearTimeout(timer);
  }, [selectedWeek, userKey, globalLoading, isWeekCached, preloadWeeks]);

  // Helper function to get prediction data for a fixture
  const getPredictionData = (fixtureId: number) => {
    const backendPred = weeklyStats?.predictions.find(
      p => parseInt(p.fixture_id) === fixtureId
    );
    return {
      choice: backendPred?.choice,
      isCorrect: backendPred?.is_correct,
      actualResult: backendPred?.result
    };
  };

  // Optimized week navigation - no immediate re-fetching since data is cached
  const updateWeek = useCallback((w: number) => {
    console.log('[TestRisultati] 🔄 updateWeek called', { from: selectedWeek, to: w, timestamp: new Date().toISOString() });
    const next = Math.max(1, Math.min(38, w));

    // Check if target week is already cached
    const isCached = isWeekCached(next);
    console.log('[TestRisultati] 📊 Navigation target', { next, isCached, currentCached: isWeekCached(selectedWeek) });

    setNavDir(next > selectedWeek ? 1 : -1);
    setSelectedWeek(next);
    setPendingWeekForUrl(next);

    console.log('[TestRisultati] ✅ State updates queued - no API calls needed due to caching');
  }, [selectedWeek, isWeekCached]);

  // Reset function
  const handleReset = async () => {
    if (!userKey || isResetting) return;

    const confirmed = window.confirm(
      'Sei sicuro di voler resettare tutte le tue previsioni? Questa azione non può essere annullata.'
    );

    if (!confirmed) return;

    try {
      setIsResetting(true);
      await apiClient.resetTestData(userKey);
      // Force page refresh to ensure clean state
      window.location.reload();
    } catch (error) {
      console.error('❌ Failed to reset test data:', error);
      alert('Errore durante il reset. Riprova più tardi.');
    } finally {
      setIsResetting(false);
    }
  };

  // Share function
  const handleShare = async () => {
    try {
      const shareData = {
        title: 'Swipick - Risultati Test Mode',
        text: `Scopri i miei risultati della Giornata ${selectedWeek} su Swipick!`,
        url: window.location.origin,
      };

      if (navigator.share && navigator.canShare?.(shareData)) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(window.location.origin);
      }
    } catch (error) {
      console.log('Error sharing:', error);
    }
  };

  // Calculate performance metrics - stabilized with JSON.stringify for deep comparison
  const performanceMetrics = useMemo(() => {
    if (!weeklyStats) {
      return { correct: 0, total: 0, accuracy: 0 };
    }
    return {
      correct: weeklyStats.correct_predictions,
      total: weeklyStats.total_predictions,
      accuracy: weeklyStats.success_rate
    };
  }, [weeklyStats]);

  // Date range calculation - OPTIMIZED to reduce re-renders
  const dateRange = useMemo(() => {
    if (fixtures.length === 0) return null;

    // Handle different date formats and filter out invalid dates
    const validDates = fixtures
      .map(f => {
        // Try different date field names
        const dateValue = f.date || f.kickoff || f.datetime || f.match_date;
        if (!dateValue) return null;

        // Try different date formats
        let date = new Date(dateValue);
        if (isNaN(date.getTime())) {
          // Try ISO format if direct parsing fails
          date = new Date(dateValue + 'T00:00:00.000Z');
        }
        if (isNaN(date.getTime())) return null;

        return date;
      })
      .filter(date => date !== null)
      .sort((a, b) => a.getTime() - b.getTime());

    if (validDates.length === 0) return null;

    const min = validDates[0];
    const max = validDates[validDates.length - 1];

    const toIt = (d: Date) => {
      try {
        return d.toLocaleDateString('it-IT', { day: '2-digit', month: 'numeric' });
      } catch {
        return d.getDate() + '/' + (d.getMonth() + 1);
      }
    };

    return `dal ${toIt(min)} al ${toIt(max)}`;
  }, [fixtures]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Caricamento risultati...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <p className="text-red-600 mb-2">Errore nel caricamento</p>
            <p className="text-gray-600 text-sm">{error}</p>
            <button
              onClick={() => router.push('/gioca?mode=test')}
              className="mt-4 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
            >
              Torna al Gioco
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Sticky Header with Navigation and Meter */}
      <div className="sticky top-0 z-30 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/70 pointer-events-none">
        {/* Top Header Panel */}
        <div
          className="w-full mx-0 mt-0 mb-2 rounded-b-2xl rounded-t-none text-white pointer-events-auto"
          style={{ background: 'radial-gradient(circle at center, #554099, #3d2d73)', boxShadow: '0 8px 16px rgba(85, 64, 153, 0.3), 0 4px 8px rgba(0, 0, 0, 0.2)' }}
        >
          {/* Test Mode lozenge with Reset button */}
          <div className="pt-3 px-4 flex justify-center">
            <div
              className="inline-flex items-center gap-2 rounded-full px-3 py-1 max-w-full min-w-0 overflow-hidden mx-auto"
              style={{ backgroundColor: '#A9BA9D', color: '#043927' }}
            >
              <span className="text-[11px] font-semibold truncate">MODALITÀ TEST - Dati storici Serie A 2023-24</span>
              <button
                onClick={(e) => {
                  console.log('[TestRisultati] 🔄 RESET BUTTON CLICKED', {
                    timestamp: new Date().toISOString(),
                    event: e.type,
                    target: e.target,
                    isResetting
                  });
                  handleReset();
                  console.log('[TestRisultati] 🔄 handleReset call completed');
                }}
                disabled={isResetting}
                className="text-xs font-semibold rounded-full px-2 py-0.5"
                style={{ backgroundColor: '#780606', color: '#ffffff' }}
                title="Reimposta Test Mode"
              >
                {isResetting ? 'Reset...' : 'Reset'}
              </button>
            </div>
          </div>

          <div className="relative px-4 pt-10 pb-6">
            {/* Previous week (left) */}
            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-white text-sm opacity-30">
              {selectedWeek > 1 ? (
                <button
                  onClick={(e) => {
                    console.log('[TestRisultati] ⬅️ PREV WEEK BUTTON CLICKED', {
                      currentWeek: selectedWeek,
                      targetWeek: selectedWeek - 1,
                      timestamp: new Date().toISOString(),
                      event: e.type,
                      target: e.target
                    });
                    updateWeek(selectedWeek - 1);
                    console.log('[TestRisultati] ⬅️ updateWeek call completed for prev week');
                  }}
                  className="font-medium hover:opacity-60 transition-opacity cursor-pointer"
                >
                  <div>Giornata {selectedWeek - 1}</div>
                </button>
              ) : (
                <div className="h-6 select-none" />
              )}
            </div>

            {/* Center current week */}
            <div className="text-center">
              <div className="text-2xl font-bold">Giornata {selectedWeek}</div>
              {dateRange && (
                <div className="mt-2 text-white text-opacity-90">
                  <span>{dateRange}</span>
                </div>
              )}
            </div>

            {/* Next week (right) */}
            <div className="absolute right-4 top-1/2 -translate-y-1/2 text-white text-sm opacity-60 text-right">
              <button
                onClick={(e) => {
                  console.log('[TestRisultati] ➡️ NEXT WEEK BUTTON CLICKED', {
                    currentWeek: selectedWeek,
                    targetWeek: selectedWeek + 1,
                    timestamp: new Date().toISOString(),
                    event: e.type,
                    target: e.target
                  });
                  updateWeek(selectedWeek + 1);
                  console.log('[TestRisultati] ➡️ updateWeek call completed for next week');
                }}
                className="font-medium hover:opacity-80 transition-opacity cursor-pointer"
              >
                <div>Giornata {selectedWeek + 1}</div>
              </button>
            </div>
          </div>
        </div>

        {/* Circular Meter */}
        <div className="px-4 pb-2 pointer-events-auto">
          <CircularMeter
            percent={performanceMetrics.accuracy}
            onShare={handleShare}
            shareEnabled={shareSupported}
          />
        </div>
      </div>

      {/* Animated Content */}
      <AnimatePresence
        initial={false}
        mode="wait"
        onExitComplete={() => {
          console.log('[TestRisultati] 🎬 ANIMATION EXIT COMPLETE', {
            pendingWeekForUrl,
            timestamp: new Date().toISOString()
          });
          setPendingWeekForUrl(null);
          console.log('[TestRisultati] 🎬 setPendingWeekForUrl(null) called');
        }}
      >
        <motion.div
          key={`week-${selectedWeek}`}
          initial={{ x: navDir === 0 ? 0 : navDir * 80, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: navDir === 0 ? 0 : -navDir * 80, opacity: 0 }}
          transition={{ duration: 0.22, ease: 'easeOut' }}
        >
          {/* Results List */}
          <div className="flex-1 px-4 py-4">
            <div className="space-y-3 max-w-md mx-auto">
              {fixtures.map((fixture) => {
                const predictionData = getPredictionData(fixture.id);
                const kickoff = new Date(fixture.date).toLocaleDateString('it-IT', {
                  weekday: 'short',
                  day: '2-digit',
                  month: '2-digit',
                  hour: '2-digit',
                  minute: '2-digit'
                });

                // Handle different data structures
                const homeName = fixture.teams?.home?.name || fixture.homeTeam || fixture.home_team || 'Home Team';
                const awayName = fixture.teams?.away?.name || fixture.awayTeam || fixture.away_team || 'Away Team';
                const homeLogo = fixture.teams?.home?.logo;
                const awayLogo = fixture.teams?.away?.logo;

                return (
                  <div
                    key={fixture.id}
                    className="bg-white rounded-xl p-4 shadow-sm border border-gray-200 flex items-center"
                  >
                    {/* Teams section */}
                    <div className="flex-1">
                      {/* Home team */}
                      <div className="flex items-center gap-2 mb-1">
                        <TeamLogo
                          src={homeLogo}
                          alt={homeName}
                          teamName={homeName}
                        />
                        <span className="text-sm font-medium text-black">
                          {homeName}
                        </span>
                      </div>

                      {/* Away team */}
                      <div className="flex items-center gap-2">
                        <TeamLogo
                          src={awayLogo}
                          alt={awayName}
                          teamName={awayName}
                        />
                        <span className="text-sm font-medium text-black">
                          {awayName}
                        </span>
                      </div>
                    </div>

                    {/* Kickoff time */}
                    <div className="mx-3">
                      <div className="px-2 py-1 rounded-md border text-xs text-gray-700 border-gray-200 whitespace-nowrap">
                        {kickoff}
                      </div>
                    </div>

                    {/* Choice badges with results */}
                    <div className="flex flex-col gap-1 items-center">
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
        </motion.div>
      </AnimatePresence>

      {/* Bottom Navigation (3-tab navbar matching original) */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t pb-[max(env(safe-area-inset-bottom),0px)]">
        <div className="flex">
          <div className="flex-1 text-center py-4 border-b-2 border-purple-600">
            <div className="text-purple-600 mb-1">
              <FaMedal className="w-6 h-6 mx-auto" />
            </div>
            <span className="text-xs text-purple-600 font-medium">Risultati</span>
          </div>
          <button
            onClick={(e) => {
              console.log('[TestRisultati] ⚽ GIOCA NAV BUTTON CLICKED', {
                selectedWeek,
                timestamp: new Date().toISOString(),
                event: e.type,
                target: e.target
              });
              router.push(`/gioca?mode=test&week=${selectedWeek}`);
              console.log('[TestRisultati] ⚽ router.push call completed');
            }}
            className="flex-1 text-center py-4"
          >
            <div className="text-gray-500 mb-1">
              <RiFootballLine className="w-6 h-6 mx-auto" />
            </div>
            <span className="text-xs text-black">Gioca</span>
          </button>
          <button
            onClick={(e) => {
              console.log('[TestRisultati] 👤 PROFILO NAV BUTTON CLICKED', {
                selectedWeek,
                timestamp: new Date().toISOString(),
                event: e.type,
                target: e.target
              });
              const params = new URLSearchParams({ mode: 'test' });
              params.set('week', String(selectedWeek));
              router.push(`/profilo?${params.toString()}`);
              console.log('[TestRisultati] 👤 router.push call completed');
            }}
            className="flex-1 text-center py-4"
          >
            <div className="text-gray-500 mb-1">
              <BsFillFilePersonFill className="w-6 h-6 mx-auto" />
            </div>
            <span className="text-xs text-black">Profilo</span>
          </button>
        </div>
      </div>
    </div>
  );
});

export default function TestRisultatiPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="text-black text-xl">Caricamento...</div>
        </div>
      }
    >
      <TestRisultatiPageContent />
    </Suspense>
  );
}