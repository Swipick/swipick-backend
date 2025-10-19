'use client';

import React, { useState, useEffect, useCallback, useMemo, Suspense } from 'react';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuthContext } from '@/src/contexts/AuthContext';
import { apiClient } from '@/lib/api-client';
import { useLiveWeek } from '@/app/gioca/hooks/useLiveWeek';
import { resolveTeamLogo } from '@/lib/club-logos';
import { IoShareOutline } from 'react-icons/io5';
import { AnimatePresence, motion } from 'framer-motion';
import { BottomNav } from '@/app/gioca/components/Navigation/BottomNav';
import type { GameMode } from '@/app/gioca/types';
import { Toast } from '@/src/components/Toast';
import confetti from 'canvas-confetti';
// Gradient header is inlined; page background is white per design

// Debug flag for targeted instrumentation on Risultati page (enable with NEXT_PUBLIC_DEBUG_RISULTATI=1)
const DEBUG_RISULTATI = typeof process !== 'undefined' && process.env.NEXT_PUBLIC_DEBUG_RISULTATI === '1';

// Minimal type describing possible fixture row shapes
type FixtureRow = {
  id?: number | string;
  fixture_id?: number | string;
  fixtureId?: number | string;
  homeScore?: number | null;
  awayScore?: number | null;
  home_score?: number | null; // Database field
  away_score?: number | null; // Database field
  home_goals?: number | null;
  away_goals?: number | null;
  homeGoals?: number | null;
  awayGoals?: number | null;
  result_raw?: string;
  resultRaw?: string;
  // Additional fields for live mode conversion
  date?: string;
  kickoff?: string;
  match_date?: string | Date; // Database field (fixtures table)
  venue?: string;
  homeTeam?: string;
  awayTeam?: string;
  home_team?: string;
  away_team?: string;
  teams?: {
    home?: { name?: string };
    away?: { name?: string };
  };
};

interface WeeklyStats {
  week: number;
  totalPredictions: number;
  correctPredictions: number;
  accuracy: number;
  points: number;
}

interface UserSummary {
  totalPredictions: number;
  correctPredictions: number;
  overallAccuracy: number;
  totalPoints: number;
  currentWeek: number;
  weeklyStats: WeeklyStats[];
}

// Type guard to extract `{ data: T }` shapes safely
function hasData<T>(value: unknown): value is { data: T } {
  return typeof value === 'object' && value !== null && 'data' in (value as Record<string, unknown>);
}

interface PredictionHistory {
  id: string;
  week: number;
  homeTeam: string;
  awayTeam: string;
  prediction: string;
  actualResult?: string;
  isCorrect?: boolean;
  points: number;
  date: string;
}

// Match-cards API types for Test Mode
interface MatchCardKickoff { iso: string; display: string; }
// Last-5 item shape (optional richer data from backend)
interface Last5Item {
  fixtureId: string;
  code: '1'|'X'|'2';
  predicted?: '1'|'X'|'2'|null;
  correct?: boolean|null;
  // Optional team-perspective outcome: 'W' win, 'D' draw, 'L' loss
  outcome?: 'W'|'D'|'L' | null;
  // Whether this team was home in the historical match (for deriving W/L from code)
  teamWasHome?: boolean | null;
}

interface MatchCardTeamHome { name: string; logo: string | null; winRateHome: number | null; last5: Array<'1' | 'X' | '2'>; form?: Last5Item[] }
interface MatchCardTeamAway { name: string; logo: string | null; winRateAway: number | null; last5: Array<'1' | 'X' | '2'>; form?: Last5Item[] }
interface MatchCard { week: number; fixtureId: string; kickoff: MatchCardKickoff; stadium: string | null; home: MatchCardTeamHome; away: MatchCardTeamAway; }

type Choice = '1' | 'X' | '2';

// Test weekly stats (from BFF -> Gaming Services)
interface TestWeeklyPrediction {
  fixtureId: string;
  homeTeam: string;
  awayTeam: string;
  userChoice: Choice | 'SKIP';
  actualResult: Choice | 'TBD';
  isCorrect: boolean;
  homeScore: number | null;
  awayScore: number | null;
}

interface TestWeeklyStatsResp {
  week: number;
  totalPredictions: number; // excluding SKIP
  correctPredictions: number;
  weeklyPercentage: number;
  totalTurns: number; // predictions + skips
  skippedCount: number;
  predictions: TestWeeklyPrediction[];
}

function RisultatiPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { firebaseUser } = useAuthContext();
  const mode = 'live';
  const [summary, setSummary] = useState<UserSummary | null>(null);
  const [history, setHistory] = useState<PredictionHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'week' | 'overview' | 'history'>('week');

  // Use reliable live week detection for live mode (same as GameHeader)
  const { liveWeekData } = useLiveWeek({ mode: 'live' });

  // Per-game reveal state (Test Mode) - initialize with live week to avoid loading wrong week initially
  const [selectedWeek, setSelectedWeek] = useState<number>(liveWeekData?.currentWeek || 7);
  const [userId, setUserId] = useState<string | null>(null);
  const [weekCards, setWeekCards] = useState<MatchCard[]>([]);
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  const [weeklyStats, setWeeklyStats] = useState<TestWeeklyStatsResp | null>(null);
  const [fixtureScoresLoaded, setFixtureScoresLoaded] = useState(false);
  const [nextWeekRange, setNextWeekRange] = useState<{ from: string; to: string } | null>(null);
  const [navDir, setNavDir] = useState<1 | -1 | 0>(0);
  const [pendingWeekForUrl, setPendingWeekForUrl] = useState<number | null>(null);
  const [fixtureScores, setFixtureScores] = useState<Map<string, { homeScore: number | null; awayScore: number | null; actual?: Choice }>>(new Map());
  // Track the most recently revealed fixture and where to fire confetti
  const [recentlyRevealed, setRecentlyRevealed] = useState<{ id: string; origin?: { x: number; y: number } } | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [percentileData, setPercentileData] = useState<{ percentile: number; totalPlayers: number; betterThanPercent: number } | null>(null);

  // Fire indigo/white confetti burst (non-blocking), optionally anchored to a viewport origin
  const fireConfetti = useCallback((origin?: { x: number; y: number }) => {
    try {
      const colors = ['#6366f1', '#ffffff']; // indigo-500 and white
      if (origin) {
        // Centered burst from the button
        confetti({ particleCount: 90, spread: 80, startVelocity: 45, gravity: 0.9, decay: 0.9, scalar: 0.9, colors, origin });
      } else {
        // Fallback: two symmetric bursts if no origin provided
        confetti({ particleCount: 50, spread: 70, startVelocity: 45, gravity: 0.9, decay: 0.9, scalar: 0.9, colors, origin: { x: 0.15, y: 0.2 } });
        confetti({ particleCount: 50, spread: 70, startVelocity: 45, gravity: 0.9, decay: 0.9, scalar: 0.9, colors, origin: { x: 0.85, y: 0.2 } });
      }
    } catch (e) {
      if (DEBUG_RISULTATI) {
        try { console.warn('[risultati] confetti failed', e); } catch {}
      }
    }
  }, []);

  // Semi-circular success meter (SVG half-donut) sized to match the share button width
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

  const fetchUserData = useCallback(async () => {
    if (!firebaseUser) return;
    
    setLoading(true);
    setError(null);
    
    try {
      // Use Firebase UID for specs/predictions (specs table uses firebase_uid as user_id)
      const userId = firebaseUser.uid;

      // Fetch live mode summary
      const summaryResponse = await apiClient.getUserSummary(userId, 'live').catch(() => null);
      // Normalize summary shape and defaults to avoid undefined.toFixed errors
      const raw: UserSummary | null | undefined = hasData<UserSummary>(summaryResponse)
        ? summaryResponse.data
        : (summaryResponse as unknown as UserSummary | null | undefined);
      const normalized: UserSummary = {
        totalPredictions: Number(raw?.totalPredictions ?? 0),
        correctPredictions: Number(raw?.correctPredictions ?? 0),
        overallAccuracy: Number(raw?.overallAccuracy ?? 0),
        totalPoints: Number(raw?.totalPoints ?? 0),
        currentWeek: Number(raw?.currentWeek ?? 1),
        weeklyStats: Array.isArray(raw?.weeklyStats)
          ? (raw!.weeklyStats as Array<Partial<WeeklyStats>>).map((w) => ({
              week: Number(w?.week ?? 1),
              totalPredictions: Number(w?.totalPredictions ?? 0),
              correctPredictions: Number(w?.correctPredictions ?? 0),
              accuracy: Number(w?.accuracy ?? 0),
              points: Number(w?.points ?? 0),
            }))
          : [],
      };
      setSummary(normalized);

  // History fetching disabled for now (BFF weekly history route not guaranteed in prod)
  setHistory([]);

      // Set backend userId for Test Mode ops
      setUserId(userId);
    } catch (err) {
      console.error('Error fetching user data:', err);
      setError('Errore nel caricamento dei dati');
    } finally {
      setLoading(false);
    }
  }, [firebaseUser]);

  useEffect(() => {
    if (!firebaseUser) {
      router.push('/login');
      return;
    }
    
    fetchUserData();
  }, [firebaseUser, fetchUserData, router]);

  // Initialize week from query string
  useEffect(() => {
    if (!searchParams) return;
    const qWeek = searchParams.get('week');
    const w = qWeek ? Number(qWeek) : NaN;
    if (Number.isFinite(w) && w >= 1 && w <= 38) {
      setSelectedWeek(w);
    }
    if (DEBUG_RISULTATI) {
      try { console.log('[risultati] init from searchParams', { qWeek }); } catch {}
    }
  }, [searchParams]);

  // Set selectedWeek from live week data (unless explicitly set via URL)
  useEffect(() => {
    if (liveWeekData && !searchParams?.get('week')) {
      setSelectedWeek(liveWeekData.currentWeek);
      if (DEBUG_RISULTATI) {
        try { console.log('[risultati] setting live week from useLiveWeek', { week: liveWeekData.currentWeek }); } catch {}
      }
    }
  }, [liveWeekData, searchParams]);

  // Set active tab to week for live mode
  useEffect(() => {
    if (activeTab !== 'week') {
      setActiveTab('week');
    }
  }, [activeTab]);
  // Share support and feedback toast
  const [shareSupported, setShareSupported] = useState(false);
  const [shareToast, setShareToast] = useState<string | null>(null);

  // Narrow navigator type for Web Share API safely
  type NavigatorWebShare = Navigator & {
    share?: (data: { title?: string; text?: string; url?: string }) => Promise<void>;
    clipboard?: Navigator['clipboard'];
  };

  useEffect(() => {
    try {
      const n: NavigatorWebShare | undefined = typeof navigator !== 'undefined' ? (navigator as NavigatorWebShare) : undefined;
      const supported = !!n && typeof n.share === 'function';
      setShareSupported(supported);
    } catch {
      setShareSupported(false);
    }
  }, []);


  // Helper to change week and keep URL in sync
  const updateWeek = useCallback((w: number) => {
    const next = Math.max(1, Math.min(38, w));
    setNavDir(next > selectedWeek ? 1 : -1);
    setSelectedWeek(next);
    setPendingWeekForUrl(next); // delay URL update until animation completes
  }, [selectedWeek]);

  // Mode is set via URL search params; no toggle required here



  const formatPrediction = (prediction: string) => {
    switch (prediction) {
      case '1': return 'Casa';
      case 'X': return 'Pareggio';
      case '2': return 'Ospite';
      default: return prediction;
    }
  };


  const getResultColor = (isCorrect?: boolean) => {
    if (isCorrect === undefined) return 'text-gray-500';
    return isCorrect ? 'text-green-500' : 'text-red-500';
  };

  // ---------- Week Tab Logic (Test Mode) ----------
  // Live mode: always allow reveals
  const allowRevealThisWeek = true;

  // LocalStorage key for reveal state
  const revealKey = useMemo(() => {
    return userId ? `swipick:risultati:reveal:live:week:${selectedWeek}:user:${userId}` : null;
  }, [userId, selectedWeek]);



  // Load reveal state
  useEffect(() => {
    if (!revealKey) return;
    // Strictly block any reveals for weeks > 1 until predictions for that week are complete
    if (!allowRevealThisWeek) { setRevealed({}); return; }
    try {
      const raw = localStorage.getItem(revealKey);
      if (raw) {
        const parsed = JSON.parse(raw) as string[];
        const map: Record<string, boolean> = {};
        parsed.forEach((fid) => { map[fid] = true; });
        setRevealed(map);
      } else {
        setRevealed({});
      }
    } catch {
      setRevealed({});
    }
  }, [revealKey, allowRevealThisWeek]);

  // Persist reveal state
  useEffect(() => {
    if (!revealKey) return;
    // Don't persist reveals when not allowed yet (prevents stale unlocks)
    if (!allowRevealThisWeek) return;
    try {
      const ids = Object.entries(revealed)
        .filter(([, v]) => v)
        .map(([k]) => k); // Keep as strings (fixture IDs are UUIDs)
      localStorage.setItem(revealKey, JSON.stringify(ids));
    } catch {}
  }, [revealed, revealKey, allowRevealThisWeek]);

  // Legacy auto-rollover flag removed

  // Fetch week match-cards for Live Mode
  useEffect(() => {
    // Clear weekCards immediately when week changes to prevent showing stale dates
    setWeekCards([]);

    const run = async () => {
      try {
        // For live mode, use fixtures table as single source of truth
        const fixturesResp = await apiClient.getFixturesByWeek(selectedWeek) as unknown as { data?: FixtureRow[] } | FixtureRow[];
        const fixtures = Array.isArray(fixturesResp) ? fixturesResp : fixturesResp?.data ?? [];

        // Convert fixtures to MatchCard format for consistency
        const mcResponse = fixtures.map((f: FixtureRow) => {
          // Ensure match_date is properly converted to ISO string
          const matchDate = f.match_date || f.date || f.kickoff;
          const isoDate = matchDate ? (matchDate instanceof Date ? matchDate.toISOString() : String(matchDate)) : new Date().toISOString();

          return {
            week: selectedWeek,
            fixtureId: String(f.id ?? f.fixture_id ?? f.fixtureId),
            kickoff: {
              iso: isoDate,
              display: new Date(isoDate).toLocaleDateString()
            },
            stadium: f.venue || null,
            home: {
              name: f.homeTeam || f.home_team || f.teams?.home?.name || 'Home Team',
              logo: null,
              winRateHome: null,
              last5: []
            },
            away: {
              name: f.awayTeam || f.away_team || f.teams?.away?.name || 'Away Team',
              logo: null,
              winRateAway: null,
              last5: []
            }
          };
        });
        const sorted = mcResponse.slice().sort((a, b) => new Date(a.kickoff.iso).getTime() - new Date(b.kickoff.iso).getTime());
        setWeekCards(sorted.slice(0, 10));
        if (DEBUG_RISULTATI) {
          try { console.log('[risultati] weekCards loaded', { week: selectedWeek, count: sorted.length, first: sorted[0]?.fixtureId, userId }); } catch {}
        }
      } catch (e) {
        console.warn('Failed to load match-cards for week', selectedWeek, e);
        setWeekCards([]);
      }
    };
    run();
  }, [selectedWeek, userId]);

  // Preload next week's range for the header (placeholder only)
  useEffect(() => {
    const run = async () => {
      const nxt = selectedWeek + 1;
      try {
        const resp = await apiClient.getLiveMatchCardsByWeek(nxt, userId ?? undefined) as unknown as { data?: MatchCard[] } | MatchCard[];
        const arr = Array.isArray(resp) ? resp : resp?.data ?? [];
        if (Array.isArray(arr) && arr.length) {
          const times = (arr as MatchCard[]).map((m) => new Date(m.kickoff.iso).getTime());
          const min = new Date(Math.min(...times));
          const max = new Date(Math.max(...times));
          const fmt = (d: Date) => d.toLocaleDateString('it-IT', { day: '2-digit', month: 'numeric' });
          setNextWeekRange({ from: fmt(min), to: fmt(max) });
        } else {
          setNextWeekRange(null);
        }
      } catch { setNextWeekRange(null); }
    };
    run();
  }, [selectedWeek, userId]);

  // Fetch raw fixtures with scores for the selected week (fallback for result display)
  useEffect(() => {
    const run = async () => {
      try {
        // For live mode, get fixtures by specific week from fixtures table
        const resp = await apiClient.getFixturesByWeek(selectedWeek) as unknown as { data?: Array<FixtureRow> } | Array<FixtureRow>;
        const arr: FixtureRow[] = Array.isArray(resp) ? resp : (resp?.data ?? []);
        if (DEBUG_RISULTATI) {
          try {
            console.log('[risultati] fixtures API response', { week: selectedWeek, count: arr.length, sample: arr[0] });
            console.log('[risultati] sample fixture fields', Object.keys(arr[0] || {}));
          } catch {}
        }
        const map = new Map<string, { homeScore: number | null; awayScore: number | null; actual?: Choice }>();

        const parseResultRaw = (val: unknown): { hs: number | null; as: number | null } => {
          if (typeof val === 'string') {
            const m = val.match(/(\d+)\s*[-–]\s*(\d+)/);
            if (m) return { hs: Number(m[1]), as: Number(m[2]) };
          }
          return { hs: null, as: null };
        };

        for (const f of arr) {
          // Accept several id shapes and keep as string
          const rawId = (f.id ?? f.fixture_id ?? f.fixtureId) as number | string | undefined;
          if (!rawId) continue; // Skip if no ID found
          const fid = String(rawId); // Always convert to string to match other maps

          // Accept several score shapes: homeScore/awayScore, home_score/away_score (database fields), home_goals/away_goals, homeGoals/awayGoals, result_raw
          let hs: number | null = null;
          let as: number | null = null;
          if (typeof f.homeScore === 'number' && typeof f.awayScore === 'number') {
            hs = f.homeScore; as = f.awayScore;
          } else if (typeof f.home_score === 'number' && typeof f.away_score === 'number') {
            hs = f.home_score; as = f.away_score;
          } else if (typeof f.home_goals === 'number' && typeof f.away_goals === 'number') {
            hs = f.home_goals; as = f.away_goals;
          } else if (typeof f.homeGoals === 'number' && typeof f.awayGoals === 'number') {
            hs = f.homeGoals; as = f.awayGoals;
          } else {
            const parsed = parseResultRaw(f.result_raw ?? f.resultRaw);
            hs = parsed.hs; as = parsed.as;
          }

          let actual: Choice | undefined;
          if (typeof hs === 'number' && typeof as === 'number') {
            actual = hs > as ? '1' : hs < as ? '2' : 'X';
          }
          if (fid && fid !== 'undefined') {
            map.set(fid, { homeScore: hs, awayScore: as, actual });
            if (DEBUG_RISULTATI && map.size <= 3) {
              try { console.log('[risultati] fixture added to map', { fid, hs, as, actual, rawId }); } catch {}
            }
          }
        }
        if (DEBUG_RISULTATI) {
          try {
            console.debug('[risultati] fixtures fallback built', { week: selectedWeek, count: map.size, keys: Array.from(map.keys()).slice(0, 12) });
          } catch {}
        }
        setFixtureScores(map);
        setFixtureScoresLoaded(true);
      } catch {
        setFixtureScores(new Map());
        setFixtureScoresLoaded(true);
      }
    };

    setFixtureScoresLoaded(false); // Reset loading state when week changes
    run();
  }, [selectedWeek]);

  // Helper: load weekly stats when needed
  const loadWeeklyStats = useCallback(async (week: number) => {
    if (!userId) { setWeeklyStats(null); return; }
    try {
      // For live mode, use week-specific endpoint to get fixture predictions
      const resp = await apiClient.getLiveWeeklyStats(userId, week);

      const stats: TestWeeklyStatsResp | null = (resp && typeof resp === 'object' && 'data' in (resp as Record<string, unknown>))
        ? (resp as { data: TestWeeklyStatsResp }).data
        : (resp as unknown as TestWeeklyStatsResp | null);
      setWeeklyStats(stats ?? null);
      if (DEBUG_RISULTATI) {
        try { console.log('[risultati] weeklyStats loaded', { week, total: Number(stats?.totalPredictions ?? 0) }); } catch {}
      }
    } catch {
      // Quietly ignore (e.g., 404 when no predictions yet)
      setWeeklyStats(null);
      if (DEBUG_RISULTATI) {
        try { console.log('[risultati] weeklyStats not available', { week }); } catch {}
      }
    }
  }, [userId]);

  // Fetch weekly stats for selected week (Live Mode)
  useEffect(() => {
    if (!userId) { setWeeklyStats(null); return; }
    loadWeeklyStats(selectedWeek);
  }, [selectedWeek, userId, loadWeeklyStats]);

  // (Removed) Preload week 2 completion to avoid noisy 404s in prod; check lazily on reveal instead.

  // Build lookup by fixtureId from weekly stats predictions
  const predByFixture = useMemo(() => {
    const map = new Map<string, { prediction: Choice | null; actual?: Choice; isCorrect?: boolean; homeScore?: number | null; awayScore?: number | null }>();
    if (!weeklyStats) return map;
    for (const p of weeklyStats.predictions || []) {
      // Backend returns snake_case (choice, result) for live mode
      // and camelCase (userChoice, actualResult) for test mode
      type PredictionResponse = Record<string, unknown> & TestWeeklyPrediction;
      const pr = p as PredictionResponse;
      const choiceField = pr.choice || pr.userChoice;
      const resultField = pr.result || pr.actualResult;

      const actual = ((): Choice | undefined => {
        const v = (resultField || '').toString().toUpperCase();
        return v === '1' || v === 'X' || v === '2' ? (v as Choice) : undefined;
      })();
      const pred = ((): Choice | null => {
        const v = (choiceField || '').toString().toUpperCase();
        return v === '1' || v === 'X' || v === '2' ? (v as Choice) : null;
      })();

      // Backend returns fixture_id for live mode, fixtureId for test mode
      const fixtureId = (pr.fixture_id as string) || pr.fixtureId;

      map.set(fixtureId, { prediction: pred, actual, isCorrect: (pr.is_correct as boolean | undefined) ?? pr.isCorrect, homeScore: pr.homeScore, awayScore: pr.awayScore });
    }
    return map;
  }, [weeklyStats]);

  // Log weekly stats map composition for debugging
  useEffect(() => {
    if (!DEBUG_RISULTATI) return;
    try {
      console.debug('[risultati] weeklyStats map', { count: predByFixture.size, keys: Array.from(predByFixture.keys()).slice(0, 12) });
    } catch {}
  }, [predByFixture]);

  // Compute meter
  const meter = useMemo(() => {
    if (weekCards.length === 0) return { revealed: 0, correct: 0, percent: 0 };
    let revealedCount = 0;
    let correctCount = 0;
    for (const m of weekCards) {
      if (!revealed[m.fixtureId]) continue;
      revealedCount += 1;
      const ph = predByFixture.get(m.fixtureId);
      if (ph?.isCorrect === true) correctCount += 1;
      else if (ph?.isCorrect === false) correctCount += 0;
      else correctCount += 0; // no data treated as incorrect
    }
    const percent = revealedCount > 0 ? Math.round((correctCount / revealedCount) * 100) : 0;
    return { revealed: revealedCount, correct: correctCount, percent };
  }, [weekCards, revealed, predByFixture]);

  // Fetch percentile data when user and week are available
  useEffect(() => {
    const fetchPercentile = async () => {
      if (!userId || !selectedWeek) {
        setPercentileData(null);
        return;
      }

      try {
        const bffUrl = process.env.NEXT_PUBLIC_BFF_API_URL || 'http://localhost:9000/api';
        const response = await fetch(
          `${bffUrl}/final-week-scores/${userId}/week/${selectedWeek}/percentile?mode=live`,
        );

        if (response.ok) {
          const data = await response.json();
          setPercentileData(data);
        } else {
          console.error('Failed to fetch percentile data:', response.status);
          setPercentileData(null);
        }
      } catch (error) {
        console.error('Error fetching percentile:', error);
        setPercentileData(null);
      }
    };

    fetchPercentile();
  }, [userId, selectedWeek]);

  // Share handler (defined after meter so it can reference it safely)
  const handleShare = useCallback(async () => {
    const title = `Giornata ${selectedWeek} — Swipick`;

    // Build share text with dynamic percentile
    let shareText = `Ho indovinato il ${meter.percent}% delle partite della ${selectedWeek}ª giornata.`;

    if (percentileData && percentileData.totalPlayers > 0 && percentileData.percentile > 0) {
      shareText += ` Sono nel ${percentileData.percentile}% dei migliori.`;
    }

    // Add challenge
    shareText += `\nE tu?`;

    const text = shareText;
    // Use the specific risultati URL with live mode
    const url = `https://swipick-frontend-production.up.railway.app/risultati?mode=live`;
    try {
      const n: NavigatorWebShare | undefined = typeof navigator !== 'undefined' ? (navigator as NavigatorWebShare) : undefined;
      if (n && typeof n.share === 'function') {
        await n.share({ title, text, url });
        return;
      }
      throw new Error('Web Share API not supported');
    } catch {
      // We keep desktop disabled by default, but if invoked in an unsupported context, show a gentle toast
      setShareToast('Condivisione non supportata su questo dispositivo');
      setTimeout(() => setShareToast(null), 2200);
    }
  }, [selectedWeek, meter, percentileData]);

  const onReveal = async (fixtureId: string, anchorEl?: HTMLElement) => {
    // Reveal allowed - the check has already been done in the button onClick handler
    if (DEBUG_RISULTATI) { try { console.log('[risultati] reveal allowed', { week: selectedWeek, fixtureId }); } catch {} }
    if (DEBUG_RISULTATI) {
      try {
        const joinPred = predByFixture.get(fixtureId);
        const joinFx = fixtureScores.get(fixtureId);
        console.debug('[risultati] onReveal join', { fixtureId, weeklyPresent: !!weeklyStats, pred: joinPred, fallback: joinFx });
      } catch {}
    }

    // Mark revealed
    setRevealed((prev) => ({ ...prev, [fixtureId]: true }));

    // Compute viewport-based origin from the clicked button (if provided) and store context
    let origin: { x: number; y: number } | undefined = undefined;
    try {
      if (anchorEl && typeof window !== 'undefined') {
        const rect = anchorEl.getBoundingClientRect();
        origin = {
          x: (rect.left + rect.width / 2) / window.innerWidth,
          y: (rect.top + rect.height / 2) / window.innerHeight,
        };
      }
    } catch {}
    setRecentlyRevealed({ id: fixtureId, origin });
  };

  // When a reveal occurs, check correctness and fire confetti if correct
  useEffect(() => {
    const ctx = recentlyRevealed;
    if (!ctx) return;
    const fid = ctx.id;
    // Ensure it's marked revealed in state first
    if (!revealed[fid]) return;
    // Try to compute correctness from available data
    const pred = predByFixture.get(fid);
    const actual = pred?.actual ?? fixtureScores.get(fid)?.actual;
    const userPick = pred?.prediction ?? null;
    if (!actual || !userPick) {
      // Wait until data arrives (effect will re-run when predByFixture/fixtureScores change)
      return;
    }
    const isCorrect = userPick === actual;
    if (isCorrect) fireConfetti(ctx.origin);
    // Clear to avoid duplicate firing
    setRecentlyRevealed(null);
  }, [recentlyRevealed, predByFixture, fixtureScores, revealed, fireConfetti]);


  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-black text-xl">Caricamento...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-black text-xl">{error}</div>
      </div>
    );
  }

  return (
    <div className="h-[100svh] bg-white pb-20 overflow-y-auto touch-pan-y">
      <div className="pb-4">
        {toast && (
          <Toast
            message={`${toast}\n• Le rivelazioni sono locali e non influiscono sulle statistiche.`}
            onClose={() => setToast(null)}
            variant="lozenge"
          />
        )}
        {/* Sticky: Header + Meter + Share */}
        <div className="sticky top-0 z-30 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/70 pointer-events-none">
          {/* Top Header Panel (modal-like) */}
          <div
            key={`header-week-${selectedWeek}`}
            className="w-full mx-0 mt-0 mb-2 rounded-b-2xl rounded-t-none text-white pointer-events-auto"
            style={{ background: 'radial-gradient(circle at center, #554099, #3d2d73)', boxShadow: '0 8px 16px rgba(85, 64, 153, 0.3), 0 4px 8px rgba(0, 0, 0, 0.2)' }}
          >
            <div className="relative px-4 pt-10 pb-6">
              {/* Faded previous (left) - clickable */}
              <div className="absolute left-4 top-1/2 -translate-y-1/2 text-white text-sm opacity-30">
                {selectedWeek > 1 ? (
                  <button
                    onClick={() => updateWeek(selectedWeek - 1)}
                    className="font-medium hover:opacity-60 transition-opacity cursor-pointer"
                  >
                    <div>Giornata {selectedWeek - 1}</div>
                    <div className="text-xs">{/* prev range optional */}</div>
                  </button>
                ) : (
                  <div className="h-6 select-none" />
                )}
              </div>

              {/* Center current week */}
              <div className="text-center">
                <div className="text-2xl font-bold" key={`week-title-${selectedWeek}`}>Giornata {selectedWeek}</div>
                <div className="mt-2 text-white text-opacity-90">
                  {(() => {
                    if (weekCards.length === 0) return null;
                    const times = weekCards.map((m) => new Date(m.kickoff.iso).getTime());
                    const min = new Date(Math.min(...times));
                    const max = new Date(Math.max(...times));
                    const toIt = (d: Date) => d.toLocaleDateString('it-IT', { day: '2-digit', month: 'numeric' });
                    return <span>dal {toIt(min)} al {toIt(max)}</span>;
                  })()}
                </div>
              </div>

              {/* Faded next (right) - clickable */}
              <div className="absolute right-4 top-1/2 -translate-y-1/2 text-white text-sm opacity-60 text-right">
                <button
                  onClick={() => updateWeek(selectedWeek + 1)}
                  className="font-medium hover:opacity-80 transition-opacity cursor-pointer"
                >
                  <div>Giornata {selectedWeek + 1}</div>
                  <div className="text-xs">{nextWeekRange ? `dal ${nextWeekRange.from} al ${nextWeekRange.to}` : ''}</div>
                </button>
              </div>
            </div>
          </div>

          {/* Success Meter area (sticky along with header) */}
          <div className="px-4 pb-2 pointer-events-auto">
            <CircularMeter percent={meter.percent} onShare={handleShare} shareEnabled={shareSupported} />
          </div>
        </div>

  {/* No secondary header; mode toggle stays if needed in future */}

        <AnimatePresence
          initial={false}
          mode="wait"
          onExitComplete={() => {
            if (pendingWeekForUrl != null && typeof window !== 'undefined') {
              try {
                const url = new URL(window.location.href);
                url.searchParams.set('week', String(pendingWeekForUrl));
                url.searchParams.set('mode', mode);
                window.history.replaceState({}, '', url.toString());
              } catch {}
              setPendingWeekForUrl(null);
            }
          }}
        >
          <motion.div
            key={`week-${selectedWeek}`}
            initial={{ x: navDir === 0 ? 0 : navDir * 80, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: navDir === 0 ? 0 : -navDir * 80, opacity: 0 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
          >
            {/* Meter moved to sticky header above */}

            {/* Week Tab (Live Mode) */}
            <div className="px-4 space-y-6">
            {/* Small helper row under meter */}
            <div className="flex items-center justify-between text-black text-sm px-1">
              {/* <div className="opacity-70">Mostra i risultati una partita alla volta</div> */}
              {/* <div className="opacity-80">{meter.correct}/{meter.revealed} corrette</div> */}
            </div>

            {/* Matches list */}
            {!fixtureScoresLoaded ? (
              <div className="bg-white rounded-xl p-8 text-center text-black border border-black/5">
                <div className="animate-pulse">Caricamento partite...</div>
              </div>
            ) : weekCards.length === 0 ? (
              <div className="bg-white rounded-xl p-8 text-center text-black border border-black/5">Nessuna partita trovata</div>
            ) : (
              <div className="space-y-3">
                {weekCards.map((m) => {
                  const fid = m.fixtureId; // Keep as string to match revealed state
                  const pred = predByFixture.get(fid);
                  const scoreFallback = fixtureScores.get(fid);

                  // Auto-reveal previous weeks (weeks before current live week)
                  const currentLiveWeek = liveWeekData?.currentWeek || 4; // Default to 4 if not loaded
                  const isPreviousWeek = selectedWeek < currentLiveWeek;

                  // Check if we have actual score data (not ND) - this means match has finished
                  const homeScoreData = pred?.homeScore ?? scoreFallback?.homeScore;
                  const awayScoreData = pred?.awayScore ?? scoreFallback?.awayScore;
                  const matchHasFinished = homeScoreData != null && awayScoreData != null;

                  // Only allow reveal if match has finished with valid scores
                  const canBeRevealed = matchHasFinished;
                  // Only reveal if user has explicitly clicked the button (removed auto-reveal for previous weeks)
                  const isRevealed = !!revealed[m.fixtureId] && canBeRevealed;

                  const statusLabel = isRevealed ? 'FINE PARTITA' : 'MOSTRA RISULTATO';
                  const statusColor = isRevealed ? 'bg-gray-200 text-gray-700' : 'bg-indigo-500 bg-opacity-90 text-white';

                  if (isRevealed && !pred && !scoreFallback && fixtureScoresLoaded) {
                    // Minimal diagnostic to help trace missing scores in prod without spamming (only after scores loaded)
                    console.warn('No score data found for fixture', fid, 'in week', selectedWeek);
                  }
                  const homeVal = isRevealed ? homeScoreData : undefined;
                  const awayVal = isRevealed ? awayScoreData : undefined;
                  if (DEBUG_RISULTATI && isRevealed && homeVal == null && awayVal == null) {
                    try { console.debug('[risultati] revealed but no scores', { fid, week: selectedWeek }); } catch {}
                  }
                  return (
                    <div key={m.fixtureId} className="bg-white rounded-2xl p-4 shadow-[0_8px_24px_rgba(0,0,0,0.06)] border border-black/5">
                      <div className="grid grid-cols-[minmax(0,1fr)_auto_auto_auto] gap-4 items-center">
                        {/* Col 1: Teams (no date) */}
                        <div className="flex flex-col gap-3">
                          <div className="flex items-center gap-3 h-12">
                            {(() => {
                              const logoPath = resolveTeamLogo(m.home.name, m.home.logo);
                              return logoPath ? (
                                <div className="w-12 h-12 rounded bg-gray-50 flex items-center justify-center overflow-hidden">
                                  <Image src={logoPath} alt={m.home.name} width={48} height={48} className="object-contain max-w-full max-h-full" />
                                </div>
                              ) : (
                                <div className="w-12 h-12 rounded bg-gray-100" />
                              );
                            })()}
              <div className="text-black font-bold truncate">{m.home.name}</div>
                          </div>
                          {/* last-5 removed as requested */}
                          <div className="flex items-center gap-3 h-12">
                            {(() => {
                              const logoPath = resolveTeamLogo(m.away.name, m.away.logo);
                              return logoPath ? (
                                <div className="w-12 h-12 rounded bg-gray-50 flex items-center justify-center overflow-hidden">
                                  <Image src={logoPath} alt={m.away.name} width={48} height={48} className="object-contain max-w-full max-h-full" />
                                </div>
                              ) : (
                                <div className="w-12 h-12 rounded bg-gray-100" />
                              );
                            })()}
              <div className="text-black font-bold truncate">{m.away.name}</div>
                          </div>
                          {/* last-5 removed as requested */}
                        </div>

                        {/* Col 2: Final scores (two rows) */}
                        <div className="grid grid-rows-2 pr-1.5">
                          <div className="h-14 flex items-center justify-center">
                            <div className="text-2xl leading-none font-semibold text-black min-w-[16px] text-center">{homeVal != null ? homeVal : (isRevealed ? 'ND' : '–')}</div>
                          </div>
                          <div className="h-14 flex items-center justify-center">
                            <div className="text-2xl leading-none font-semibold text-black min-w-[16px] text-center">{awayVal != null ? awayVal : (isRevealed ? 'ND' : '–')}</div>
                          </div>
                        </div>

                        {/* Col 3: Status button (centered) */}
            <div className="flex items-center justify-center ml-1.5">
                          <button
                            onClick={(e) => {
                              // Only allow click if match has finished (has valid scores)
                              if (!matchHasFinished) {
                                const target = e.currentTarget as HTMLButtonElement;
                                // Apply inline animation for guaranteed shake effect
                                target.style.animation = 'shake 0.5s ease-in-out';
                                setTimeout(() => {
                                  target.style.animation = '';
                                }, 500);
                                setToast('Il risultato non è ancora disponibile');
                                return;
                              }
                              onReveal(m.fixtureId, e.currentTarget);
                            }}
                            disabled={isRevealed}
                            className={`min-w-[72px] px-2 py-2 rounded-md text-[11px] leading-tight text-center font-medium ${statusColor} ${isRevealed ? 'opacity-100 cursor-default' : 'hover:bg-opacity-100'}`}
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

                        {/* Col 4: 1 / X / 2 vertical stack */}
                        <div className="flex flex-col items-center gap-2 ml-1.5">
                          {(['1','X','2'] as Choice[]).map((c) => {
                            const chosen = pred?.prediction === c;
                            const actual = pred?.actual ?? scoreFallback?.actual;
                            // Only show green if user actually chose this AND it's correct
                            const correct = chosen && actual === c && isRevealed;
                            // Only show red if user chose this AND it's wrong
                            const wrong = chosen && actual !== c && actual != null && isRevealed;

                            // Determine styling
                            let classes = 'bg-gray-100 text-gray-700'; // Default: not chosen
                            if (correct) {
                              classes = 'bg-[#ccffb3] text-[#2a8000]'; // Green: correct prediction
                            } else if (wrong) {
                              classes = 'bg-[#ffb3b3] text-[#cc0000]'; // Red: wrong prediction
                            } else if (chosen && !isRevealed) {
                              classes = 'bg-indigo-100 text-indigo-700 ring-2 ring-indigo-400'; // Blue: chosen but not revealed
                            }

                            return (
                              <div key={c} className={`w-8 h-8 rounded-md flex items-center justify-center text-sm font-semibold ${classes}`}>{c}</div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
              </div>
          </motion.div>
        </AnimatePresence>

        {/* Overview Tab */}
        {activeTab === 'overview' && summary && (
          <div className="px-4 space-y-6">
            {/* Stats Cards */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white bg-opacity-20 rounded-xl p-4 text-center">
                <div className="text-3xl font-bold text-white mb-1">
                  {Number.isFinite(summary.overallAccuracy) ? summary.overallAccuracy.toFixed(1) : '0.0'}%
                </div>
                <div className="text-white text-opacity-80 text-sm">Precisione</div>
              </div>
              <div className="bg-white bg-opacity-20 rounded-xl p-4 text-center">
                <div className="text-3xl font-bold text-white mb-1">
                  {summary.totalPoints}
                </div>
                <div className="text-white text-opacity-80 text-sm">Punti Totali</div>
              </div>
              <div className="bg-white bg-opacity-20 rounded-xl p-4 text-center">
                <div className="text-3xl font-bold text-white mb-1">
                  {summary.correctPredictions}
                </div>
                <div className="text-white text-opacity-80 text-sm">Corrette</div>
              </div>
              <div className="bg-white bg-opacity-20 rounded-xl p-4 text-center">
                <div className="text-3xl font-bold text-white mb-1">
                  {summary.totalPredictions}
                </div>
                <div className="text-white text-opacity-80 text-sm">Totali</div>
              </div>
            </div>

            {/* Weekly Stats */}
            <div className="bg-white bg-opacity-20 rounded-xl p-4">
              <h3 className="text-white font-bold text-lg mb-4">Statistiche Settimanali</h3>
              <div className="space-y-3">
                {(summary.weeklyStats ?? []).slice(0, 5).map((week) => (
                  <div key={week.week} className="flex justify-between items-center">
                    <div className="text-white">
                      <div className="font-medium">Settimana {week.week}</div>
                      <div className="text-sm text-white text-opacity-80">
                        {week.correctPredictions}/{week.totalPredictions} corrette
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-white font-bold">{Number.isFinite(week.accuracy) ? week.accuracy.toFixed(1) : '0.0'}%</div>
                      <div className="text-sm text-white text-opacity-80">{week.points} pt</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>
        )}

        {/* History Tab */}
        {activeTab === 'history' && (
          <div className="space-y-4">
            {history.length === 0 ? (
              <div className="bg-white bg-opacity-20 rounded-xl p-8 text-center">
                <div className="text-white text-lg">Nessuna predizione trovata</div>
                <div className="text-white text-opacity-60 mt-2">
                  Fai le tue prime predizioni!
                </div>
              </div>
            ) : (
              history.map((prediction) => (
                <div key={prediction.id} className="bg-white bg-opacity-20 rounded-xl p-4">
                  <div className="flex justify-between items-start mb-2">
                    <div className="text-white">
                      <div className="font-medium">
                        {prediction.homeTeam} vs {prediction.awayTeam}
                      </div>
                      <div className="text-sm text-white text-opacity-80">
                        Settimana {prediction.week} • {new Date(prediction.date).toLocaleDateString('it-IT')}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={`font-bold ${getResultColor(prediction.isCorrect)}`}>
                        {prediction.isCorrect ? '✓' : '✗'}
                      </div>
                      <div className="text-white text-sm">{prediction.points} pt</div>
                    </div>
                  </div>
                  <div className="flex justify-between items-center">
                    <div className="text-white text-opacity-80 text-sm">
                      Predizione: {formatPrediction(prediction.prediction)}
                    </div>
                    {prediction.actualResult && (
                      <div className="text-white text-opacity-80 text-sm">
                        Risultato: {formatPrediction(prediction.actualResult)}
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Bottom Navigation */}
        <BottomNav
          currentMode={mode as GameMode}
          selectedWeek={selectedWeek}
          onNavigateToResults={() => {}}
          onNavigateToGioca={() => {
            if (DEBUG_RISULTATI) { try { console.log('[risultati] nav -> gioca', { week: selectedWeek }); } catch {} }
            router.push('/gioca');
          }}
          onNavigateToProfile={() => router.push('/profilo')}
          activeTab="risultati"
        />
      </div>
      {/* Share toast */}
      {shareToast && (
        <div className="fixed left-1/2 -translate-x-1/2 bottom-24 z-50 bg-black text-white text-sm px-4 py-2 rounded-full shadow">
          {shareToast}
        </div>
      )}
  </div>
  );
};

export default function RisultatiPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-white flex items-center justify-center">
          <div className="text-black text-xl">Caricamento...</div>
        </div>
      }
    >
      <RisultatiPageContent />
    </Suspense>
  );
}
