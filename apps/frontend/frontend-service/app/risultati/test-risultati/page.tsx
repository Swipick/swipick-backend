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
import { Toast } from '@/src/components/Toast';
import confetti from 'canvas-confetti';
import { useVirtualClock } from '../../gioca/components/VirtualClock/VirtualClock';
import { calculateActiveWeek, WeekInfo } from '../../gioca/utils/weekCalculator';

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
  // Score fields from fixtures table (snake_case)
  home_score?: number | null;
  away_score?: number | null;
  // Score fields from test_fixtures table (camelCase from TestFixture entity)
  homeScore?: number | null;
  awayScore?: number | null;
  result?: '1' | 'X' | '2' | null;
  status?: 'SCHEDULED' | 'LIVE' | 'FINISHED' | 'POSTPONED' | 'CANCELLED';
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

// Semi-circular success meter (SVG half-donut) matching original design exactly
const CircularMeter: React.FC<{ percent: number; onShare?: () => void; shareEnabled?: boolean }> = ({ percent, onShare, shareEnabled = true }) => {
  const arcWidth = 200;        // slightly narrower to match requested visual
  const stroke = 16;           // thickness
  const r = (arcWidth - stroke) / 2; // radius that keeps caps inside viewBox
  const cx = arcWidth / 2;
  const cy = r + stroke / 2 + 2;     // baseline y with slight padding
  const svgW = arcWidth;
  const svgH = cy + stroke / 2;      // enough room for rounded caps

  // Trim 10° off each side (start at 170°, end at 10°)
  const trim = 10 * (Math.PI / 180);
  const startAng = Math.PI - trim;   // 180° - 10°
  const endAng = 0 + trim;           // 0° + 10°
  const sx = cx + r * Math.cos(startAng);
  const sy = cy - r * Math.sin(startAng);
  const ex = cx + r * Math.cos(endAng);
  const ey = cy - r * Math.sin(endAng);
  const d = `M ${sx} ${sy} A ${r} ${r} 0 0 1 ${ex} ${ey}`; // trimmed top arc
  const clamped = Math.max(0, Math.min(100, Math.round(percent)));

  return (
    <div className="flex flex-col items-center justify-center py-3">
      <div className="relative" style={{ width: svgW, height: svgH }}>
        <svg width={svgW} height={svgH} viewBox={`0 0 ${svgW} ${svgH}`}>
          <defs>
            <linearGradient id="meterGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#c4b5fd" />
              <stop offset="100%" stopColor="#7c3aed" />
            </linearGradient>
          </defs>
          {/* Remaining track */}
          <path d={d} stroke="#ece9f7" strokeWidth={stroke} fill="none" strokeLinecap="round" />
          {/* Progress arc: normalized to 100 via pathLength; rounded ends */}
          <path
            d={d}
            stroke="url(#meterGradient)"
            strokeWidth={stroke}
            fill="none"
            strokeLinecap="round"
            pathLength={100}
            strokeDasharray={`${clamped} ${100 - clamped}`}
            style={{ transition: 'stroke-dasharray 300ms ease' }}
          />
        </svg>
        {/* Centered percentage label inside the semi circle */}
        <div
          className="absolute text-black font-bold"
          style={{ left: '50%', top: '58%', transform: 'translate(-50%, -50%)', fontSize: 28 }}
        >
          {clamped}%
        </div>
      </div>
      <button
        onClick={onShare}
        disabled={!shareEnabled}
        aria-label="Condividi risultato"
        title={shareEnabled ? 'Condividi risultato' : 'Condivisione disponibile su mobile/PWA'}
        className={`mt-2 inline-flex items-center justify-center gap-2 px-2 py-4 rounded-xl text-sm font-medium w-[200px] shadow transition ${shareEnabled ? 'bg-indigo-800 text-white hover:bg-indigo-700' : 'bg-gray-200 text-gray-500 cursor-not-allowed'}`}
      >
        <IoShareOutline size={18} />
        Condividi risultato
      </button>
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

  // Helper function to clear prediction localStorage when virtual time changes
  const clearPredictionLocalStorage = useCallback(() => {
    if (!userKey) return;

    try {
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.includes('swipick:gioca:') && key.includes(`:user:${userKey}`)) {
          keysToRemove.push(key);
        }
      }

      keysToRemove.forEach(key => {
        localStorage.removeItem(key);
        console.log(`[TestRisultati] 🧹 Cleared prediction localStorage (virtual time change): ${key}`);
      });

      if (keysToRemove.length > 0) {
        console.log(`[TestRisultati] ✅ Cleared ${keysToRemove.length} prediction localStorage keys for virtual time progression`);
      }
    } catch (error: unknown) {
      console.warn('Failed to clear prediction localStorage:', error);
    }
  }, [userKey]);

  // Virtual clock for test mode - re-enabled to get correct active week calculation
  const { virtualTime, formatDisplay } = useVirtualClock();

  // Dynamic active week state based on virtual time
  const [activeWeekInfo, setActiveWeekInfo] = useState<WeekInfo>({ activeWeek: 4, status: 'prediction' });

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

  // Revealed state for tracking which predictions have been revealed (like original)
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  const [toast, setToast] = useState<string | null>(null);

  // Track recently revealed fixture for confetti (like original)
  const [recentlyRevealed, setRecentlyRevealed] = useState<{ id: string; origin?: { x: number; y: number } } | null>(null);

  // Stored final week scores
  const [storedFinalScore, setStoredFinalScore] = useState<{ revealed: number; correct: number; percent: number } | null>(null);
  const [finalScoreLoading, setFinalScoreLoading] = useState(false);

  // Calculate active week and fetch fixtures based on virtual time
  useEffect(() => {
    const updateActiveWeek = async () => {
      try {
        // Calculate which week should be active for predictions
        const weekInfo = await calculateActiveWeek(virtualTime);
        setActiveWeekInfo(weekInfo);
        console.log(`[TestRisultati] Active week updated: ${weekInfo.activeWeek}, status: ${weekInfo.status}`);
      } catch (error: unknown) {
        console.warn('Could not calculate active week:', error);
      }
    };

    updateActiveWeek();
  }, [virtualTime]); // Recalculate when virtual time changes

  // Use dynamic virtual current week based on virtual time
  const VIRTUAL_CURRENT_WEEK = activeWeekInfo.activeWeek;

  console.log(`[TestRisultati] 🔍 Virtual Week Analysis:`, {
    selectedWeek,
    VIRTUAL_CURRENT_WEEK,
    virtualTime: virtualTime.toISOString(),
    activeWeekStatus: activeWeekInfo.status,
    isPastWeek: selectedWeek < VIRTUAL_CURRENT_WEEK
  });

  // Fire indigo/white confetti burst (like original risultati)
  const fireConfetti = useCallback((origin?: { x: number; y: number }) => {
    try {
      const colors = ['#6366f1', '#ffffff']; // indigo-500 and white (matching original)
      const count = 50;
      const spread = 60;
      const startVelocity = 45;
      const decay = 0.9;
      const gravity = 1;
      const ticks = 200;

      const opts: confetti.Options = {
        particleCount: count,
        spread,
        startVelocity,
        decay,
        gravity,
        ticks,
        colors,
        disableForReducedMotion: true,
      };

      if (origin) {
        // Fire from button origin (normalized to canvas coordinates)
        opts.origin = {
          x: origin.x / window.innerWidth,
          y: origin.y / window.innerHeight,
        };
      } else {
        // Default center burst
        opts.origin = { x: 0.5, y: 0.5 };
      }

      confetti(opts);
    } catch (e) {
      console.warn('[TestRisultati] Confetti error:', e);
    }
  }, []);

  // LocalStorage key for reveal state (like regular risultati)
  const revealKey = useMemo(() => {
    return userKey ? `swipick:risultati:reveal:test:week:${selectedWeek}:user:${userKey}` : null;
  }, [userKey, selectedWeek]);

  // Reveal logic using same virtual time calculation as TestGameHeader
  useEffect(() => {
    if (!revealKey) return;

    console.log(`[TestRisultati] 📊 Test mode reveal logic:`, {
      selectedWeek,
      VIRTUAL_CURRENT_WEEK: activeWeekInfo.activeWeek,
      shouldAutoReveal: selectedWeek < activeWeekInfo.activeWeek,
      virtualTimeStatus: activeWeekInfo.status
    });

    // For weeks before the virtual current week, load saved reveal state (no auto-reveal)
    // This allows users to experience button clicks and confetti for past weeks
    if (selectedWeek < activeWeekInfo.activeWeek) {
      console.log(`[TestRisultati] 📅 Loading reveal state for past week ${selectedWeek} (virtual current week ${activeWeekInfo.activeWeek})`);
      // Continue to load saved reveal state from localStorage (same as current/future weeks)
    }

    // For current and future weeks, load saved reveal state from localStorage
    try {
      const raw = localStorage.getItem(revealKey);
      if (raw) {
        const parsed = JSON.parse(raw) as string[];
        const map: Record<string, boolean> = {};
        parsed.forEach((id) => {
          map[id] = true;
        });
        setRevealed(map);
        console.log(`[TestRisultati] 🔄 Loaded reveal state for week ${selectedWeek}:`, parsed);
      } else {
        setRevealed({});
        console.log(`[TestRisultati] 🆕 No saved reveal state for week ${selectedWeek}, starting fresh`);
      }
    } catch {
      setRevealed({});
      console.log(`[TestRisultati] ❌ Failed to load reveal state for week ${selectedWeek}, starting fresh`);
    }
  }, [revealKey, selectedWeek, fixtures, activeWeekInfo]);

  // Persist reveal state to localStorage (for all weeks)
  useEffect(() => {
    if (!revealKey) return;

    try {
      const ids = Object.entries(revealed)
        .filter(([, v]) => v)
        .map(([k]) => k);
      localStorage.setItem(revealKey, JSON.stringify(ids));
    } catch {}
  }, [revealed, revealKey]);

  // Reveal function with virtual timing logic
  const onReveal = useCallback(async (fixtureId: string, anchorEl?: HTMLElement) => {
    // For current and future virtual weeks, check if the virtual match has "finished"
    if (selectedWeek >= activeWeekInfo.activeWeek) {
      // Use virtual clock to determine if match has been played
      const fixture = fixtures.find(f => String(f.id) === fixtureId);
      if (fixture) {
        // Get match date from fixture
        const matchDate = new Date(fixture.date || fixture.kickoff || fixture.datetime || fixture.match_date || '');

        // Add 2 hours (120 minutes) to match start time to simulate match completion
        const matchEndTime = new Date(matchDate.getTime() + (120 * 60 * 1000));

        // Check if virtual time has passed the match end time
        const virtuallyFinished = virtualTime.getTime() >= matchEndTime.getTime();

        if (!virtuallyFinished) {
          setToast('La partita non è ancora terminata');
          setTimeout(() => setToast(null), 3000); // Auto-dismiss after 3 seconds
          console.log(`[TestRisultati] 🚫 Reveal blocked - virtual match not finished yet:`, {
            fixtureId,
            week: selectedWeek,
            matchDate: matchDate.toISOString(),
            matchEndTime: matchEndTime.toISOString(),
            virtualTime: virtualTime.toISOString(),
            reason: 'virtual match still in progress or not started'
          });
          return;
        }

        console.log(`[TestRisultati] ✅ Reveal allowed - virtual match finished:`, {
          fixtureId,
          week: selectedWeek,
          matchEndTime: matchEndTime.toISOString(),
          virtualTime: virtualTime.toISOString()
        });
      }
    } else {
      // For past weeks, always allow reveals (no time restrictions)
      console.log(`[TestRisultati] ✅ Reveal allowed - past week ${selectedWeek} (virtual current week ${activeWeekInfo.activeWeek})`);
    }

    // Allow reveal
    setRevealed(prev => ({ ...prev, [fixtureId]: true }));

    // Compute viewport-based origin from the clicked button (if provided) and store context
    let origin: { x: number; y: number } | undefined;
    if (anchorEl) {
      try {
        const rect = anchorEl.getBoundingClientRect();
        origin = {
          x: rect.left + rect.width / 2,
          y: rect.top + rect.height / 2,
        };
      } catch {
        origin = undefined;
      }
    }

    // Set recently revealed context for confetti triggering
    setRecentlyRevealed({ id: fixtureId, origin });

    console.log(`[TestRisultati] 🔍 Revealed fixture ${fixtureId} in week ${selectedWeek}`);
  }, [selectedWeek, fixtures, userKey, activeWeekInfo, virtualTime]);

  // Helper function to get prediction data for a fixture
  const getPredictionData = useCallback((fixtureId: number) => {
    const backendPred = weeklyStats?.predictions.find(
      p => parseInt(p.fixture_id) === fixtureId
    );

    const result = {
      choice: backendPred?.choice || null,
      isCorrect: backendPred?.is_correct || false,
      actualResult: backendPred?.result || null
    };

    // Debug logging for week 6+ to see what's happening
    if (selectedWeek >= 6 && !backendPred) {
      console.log(`[TestRisultati] 🚫 No prediction found for fixture ${fixtureId} in week ${selectedWeek}`, {
        totalPredictions: weeklyStats?.predictions?.length || 0,
        availableFixtureIds: weeklyStats?.predictions?.map(p => p.fixture_id) || [],
        searchingFor: fixtureId
      });
    } else if (selectedWeek >= 6 && backendPred) {
      console.log(`[TestRisultati] ✅ Found prediction for fixture ${fixtureId}:`, {
        choice: backendPred.choice,
        isCorrect: backendPred.is_correct,
        result: backendPred.result
      });
    }

    return result;
  }, [weeklyStats, selectedWeek]);

  // When a reveal occurs, check correctness and fire confetti if correct (like original)
  useEffect(() => {
    const ctx = recentlyRevealed;
    if (!ctx) return;
    const fid = ctx.id;

    // Ensure it's marked revealed in state first
    if (!revealed[fid]) return;

    // Try to compute correctness from available data
    const predictionData = getPredictionData(Number(fid));
    if (!predictionData) {
      console.log(`[TestRisultati] No prediction data for fixture ${fid}`);
      setRecentlyRevealed(null);
      return;
    }

    const userChoice = predictionData.choice;
    const actualResult = predictionData.actualResult;

    if (userChoice && actualResult && userChoice === actualResult) {
      console.log(`[TestRisultati] 🎊 Correct prediction for fixture ${fid}! Firing confetti`);
      fireConfetti(ctx.origin);
    } else {
      console.log(`[TestRisultati] Prediction for fixture ${fid}:`, { userChoice, actualResult, correct: false });
    }

    // Clear context to avoid duplicate firings
    setRecentlyRevealed(null);
  }, [recentlyRevealed, revealed, fireConfetti, getPredictionData]);

  // Initialize week from query string on mount - enables dynamic week loading from game
  useEffect(() => {
    if (!searchParams) return;
    const qWeek = searchParams.get('week');
    const w = qWeek ? Number(qWeek) : NaN;
    if (Number.isFinite(w) && w >= 1 && w <= 38) {
      console.log(`[TestRisultati] 🎯 Loading week ${w} from URL parameter`);
      setSelectedWeek(w);
    } else {
      console.log(`[TestRisultati] 📍 No valid week parameter, staying on default week ${selectedWeek}`);
    }
  }, [searchParams]);

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

    console.log(`[TestRisultati] 📡 Fetching TEST MODE data for user ${userKey}, week ${week} (using test_fixtures table)`);

    // Mark as loading
    updateWeekCache(week, { loading: true, error: null });

    try {
      // Fetch weekly stats and test fixtures in parallel (using test_fixtures table)
      const [stats, fixturesResponse] = await Promise.all([
        apiClient.getTestWeeklyStats(userKey, week),
        apiClient.getTestFixturesByWeek(week)
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

      // Clear all localStorage data for this user across all test mode data
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.includes(`:user:${userKey}`) &&
           (key.includes(`swipick:risultati:reveal:test:`) ||
            key.includes(`swipick:gioca:`))) {
          keysToRemove.push(key);
        }
      }

      // Remove all localStorage keys (reveal states + predictions)
      keysToRemove.forEach(key => {
        localStorage.removeItem(key);
        if (key.includes('reveal')) {
          console.log(`[TestRisultati] 🧹 Cleared reveal state: ${key}`);
        } else {
          console.log(`[TestRisultati] 🧹 Cleared prediction data: ${key}`);
        }
      });

      // Reset API data
      await apiClient.resetTestData(userKey);

      console.log('✅ Test data, predictions, and reveal states reset successfully');

      // Small delay to ensure localStorage clearing completes before navigation
      setTimeout(() => {
        window.location.href = '/gioca?mode=test';
      }, 150);
    } catch (error: unknown) {
      console.error('❌ Failed to reset test data:', error);
      alert('Errore durante il reset. Riprova più tardi.');
    } finally {
      setIsResetting(false);
    }
  };

  // Compute meter based on revealed predictions only (like original)
  const meter = useMemo(() => {
    if (fixtures.length === 0) return { revealed: 0, correct: 0, percent: 0 };

    let revealedCount = 0;
    let correctCount = 0;

    for (const fixture of fixtures) {
      const fixtureId = String(fixture.id);
      if (!revealed[fixtureId]) continue; // Only count revealed predictions

      revealedCount += 1;

      // Get prediction data for this fixture
      const predictionData = getPredictionData(fixture.id);
      if (predictionData.isCorrect === true) {
        correctCount += 1;
      }
      // isCorrect === false or undefined counts as 0 (incorrect)
    }

    const percent = revealedCount > 0 ? Math.round((correctCount / revealedCount) * 100) : 0;

    // Enhanced logging for week 6+ to debug the issue
    if (selectedWeek >= 6) {
      console.log('[TestRisultati] 📊 DETAILED Meter calculation for week', selectedWeek, ':', {
        revealedCount,
        correctCount,
        percent,
        totalFixtures: fixtures.length,
        weeklyStatsExists: !!weeklyStats,
        totalPredictions: weeklyStats?.predictions?.length || 0
      });
    } else {
      console.log('[TestRisultati] 📊 Meter calculation:', { revealedCount, correctCount, percent });
    }

    return { revealed: revealedCount, correct: correctCount, percent };
  }, [fixtures, revealed, weeklyStats]); // Include weeklyStats since getPredictionData depends on it

  // Auto-save final week score when all 10 matches are revealed
  useEffect(() => {
    const saveFinalScore = async () => {
      // Only save if we have a user, valid week, and exactly 10 matches revealed
      if (!userKey || !selectedWeek || meter.revealed !== 10) return;

      // Check if we already saved this score to avoid duplicate saves
      const storageKey = `swipick:final-score-saved:test:week${selectedWeek}:user:${userKey}`;
      const alreadySaved = localStorage.getItem(storageKey);
      if (alreadySaved) {
        console.log(`[TestRisultati] 🏆 Final score already saved for week ${selectedWeek}`);
        return;
      }

      try {
        await apiClient.saveFinalWeekScore({
          userId: userKey,
          week: selectedWeek,
          revealed: meter.revealed,
          correct: meter.correct,
          mode: 'test'
        });

        // Mark as saved to prevent duplicate saves
        localStorage.setItem(storageKey, JSON.stringify({
          week: selectedWeek,
          score: meter,
          savedAt: new Date().toISOString()
        }));

        console.log(`[TestRisultati] 🏆 Final week score saved for week ${selectedWeek}:`, meter);
      } catch (error: unknown) {
        console.error(`[TestRisultati] ❌ Failed to save final week score for week ${selectedWeek}:`, error);
      }
    };

    saveFinalScore();
  }, [userKey, selectedWeek, meter]); // Trigger when meter changes

  // Load stored final score for current week
  useEffect(() => {
    const loadStoredFinalScore = async () => {
      if (!userKey || !selectedWeek) return;

      setFinalScoreLoading(true);
      try {
        const storedScore = await apiClient.getFinalWeekScore(userKey, selectedWeek, 'test');
        if (storedScore) {
          setStoredFinalScore({
            revealed: storedScore.revealed || 0,
            correct: storedScore.correct || 0,
            percent: storedScore.percent || 0
          });
          console.log(`[TestRisultati] 📥 Loaded stored final score for week ${selectedWeek}:`, storedScore);
        } else {
          setStoredFinalScore(null);
          console.log(`[TestRisultati] 📭 No stored final score found for week ${selectedWeek}`);
        }
      } catch (error: unknown) {
        // Silently handle 404 errors (no stored score exists yet)
        if ((error as Error).message?.includes('Final week score not found')) {
          console.log(`[TestRisultati] 📭 No stored final score found for week ${selectedWeek} (as expected)`);
        } else {
          console.error(`[TestRisultati] ❌ Failed to load stored final score for week ${selectedWeek}:`, error);
        }
        setStoredFinalScore(null);
      } finally {
        setFinalScoreLoading(false);
      }
    };

    loadStoredFinalScore();
  }, [userKey, selectedWeek]); // Load when user or week changes

  // Display meter: Use stored final score if available and complete, otherwise use live meter
  const displayMeter = useMemo(() => {
    // If we have a stored final score and it's complete (10/10), use that
    if (storedFinalScore && storedFinalScore.revealed === 10) {
      return {
        ...storedFinalScore,
        isStored: true,
        label: 'Risultato Finale'
      };
    }

    // Otherwise, use live calculation for active revealing
    return {
      ...meter,
      isStored: false,
      label: meter.revealed === 10 ? 'Completato' : `${meter.revealed}/10`
    };
  }, [meter, storedFinalScore]);

  // Share handler matching original format
  const handleShare = useCallback(async () => {
    const title = `Giornata ${selectedWeek} — Swipick`;
    const text = `Ho rivelato ${displayMeter.revealed}/10: ${displayMeter.correct} corrette (${displayMeter.percent}%).`;
    const url = typeof window !== 'undefined' ? window.location.href : undefined;

    try {
      const n = typeof navigator !== 'undefined' ? navigator : undefined;
      if (n && typeof n.share === 'function') {
        await n.share({ title, text, url });
        return;
      }
      throw new Error('Web Share API not supported');
    } catch (error: unknown) {
      console.log('Error sharing:', error);
      // Could add a toast here for desktop users
    }
  }, [selectedWeek, displayMeter]);

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
          style={{ background: 'linear-gradient(to bottom, #52418d, #7a57f6)', boxShadow: '0 8px 16px rgba(85, 64, 153, 0.3), 0 4px 8px rgba(0, 0, 0, 0.2)' }}
        >
          {/* Test Mode indicator with Reset button */}
          <div className="flex items-center justify-center gap-2 mb-2 pt-3">
            <div className="inline-block px-2 py-1 text-xs bg-white/20 rounded-full">
              Modalità Test
            </div>
            {userKey && (
              <button
                onClick={handleReset}
                disabled={isResetting}
                className="inline-flex items-center px-2 py-1 text-xs bg-red-500/80 hover:bg-red-600/80 disabled:bg-red-500/40 rounded-full transition-colors"
                title="Reset tutte le previsioni"
              >
                {isResetting ? (
                  <>
                    <svg className="animate-spin -ml-0.5 mr-1 h-3 w-3 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Reset...
                  </>
                ) : (
                  <>
                    <svg className="-ml-0.5 mr-1 h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Reset
                  </>
                )}
              </button>
            )}
          </div>

          <div className="relative px-4 pt-3 pb-6">
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

          {/* Virtual date calendar controls */}
          <div className="px-4 pb-3 border-t border-white/20 mt-3">
            <div className="text-xs text-white/80 mb-2 text-center">
              📅 Data simulata: {formatDisplay()}
            </div>

            {/* Virtual time navigation controls */}
            <div className="flex justify-center gap-2">
              <button
                onClick={() => {
                  // Clear prediction localStorage before virtual time change
                  clearPredictionLocalStorage();

                  // Rewind virtual calendar by 7 days
                  const oneWeekMs = 7 * 24 * 60 * 60 * 1000;
                  const storageKey = 'swipick:virtual-clock:reference';
                  try {
                    const stored = localStorage.getItem(storageKey);
                    if (stored) {
                      const state = JSON.parse(stored);
                      // Subtract 7 days from the virtual time offset
                      state.fastForwardOffset = (state.fastForwardOffset || 0) - oneWeekMs;
                      localStorage.setItem(storageKey, JSON.stringify(state));
                      console.log(`[TestRisultati] ⏪ Virtual time rewound by 1 week, localStorage cleared`);
                      window.location.reload(); // Refresh to apply new virtual time
                    }
                  } catch (error: unknown) {
                    console.warn('Failed to update virtual clock:', error);
                  }
                }}
                className="inline-flex items-center px-2 py-1 text-xs bg-orange-500/80 hover:bg-orange-600/80 rounded-full transition-colors"
                title="Riavvolgi il calendario di una settimana"
              >
                <svg className="-ml-0.5 mr-1 h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 15l-3-3 3-3m4 6l-3-3 3-3" />
                </svg>
                -1 Settimana
              </button>
              <button
                onClick={() => {
                  // Clear prediction localStorage before virtual time change
                  clearPredictionLocalStorage();

                  // Fast forward virtual calendar by 7 days and navigate to Gioca page
                  const oneWeekMs = 7 * 24 * 60 * 60 * 1000;
                  const storageKey = 'swipick:virtual-clock:reference';
                  try {
                    const stored = localStorage.getItem(storageKey);
                    if (stored) {
                      const state = JSON.parse(stored);
                      state.fastForwardOffset = (state.fastForwardOffset || 0) + oneWeekMs;
                      localStorage.setItem(storageKey, JSON.stringify(state));
                      console.log(`[TestRisultati] ⏩ Virtual time advanced by 1 week, localStorage cleared`);

                      // Small delay to ensure localStorage is updated, then let Gioca page auto-detect the active week
                      setTimeout(() => {
                        window.location.href = '/gioca?mode=test';
                      }, 100);
                    }
                  } catch (error: unknown) {
                    console.warn('Failed to update virtual clock:', error);
                  }
                }}
                className="inline-flex items-center px-2 py-1 text-xs bg-blue-500/80 hover:bg-blue-600/80 rounded-full transition-colors"
                title="Avanza il calendario di una settimana"
              >
                <svg className="-ml-0.5 mr-1 h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 9l3 3-3 3m-6 0l3-3-3-3" />
                </svg>
                +1 Settimana
              </button>
            </div>
          </div>
        </div>

        {/* Success Meter (matching original design) */}
        <div className="px-4 pb-2 pointer-events-auto">
          <CircularMeter
            percent={displayMeter.percent}
            onShare={handleShare}
            shareEnabled={shareSupported}
          />
          {/* Show indicator if using stored final score */}
          {displayMeter.isStored && (
            <div className="text-center mt-2">
              <span className="text-xs text-white/80 bg-green-600/80 px-2 py-1 rounded-full">
                📊 {displayMeter.label}
              </span>
            </div>
          )}
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
          {/* Results List - 4-column layout matching original */}
          <div className="flex-1 px-4 py-4 pb-24">
            <div className="space-y-3">
              {fixtures.map((fixture) => {
                const fixtureId = String(fixture.id);
                const predictionData = getPredictionData(fixture.id);

                // Handle different data structures for team names
                const homeName = fixture.teams?.home?.name || fixture.homeTeam || fixture.home_team || 'Home Team';
                const awayName = fixture.teams?.away?.name || fixture.awayTeam || fixture.away_team || 'Away Team';
                const homeLogo = fixture.teams?.home?.logo;
                const awayLogo = fixture.teams?.away?.logo;

                // Get scores from fixture data (TestFixture entity uses camelCase)
                const homeScore = fixture.homeScore;
                const awayScore = fixture.awayScore;
                const actualResult = fixture.result; // '1', 'X', '2', or null

                // Debug score data for week 6+ to see what's in the fixtures
                if (selectedWeek >= 6) {
                  console.log(`[TestRisultati] 🎯 Fixture ${fixture.id} scores:`, {
                    homeScore: homeScore,
                    awayScore: awayScore,
                    result: actualResult,
                    status: fixture.status,
                    teams: `${homeName} vs ${awayName}`
                  });
                }

                // Reveal logic: Check if this fixture has been revealed
                const fixtureIdStr = String(fixture.id);
                const isRevealed = !!revealed[fixtureIdStr];
                const statusLabel = isRevealed ? 'FINE PARTITA' : 'MOSTRA RISULTATO';
                const statusColor = isRevealed ? 'bg-gray-200 text-gray-700' : 'bg-indigo-500 bg-opacity-90 text-white';

                return (
                  <div key={fixture.id} className="bg-white rounded-2xl p-4 shadow-[0_8px_24px_rgba(0,0,0,0.06)] border border-black/5">
                    <div className="grid grid-cols-[minmax(0,1fr)_auto_auto_auto] gap-4 items-center">

                      {/* Col 1: Teams (vertical stack, no date) */}
                      <div className="flex flex-col gap-3">
                        <div className="flex items-center gap-3 h-12">
                          <div className="w-12 h-12 rounded bg-gray-50 flex items-center justify-center overflow-hidden">
                            <TeamLogo
                              src={homeLogo}
                              alt={homeName}
                              teamName={homeName}
                            />
                          </div>
                          <div className="text-black font-bold truncate">{homeName}</div>
                        </div>
                        <div className="flex items-center gap-3 h-12">
                          <div className="w-12 h-12 rounded bg-gray-50 flex items-center justify-center overflow-hidden">
                            <TeamLogo
                              src={awayLogo}
                              alt={awayName}
                              teamName={awayName}
                            />
                          </div>
                          <div className="text-black font-bold truncate">{awayName}</div>
                        </div>
                      </div>

                      {/* Col 2: Final scores (vertical stack) */}
                      <div className="grid grid-rows-2 pr-1.5">
                        <div className="h-14 flex items-center justify-center">
                          <div className="text-2xl leading-none font-semibold text-black min-w-[16px] text-center">
                            {isRevealed ? (homeScore != null ? homeScore : 'ND') : '–'}
                          </div>
                        </div>
                        <div className="h-14 flex items-center justify-center">
                          <div className="text-2xl leading-none font-semibold text-black min-w-[16px] text-center">
                            {isRevealed ? (awayScore != null ? awayScore : 'ND') : '–'}
                          </div>
                        </div>
                      </div>

                      {/* Col 3: Status button (centered) */}
                      <div className="flex items-center justify-center ml-1.5">
                        <button
                          onClick={isRevealed ? undefined : (e) => onReveal(fixtureIdStr, e.currentTarget)}
                          disabled={isRevealed}
                          className={`min-w-[72px] px-2 py-2 rounded-md text-[11px] leading-tight text-center font-medium ${statusColor} ${isRevealed ? 'opacity-100 cursor-default' : 'hover:bg-opacity-100 cursor-pointer'}`}
                        >
                          {(() => {
                            const parts = statusLabel.split(' ');
                            if (parts.length >= 2) {
                              return (
                                <>
                                  <span className="block">{parts[0]}</span>
                                  <span className="block">{parts.slice(1).join(' ')}</span>
                                </>
                              );
                            }
                            return statusLabel;
                          })()}
                        </button>
                      </div>

                      {/* Col 4: 1X2 vertical stack with correct color coding */}
                      <div className="flex flex-col items-center gap-2 ml-1.5">
                        {(['1','X','2'] as const).map((choice) => {
                          const userPicked = predictionData.choice === choice;
                          const isCorrect = isRevealed && userPicked && actualResult === choice;
                          const isWrong = isRevealed && userPicked && actualResult !== choice;

                          // When not revealed, show neutral colors like the "mostra risultato" button
                          const classes = !isRevealed
                            ? 'bg-gray-100 text-gray-700' // Neutral: match not revealed yet
                            : isCorrect
                              ? 'bg-[#ccffb3] text-[#2a8000]' // Green: correct prediction
                              : isWrong
                                ? 'bg-[#ffb3b3] text-[#cc0000]' // Red: wrong prediction
                                : 'bg-gray-100 text-gray-700'; // Gray: not picked but revealed

                          return (
                            <div key={choice} className={`w-8 h-8 rounded-md flex items-center justify-center text-sm font-semibold ${classes}`}>
                              {choice}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Toast for reveal messages */}
      {toast && (
        <Toast
          message={toast}
          onClose={() => setToast(null)}
          variant="lozenge"
        />
      )}

      {/* Bottom Navigation (3-tab navbar matching original) */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t pb-[max(env(safe-area-inset-bottom),0px)]">
        <div className="flex">
          <div className="flex-1 text-center py-4 border-b-2 border-[#6f49ff]">
            <div className="text-[#6f49ff] mb-1">
              <FaMedal className="w-6 h-6 mx-auto" />
            </div>
            <span className="text-xs text-[#6f49ff] font-medium">Risultati</span>
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
              router.push('/profilo/testProfilo');
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