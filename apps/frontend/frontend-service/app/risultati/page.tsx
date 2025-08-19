'use client';

import React, { useState, useEffect, useCallback, useMemo, Suspense } from 'react';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuthContext } from '@/src/contexts/AuthContext';
import { apiClient } from '@/lib/api-client';
import { IoShareOutline } from 'react-icons/io5';
import { AnimatePresence, motion } from 'framer-motion';
// Gradient header is inlined; page background is white per design

// Debug flag for targeted instrumentation on Risultati page (enable with NEXT_PUBLIC_DEBUG_RISULTATI=1)
const DEBUG_RISULTATI = typeof process !== 'undefined' && process.env.NEXT_PUBLIC_DEBUG_RISULTATI === '1';

// Minimal type describing possible fixture row shapes from Test Fixtures endpoint
type FixtureRow = {
  id?: number | string;
  fixture_id?: number | string;
  fixtureId?: number | string;
  homeScore?: number | null;
  awayScore?: number | null;
  home_goals?: number | null;
  away_goals?: number | null;
  homeGoals?: number | null;
  awayGoals?: number | null;
  result_raw?: string;
  resultRaw?: string;
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
interface MatchCardTeamHome { name: string; logo: string | null; winRateHome: number | null; last5: Array<'1' | 'X' | '2'>; }
interface MatchCardTeamAway { name: string; logo: string | null; winRateAway: number | null; last5: Array<'1' | 'X' | '2'>; }
interface MatchCard { week: number; fixtureId: number; kickoff: MatchCardKickoff; stadium: string | null; home: MatchCardTeamHome; away: MatchCardTeamAway; }

type Choice = '1' | 'X' | '2';

// Test weekly stats (from BFF -> Gaming Services)
interface TestWeeklyPrediction {
  fixtureId: number;
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
  const [mode, setMode] = useState<'live' | 'test'>('live');
  const [summary, setSummary] = useState<UserSummary | null>(null);
  const [history, setHistory] = useState<PredictionHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'week' | 'overview' | 'history'>('week');

  // Per-game reveal state (Test Mode)
  const [selectedWeek, setSelectedWeek] = useState<number>(1);
  const [userId, setUserId] = useState<string | null>(null);
  const [weekCards, setWeekCards] = useState<MatchCard[]>([]);
  const [revealed, setRevealed] = useState<Record<number, boolean>>({});
  const [weeklyStats, setWeeklyStats] = useState<TestWeeklyStatsResp | null>(null);
  // Unified multi-week guard veil (weeks > 1) when predictions < 10 for that week
  const [guardVeilOpen, setGuardVeilOpen] = useState(false);
  const [guardTargetWeek, setGuardTargetWeek] = useState<number | null>(null);
  const [nextWeekRange, setNextWeekRange] = useState<{ from: string; to: string } | null>(null);
  const [navDir, setNavDir] = useState<1 | -1 | 0>(0);
  const [pendingWeekForUrl, setPendingWeekForUrl] = useState<number | null>(null);
  const [rolledWeek1Once, setRolledWeek1Once] = useState(false);
  const [fixtureScores, setFixtureScores] = useState<Map<number, { homeScore: number | null; awayScore: number | null; actual?: Choice }>>(new Map());
  // Final completion veil (after last reveal in Giornata 4)
  const [finalVeilOpen, setFinalVeilOpen] = useState(false);

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
      // Get user profile to get the backend user ID
      const userResponse = await apiClient.getUserByFirebaseUid(firebaseUser.uid);
      const userId = userResponse.data.id;

      // Always fetch summary for current mode
      const summaryResponse = await apiClient.getUserSummary(userId, mode).catch(() => null);
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
  }, [firebaseUser, mode]);

  useEffect(() => {
    if (!firebaseUser) {
      router.push('/login');
      return;
    }
    
    fetchUserData();
  }, [firebaseUser, fetchUserData, router]);

  // Initialize mode/week from query string (e.g., ?mode=test&week=1)
  useEffect(() => {
    if (!searchParams) return;
    const qMode = searchParams.get('mode');
    const qWeek = searchParams.get('week');
    if (qMode === 'test' || qMode === 'live') {
      setMode(qMode);
      setActiveTab(qMode === 'test' ? 'week' : 'overview');
    }
    const w = qWeek ? Number(qWeek) : NaN;
    if (Number.isFinite(w) && w >= 1 && w <= 38) {
      setSelectedWeek(w);
    }
    if (DEBUG_RISULTATI) {
      try { console.log('[risultati] init from searchParams', { qMode, qWeek }); } catch {}
    }
  }, [searchParams]);

  // If no explicit tab was set via query, align the visible tab to the current mode
  useEffect(() => {
    if (mode === 'live' && activeTab !== 'overview') {
      setActiveTab('overview');
    } else if (mode === 'test' && activeTab !== 'week') {
      setActiveTab('week');
    }
  }, [mode, activeTab]);
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

  const resetTestData = async () => {
    if (!firebaseUser || mode !== 'test') return;
    
    try {
      const userResponse = await apiClient.getUserByFirebaseUid(firebaseUser.uid);
      const userId = userResponse.data.id;
      
      await apiClient.resetTestData(userId);
      
      // Refresh data after reset
      fetchUserData();
    } catch (err) {
      console.error('Error resetting test data:', err);
      setError('Errore nel reset dei dati di test');
    }
  };

  // Unified reset flow used by banner reset and final completion veil
  const performTestReset = useCallback(async (opts?: { requireConfirm?: boolean }) => {
    if (!firebaseUser) return;
    try {
      const userResp = await apiClient.getUserByFirebaseUid(firebaseUser.uid);
      const uid = userResp?.data?.id as string | undefined;
      if (!uid) return;
      if (opts?.requireConfirm) {
        const ok = typeof window === 'undefined' ? true : window.confirm('Reimpostare la modalità TEST per questo utente? Tutte le predizioni verranno eliminate.');
        if (!ok) return;
      }
      try { await apiClient.resetTestData(uid); } catch {}
      try {
        if (typeof window !== 'undefined') {
          const toRemove: string[] = [];
          for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i) || '';
            const isGioca = k.startsWith('swipick:gioca:hasPreds:test:week:') && k.includes(`:user:${uid}`);
            const isReveal = k.startsWith('swipick:risultati:reveal:test:week:') && k.includes(`:user:${uid}`);
            const isAutoRoll = k === `swipick:risultati:autoRoll:week1:user:${uid}`;
            if (isGioca || isReveal || isAutoRoll) toRemove.push(k);
          }
          toRemove.forEach((k) => localStorage.removeItem(k));
        }
      } catch {}
      // Refresh summary and go back to week 1
      setSummary((prev) => (prev ? { ...prev, weeklyStats: [] } : prev));
      setSelectedWeek(1);
      setWeekCards([]);
      setWeeklyStats(null);
      setRevealed({});
      const href = typeof window !== 'undefined' ? window.location.href : null;
      if (href) {
        const url = new URL(href);
        url.searchParams.set('mode', 'test');
        url.searchParams.set('week', '1');
        window.history.replaceState({}, '', url.toString());
        setTimeout(() => {
          try { window.location.reload(); } catch {}
        }, 60);
      }
    } catch (e) {
      console.error('performTestReset failed', e);
    }
  }, [firebaseUser]);

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
  // Whether reveals are allowed for the current selection based on weekly stats (Test Mode: weeks > 1 require 10 predictions)
  const allowRevealThisWeek = useMemo(() => {
    if (mode !== 'test') return true;
    if (selectedWeek <= 1) return true;
    const total = Number(weeklyStats?.totalPredictions ?? 0);
    return total >= 10; // if unknown/missing stats, treat as not allowed until click-time check
  }, [mode, selectedWeek, weeklyStats]);

  // LocalStorage key for reveal state
  const revealKey = useMemo(() => {
    return userId ? `swipick:risultati:reveal:test:week:${selectedWeek}:user:${userId}` : null;
  }, [userId, selectedWeek]);

  // Load reveal state
  useEffect(() => {
    if (!revealKey) return;
    // Strictly block any reveals for weeks > 1 until predictions for that week are complete
    if (!allowRevealThisWeek) { setRevealed({}); return; }
    try {
      const raw = localStorage.getItem(revealKey);
      if (raw) {
        const parsed = JSON.parse(raw) as number[];
        const map: Record<number, boolean> = {};
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
        .map(([k]) => Number(k));
      localStorage.setItem(revealKey, JSON.stringify(ids));
    } catch {}
  }, [revealed, revealKey, allowRevealThisWeek]);

  // Load auto-rollover flag for week 1 (persisted) so we don't force week 2 when user navigates back
  useEffect(() => {
    if (!userId) return;
    try {
      const k = `swipick:risultati:autoRoll:week1:user:${userId}`;
      setRolledWeek1Once(localStorage.getItem(k) === '1');
    } catch {}
  }, [userId]);

  // Fetch week match-cards when in Test Mode
  useEffect(() => {
    const run = async () => {
      if (mode !== 'test') {
        setWeekCards([]);
        setWeeklyStats(null);
        setNextWeekRange(null);
        return;
      }
      try {
        const mcResponse = await apiClient.getTestMatchCardsByWeek(selectedWeek, userId ?? undefined) as unknown as { data?: MatchCard[] } | MatchCard[];
        const data = Array.isArray(mcResponse) ? mcResponse : mcResponse?.data ?? [];
        const sorted = (data as MatchCard[]).slice().sort((a, b) => new Date(a.kickoff.iso).getTime() - new Date(b.kickoff.iso).getTime());
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
  }, [mode, selectedWeek, userId]);

  // Preload next week's range for the header (placeholder only)
  useEffect(() => {
    const run = async () => {
      if (mode !== 'test') { setNextWeekRange(null); return; }
      const nxt = selectedWeek + 1;
      try {
        const resp = await apiClient.getTestMatchCardsByWeek(nxt, userId ?? undefined) as unknown as { data?: MatchCard[] } | MatchCard[];
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
  }, [mode, selectedWeek, userId]);

  // Fetch raw fixtures with scores for the selected week (fallback for result display)
  useEffect(() => {
    const run = async () => {
      if (mode !== 'test') { setFixtureScores(new Map()); return; }
      try {
        const resp = await apiClient.getTestFixturesByWeek(selectedWeek) as unknown as { data?: Array<FixtureRow> } | Array<FixtureRow>;
        const arr: FixtureRow[] = Array.isArray(resp) ? resp : (resp?.data ?? []);
        const map = new Map<number, { homeScore: number | null; awayScore: number | null; actual?: Choice }>();

        const parseResultRaw = (val: unknown): { hs: number | null; as: number | null } => {
          if (typeof val === 'string') {
            const m = val.match(/(\d+)\s*[-–]\s*(\d+)/);
            if (m) return { hs: Number(m[1]), as: Number(m[2]) };
          }
          return { hs: null, as: null };
        };

        for (const f of arr) {
          // Accept several id shapes
          const rawId = (f.id ?? f.fixture_id ?? f.fixtureId) as number | string | undefined;
          const fid = typeof rawId === 'string' ? Number(rawId) : rawId;

          // Accept several score shapes: homeScore/awayScore, home_goals/away_goals, homeGoals/awayGoals, result_raw
          let hs: number | null = null;
          let as: number | null = null;
          if (typeof f.homeScore === 'number' && typeof f.awayScore === 'number') {
            hs = f.homeScore; as = f.awayScore;
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
          if (Number.isFinite(fid as number)) {
            map.set(fid as number, { homeScore: hs, awayScore: as, actual });
          }
        }
        if (DEBUG_RISULTATI) {
          try {
            console.debug('[risultati] fixtures fallback built', { week: selectedWeek, count: map.size, keys: Array.from(map.keys()).slice(0, 12) });
          } catch {}
        }
        setFixtureScores(map);
      } catch {
        setFixtureScores(new Map());
      }
    };
    run();
  }, [mode, selectedWeek]);

  // Helper: load weekly stats when needed
  const loadWeeklyStats = useCallback(async (week: number) => {
    if (mode !== 'test' || !userId) { setWeeklyStats(null); return; }
    try {
      const resp = await apiClient.getTestWeeklyStats(userId, week);
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
  }, [mode, userId]);

  // Fetch weekly stats for selected week (Test Mode)
  useEffect(() => {
    if (mode !== 'test' || !userId) { setWeeklyStats(null); return; }
    loadWeeklyStats(selectedWeek);
  }, [mode, selectedWeek, userId, loadWeeklyStats]);

  // (Removed) Preload week 2 completion to avoid noisy 404s in prod; check lazily on reveal instead.

  // Build lookup by fixtureId from weekly stats predictions
  const predByFixture = useMemo(() => {
    const map = new Map<number, { prediction: Choice | null; actual?: Choice; isCorrect?: boolean; homeScore?: number | null; awayScore?: number | null }>();
    if (!weeklyStats) return map;
    for (const p of weeklyStats.predictions || []) {
      const actual = ((): Choice | undefined => {
        const v = (p.actualResult || '').toUpperCase();
        return v === '1' || v === 'X' || v === '2' ? (v as Choice) : undefined;
      })();
      const pred = ((): Choice | null => {
        const v = (p.userChoice || '').toUpperCase();
        return v === '1' || v === 'X' || v === '2' ? (v as Choice) : null;
      })();
      map.set(p.fixtureId, { prediction: pred, actual, isCorrect: p.isCorrect, homeScore: p.homeScore, awayScore: p.awayScore });
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
    if (mode !== 'test' || weekCards.length === 0) return { revealed: 0, correct: 0, percent: 0 };
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
  }, [mode, weekCards, revealed, predByFixture]);

  // Share handler (defined after meter so it can reference it safely)
  const handleShare = useCallback(async () => {
    const title = `Giornata ${selectedWeek} — Swipick`;
    const text = `Ho rivelato ${meter.revealed}/10: ${meter.correct} corrette (${meter.percent}%).`;
    const url = typeof window !== 'undefined' ? window.location.href : undefined;
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
  }, [selectedWeek, meter]);

  const onReveal = async (fixtureId: number) => {
    // Guard: in Test Mode, for weeks > 1, require at least 10 predictions to reveal
    if (mode === 'test' && selectedWeek > 1) {
      // Fast-path: if current stats show not allowed, block and try re-check to be safe
      if (!allowRevealThisWeek) {
        if (userId) {
          try {
            const resp = await apiClient.getTestWeeklyStats(userId, selectedWeek);
            const stats: TestWeeklyStatsResp | null = (resp && typeof resp === 'object' && 'data' in (resp as Record<string, unknown>))
              ? (resp as { data: TestWeeklyStatsResp }).data
              : (resp as unknown as TestWeeklyStatsResp | null);
            const total = Number(stats?.totalPredictions ?? 0);
            if (DEBUG_RISULTATI) { try { console.log('[risultati] reveal recheck', { week: selectedWeek, totalPredictions: total }); } catch {} }
            setWeeklyStats(stats ?? null);
            if (total < 10) {
              if (DEBUG_RISULTATI) { try { console.warn('[risultati] reveal blocked', { week: selectedWeek, fixtureId, reason: 'predictions<10' }); } catch {} }
              // determine earliest incomplete prerequisite week (2..selectedWeek)
              const determineTarget = async (): Promise<number> => {
                const needsFor = async (w: number): Promise<number> => {
                  // prefer summary if available
                  const sum = (summary?.weeklyStats || []).find((s) => Number(s.week) === w);
                  let total = typeof sum?.totalPredictions === 'number' ? Number(sum.totalPredictions) : NaN;
                  if (!Number.isFinite(total)) {
                    try {
                      const r = await apiClient.getTestWeeklyStats(userId, w);
                      const s = (r && typeof r === 'object' && 'data' in (r as Record<string, unknown>))
                        ? (r as { data: TestWeeklyStatsResp }).data
                        : (r as unknown as TestWeeklyStatsResp | null);
                      total = Number(s?.totalPredictions ?? 0);
                    } catch { total = 0; }
                  }
                  return total >= 10 ? 0 : w; // 0 means complete
                };
                // Check from week 2 up to selectedWeek-1
                for (let w = 2; w < selectedWeek; w++) {
                  const res = await needsFor(w);
                  if (res !== 0) return res; // earliest incomplete prerequisite
                }
                return selectedWeek; // all prerequisites complete; send to current selected
              };
              try {
                const tgt = await determineTarget();
                setGuardTargetWeek(tgt);
              } catch { setGuardTargetWeek(2); }
              setGuardVeilOpen(true);
              return;
            }
          } catch (e) {
            // If stats unavailable, be safe and block reveals
            if (DEBUG_RISULTATI) { try { console.warn('[risultati] reveal blocked (stats unavailable)', { week: selectedWeek, fixtureId }); } catch {} }
            // Fallback target week logic when stats unavailable
            setGuardTargetWeek(Math.min(2, selectedWeek));
            setGuardVeilOpen(true);
            return;
          }
        } else {
          // No userId yet, cannot verify — block
          setGuardTargetWeek(2);
          setGuardVeilOpen(true);
          return;
        }
      }
    }
    if (DEBUG_RISULTATI) { try { console.log('[risultati] reveal allowed', { week: selectedWeek, fixtureId }); } catch {} }
    // Ensure stats are present to show scores once reveal is allowed
    if (!weeklyStats) {
      await loadWeeklyStats(selectedWeek);
    }
    if (DEBUG_RISULTATI) {
      try {
        const joinPred = predByFixture.get(fixtureId);
        const joinFx = fixtureScores.get(fixtureId);
        console.debug('[risultati] onReveal join', { fixtureId, weeklyPresent: !!weeklyStats, pred: joinPred, fallback: joinFx });
      } catch {}
    }
    // Determine if this click completes all reveals for Giornata 4 (Test Mode)
    const completesWeek4 = (() => {
      if (mode !== 'test') return false;
      if (selectedWeek !== 4) return false;
      if (weekCards.length !== 10) return false;
      const wasRevealed = !!revealed[fixtureId];
      if (wasRevealed) return false;
      const already = Object.values(revealed).filter(Boolean).length;
      return already + 1 === 10;
    })();

    setRevealed((prev) => ({ ...prev, [fixtureId]: true }));
    if (completesWeek4) {
      setTimeout(() => setFinalVeilOpen(true), 80); // allow UI to update first
    }
  };

  // Auto-rollover to week 2 when all 10 revealed in week 1 (only once)
  useEffect(() => {
    if (mode !== 'test') return;
    if (selectedWeek !== 1) return;
    if (rolledWeek1Once) return; // don't auto-roll again when user returns to week 1
    if (weekCards.length === 10) {
      const allRevealed = weekCards.every((m) => revealed[m.fixtureId]);
      if (allRevealed) {
        // Reset and go to week 2
        try {
          const k = `swipick:risultati:autoRoll:week1:user:${userId ?? 'anon'}`;
          localStorage.setItem(k, '1');
        } catch {}
        setRolledWeek1Once(true);
        updateWeek(2);
        setRevealed({});
      }
    }
  }, [mode, selectedWeek, weekCards, revealed, updateWeek, rolledWeek1Once, userId]);

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
    <div className="min-h-screen bg-white pb-20">
      <div className="pb-4">
        {/* Test Mode banner with Reset */}
        {mode === 'test' && (
          <div className="bg-orange-500 text-white py-2 px-3 font-semibold flex items-center justify-between">
            <div>🧪 MODALITÀ TEST - Dati storici Serie A 2023-24</div>
            <button
              onClick={() => performTestReset({ requireConfirm: true })}
              className="text-xs font-semibold border rounded-md px-2.5 py-1 border-white/70 hover:bg-white/10"
            >
              Reset
            </button>
          </div>
        )}
        {/* Top Header Panel (modal-like) */}
        <div
          className="w-full mx-0 mt-0 mb-6 rounded-b-2xl rounded-t-none text-white"
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
              <div className="text-2xl font-bold">Giornata {selectedWeek}</div>
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
            {/* Success Meter area (replaces tabs row per design for Test Mode) */}
      {mode === 'test' && (
              <div className="px-4 mb-2">
        <CircularMeter percent={meter.percent} onShare={handleShare} shareEnabled={shareSupported} />
              </div>
            )}

            {/* Week Tab (Test Mode) */}
            {(mode === 'test') && (
              <div className="px-4 space-y-6">
            {/* Small helper row under meter */}
            <div className="flex items-center justify-between text-black text-sm px-1">
              {/* <div className="opacity-70">Mostra i risultati una partita alla volta</div> */}
              {/* <div className="opacity-80">{meter.correct}/{meter.revealed} corrette</div> */}
            </div>

            {/* Matches list */}
            {weekCards.length === 0 ? (
              <div className="bg-white rounded-xl p-8 text-center text-black border border-black/5">Nessuna partita trovata</div>
            ) : (
              <div className="space-y-3">
                {weekCards.map((m) => {
                  const fid = Number(m.fixtureId);
                  const pred = predByFixture.get(fid);
                  const scoreFallback = fixtureScores.get(fid);
                  const isRevealed = !!revealed[m.fixtureId];
                  const statusLabel = isRevealed ? 'FINE PARTITA' : 'MOSTRA RISULTATO';
                  const statusColor = isRevealed ? 'bg-gray-200 text-gray-700' : 'bg-indigo-500 bg-opacity-90 text-white';
                  if (isRevealed && !pred && !scoreFallback) {
                    // Minimal diagnostic to help trace missing scores in prod without spamming
                    console.warn('No score data found for fixture', fid, 'in week', selectedWeek);
                  }
                  const homeVal = isRevealed ? (pred?.homeScore ?? scoreFallback?.homeScore) : undefined;
                  const awayVal = isRevealed ? (pred?.awayScore ?? scoreFallback?.awayScore) : undefined;
                  if (DEBUG_RISULTATI && isRevealed && homeVal == null && awayVal == null) {
                    try { console.debug('[risultati] revealed but no scores', { fid, week: selectedWeek }); } catch {}
                  }
                  return (
                    <div key={m.fixtureId} className="bg-white rounded-2xl p-4 shadow-[0_8px_24px_rgba(0,0,0,0.06)] border border-black/5">
                      <div className="grid grid-cols-[minmax(0,1fr)_auto_auto_auto] gap-4 items-center">
                        {/* Col 1: Teams (no date) */}
                        <div className="flex flex-col gap-3">
                          <div className="flex items-center gap-3 h-12">
                            {m.home.logo ? (
                              <Image src={m.home.logo} alt={m.home.name} width={48} height={48} className="rounded" />
                            ) : (
                              <div className="w-12 h-12 rounded bg-gray-100" />
                            )}
              <div className="text-black font-bold truncate">{m.home.name}</div>
                          </div>
                          <div className="flex items-center gap-3 h-12">
                            {m.away.logo ? (
                              <Image src={m.away.logo} alt={m.away.name} width={48} height={48} className="rounded" />
                            ) : (
                              <div className="w-12 h-12 rounded bg-gray-100" />
                            )}
              <div className="text-black font-bold truncate">{m.away.name}</div>
                          </div>
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
                            onClick={() => onReveal(m.fixtureId)}
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
                            const correct = actual === c && isRevealed;
                            const classes = correct
                              ? 'bg-[#ccffb3] text-[#2a8000]'
                              : chosen && isRevealed
                                ? 'bg-[#ffb3b3] text-[#cc0000]'
                                : 'bg-gray-100 text-gray-700';
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
            )}
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

            {/* Test Mode Reset Button */}
            {mode === 'test' && (
              <button
                onClick={resetTestData}
                className="w-full bg-red-500 bg-opacity-80 text-white py-3 rounded-xl font-medium hover:bg-opacity-100 transition-all"
              >
                Reset Dati Test
              </button>
            )}
          </div>
        )}

        {/* History Tab */}
        {activeTab === 'history' && (
          <div className="space-y-4">
            {history.length === 0 ? (
              <div className="bg-white bg-opacity-20 rounded-xl p-8 text-center">
                <div className="text-white text-lg">Nessuna predizione trovata</div>
                <div className="text-white text-opacity-60 mt-2">
                  {mode === 'test' ? 'Inizia a giocare in modalità test!' : 'Fai le tue prime predizioni!'}
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
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t">
          <div className="flex">
            <button
              onClick={() => {
                if (DEBUG_RISULTATI) { try { console.log('[risultati] nav -> risultati (self)'); } catch {} }
                router.push(`/risultati?mode=${mode}${mode === 'test' ? `&week=${selectedWeek}` : ''}`);
              }}
              className="flex-1 text-center py-4 border-b-2 border-purple-600"
            >
              <div className="text-purple-600 mb-1">
                <svg className="w-6 h-6 mx-auto" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M9 11H7v6h2v-6zm4 0h-2v6h2v-6zm4 0h-2v6h2v-6zM4 22h16v-2H4v2zm0-4h16v-2H4v2zm0-4h16v-2H4v2zm0-4h16V8H4v2zm0-6h16V2H4v2z"/>
                </svg>
              </div>
              <span className="text-xs text-purple-600 font-medium">Risultati</span>
            </button>
            <button
              onClick={() => {
                if (DEBUG_RISULTATI) { try { console.log('[risultati] nav -> gioca', { mode, week: selectedWeek }); } catch {} }
                router.push(`/gioca?mode=${mode}${mode === 'test' ? `&week=${selectedWeek}` : ''}`);
              }}
              className="flex-1 text-center py-4"
            >
              <div className="text-gray-400 mb-1">
                <svg className="w-6 h-6 mx-auto" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                </svg>
              </div>
              <span className="text-xs text-gray-500">Gioca</span>
            </button>
            <button
              onClick={() => router.push('/profilo')}
              className="flex-1 text-center py-4"
            >
              <div className="text-gray-400 mb-1">
                <svg className="w-6 h-6 mx-auto" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2c1.1 0 2 .9 2 2 0 .74-.4 1.38-1 1.72v.78h-.5c-.83 0-1.5.67-1.5 1.5v.5c0 .28-.22.5-.5.5s-.5-.22-.5-.5v-.5c0-1.38 1.12-2.5 2.5-2.5H13V5.72c-.6-.34-1-.98-1-1.72 0-1.1.9-2 2-2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"/>
                </svg>
              </div>
              <span className="text-xs text-gray-500">Profilo</span>
            </button>
          </div>
        </div>
      </div>
      {/* Multi-week Guard Veil (Test Mode): weeks > 1 require 10 predictions to reveal */}
      {guardVeilOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-[2px]">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-[88%] max-w-md text-center">
            <h3 className="text-xl font-semibold text-black mb-2">Completa prima le tue giocate</h3>
            <p className="text-sm text-gray-700 mb-5">
              {(() => {
                const tgt = guardTargetWeek ?? selectedWeek;
                if (tgt !== selectedWeek) {
                  return (
                    <span>
                      Per poter vedere i risultati della Giornata {selectedWeek}, completa prima le giocate delle giornate precedenti.
                      Vai a Gioca per la Giornata {tgt}.
                    </span>
                  );
                }
                return (
                  <span>
                    Prima gioca le tue speculazioni nella pagina Gioca per la Giornata {selectedWeek}.
                  </span>
                );
              })()}
            </p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => setGuardVeilOpen(false)}
                className="px-5 py-2 rounded-md border border-gray-300 text-black font-medium hover:bg-gray-50"
              >
                Chiudi
              </button>
              <button
                onClick={() => {
                  const tgt = guardTargetWeek ?? selectedWeek;
                  if (DEBUG_RISULTATI) { try { console.log('[risultati] guard CTA -> gioca', { selectedWeek, target: tgt }); } catch {} }
                  router.push(`/gioca?mode=test&week=${tgt}`);
                }}
                className="px-5 py-2 rounded-md bg-purple-600 text-white font-medium hover:bg-purple-700"
              >
                Vai a Gioca
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Final Completion Veil (after last reveal in Giornata 4) */}
      {finalVeilOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 backdrop-blur-[2px]">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-[88%] max-w-md text-center">
            <h3 className="text-xl font-semibold text-black mb-2">Grazie per aver completato il gioco di prova</h3>
            <p className="text-sm text-gray-700 mb-5">
              Hai completato tutte le rivelazioni della Giornata 4. Puoi reimpostare la Modalità Test per ricominciare da capo.
            </p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => setFinalVeilOpen(false)}
                className="px-5 py-2 rounded-md border border-gray-300 text-black font-medium hover:bg-gray-50"
              >
                Annulla
              </button>
              <button
                onClick={() => performTestReset({ requireConfirm: false })}
                className="px-5 py-2 rounded-md bg-purple-600 text-white font-medium hover:bg-purple-700"
              >
                Reset
              </button>
            </div>
          </div>
        </div>
      )}
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
