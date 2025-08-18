'use client';

import React, { useState, useEffect, useCallback, useMemo, Suspense } from 'react';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuthContext } from '@/src/contexts/AuthContext';
import { apiClient } from '@/lib/api-client';
import { IoShareOutline } from 'react-icons/io5';
// Gradient header is inlined; page background is white per design

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
  const [guardOpen, setGuardOpen] = useState(false);
  const [weeklyStats, setWeeklyStats] = useState<TestWeeklyStatsResp | null>(null);
  const [week2Complete, setWeek2Complete] = useState<boolean | null>(null);
  const [nextWeekRange, setNextWeekRange] = useState<{ from: string; to: string } | null>(null);

  // Semi-circular success meter (SVG half-donut) sized to match the share button width
  const CircularMeter: React.FC<{ percent: number }> = ({ percent }) => {
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
          onClick={() => console.log('Condividi risultato')}
          className="mt-2 inline-flex items-center justify-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-xl text-sm font-medium shadow hover:bg-indigo-700 transition w-[200px]"
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
  }, [searchParams]);

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
  // LocalStorage key for reveal state
  const revealKey = useMemo(() => {
    return userId ? `swipick:risultati:reveal:test:week:${selectedWeek}:user:${userId}` : null;
  }, [userId, selectedWeek]);

  // Load reveal state
  useEffect(() => {
    if (!revealKey) return;
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
  }, [revealKey]);

  // Persist reveal state
  useEffect(() => {
    if (!revealKey) return;
    try {
      const ids = Object.entries(revealed)
        .filter(([, v]) => v)
        .map(([k]) => Number(k));
      localStorage.setItem(revealKey, JSON.stringify(ids));
    } catch {}
  }, [revealed, revealKey]);

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

  // Fetch weekly stats for selected week (Test Mode)
  useEffect(() => {
    const run = async () => {
      if (mode !== 'test' || !userId) {
        setWeeklyStats(null);
        return;
      }
      try {
        const resp = await apiClient.getTestWeeklyStats(userId, selectedWeek);
        const stats: TestWeeklyStatsResp | null = (resp && typeof resp === 'object' && 'data' in (resp as Record<string, unknown>))
          ? (resp as { data: TestWeeklyStatsResp }).data
          : (resp as unknown as TestWeeklyStatsResp | null);
        setWeeklyStats(stats ?? null);
      } catch (e) {
        console.warn('Failed to load weekly stats for week', selectedWeek, e);
        setWeeklyStats(null);
      }
    };
    run();
  }, [mode, selectedWeek, userId]);

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

  // Week 2 guard: predictions completeness check (from weekly stats)
  const hasWeek2Complete = week2Complete;

  const onReveal = async (fixtureId: number) => {
    if (mode === 'test' && selectedWeek === 2) {
      if (hasWeek2Complete === null && userId) {
        try {
          const resp = await apiClient.getTestWeeklyStats(userId, 2);
          const stats: TestWeeklyStatsResp | null = (resp && typeof resp === 'object' && 'data' in (resp as Record<string, unknown>))
            ? (resp as { data: TestWeeklyStatsResp }).data
            : (resp as unknown as TestWeeklyStatsResp | null);
          const total = Number(stats?.totalPredictions ?? 0);
          const completed = total >= 10;
          setWeek2Complete(completed);
          if (!completed) {
            setGuardOpen(true);
            return;
          }
        } catch {
          // Endpoint missing in prod; allow reveal instead of blocking
          setWeek2Complete(true);
        }
      } else if (hasWeek2Complete === false) {
        setGuardOpen(true);
        return;
      }
    }
    setRevealed((prev) => ({ ...prev, [fixtureId]: true }));
  };

  // Auto-rollover to week 2 when all 10 revealed in week 1
  useEffect(() => {
    if (mode !== 'test') return;
    if (selectedWeek !== 1) return;
    if (weekCards.length === 10) {
      const allRevealed = weekCards.every((m) => revealed[m.fixtureId]);
      if (allRevealed) {
        // Reset and go to week 2
        setSelectedWeek(2);
        setRevealed({});
      }
    }
  }, [mode, selectedWeek, weekCards, revealed]);

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
        {/* Top Header Panel (modal-like) */}
        <div
          className="w-full mx-0 mt-0 mb-6 rounded-b-2xl rounded-t-none text-white"
          style={{ background: 'radial-gradient(circle at center, #554099, #3d2d73)', boxShadow: '0 8px 16px rgba(85, 64, 153, 0.3), 0 4px 8px rgba(0, 0, 0, 0.2)' }}
        >
          <div className="relative px-4 pt-10 pb-6">
            {/* Faded previous (left) */}
            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-white text-sm opacity-30 select-none">
              {selectedWeek > 1 ? (
                <div>
                  <div className="font-medium">Giornata {selectedWeek - 1}</div>
                  <div className="text-xs">{/* intentionally blank or could compute prev range */}</div>
                </div>
              ) : (
                <div className="h-6" />
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

            {/* Faded next (right) */}
            <div className="absolute right-4 top-1/2 -translate-y-1/2 text-white text-sm opacity-60 select-none text-right">
              <div className="font-medium">Giornata {selectedWeek + 1}</div>
              <div className="text-xs">{nextWeekRange ? `dal ${nextWeekRange.from} al ${nextWeekRange.to}` : ''}</div>
            </div>
          </div>
        </div>

  {/* No secondary header; mode toggle stays if needed in future */}

        {/* Success Meter area (replaces tabs row per design for Test Mode) */}
        {mode === 'test' && (
          <div className="px-4 mb-2">
            <CircularMeter percent={meter.percent} />
          </div>
        )}

        {/* Week Tab (Test Mode) */}
        {(mode === 'test') && (
          <div className="px-4 space-y-6">
            {/* Small helper row under meter */}
            <div className="flex items-center justify-between text-black text-sm px-1">
              <div className="opacity-70">Mostra i risultati una partita alla volta</div>
              <div className="opacity-80">{meter.correct}/{meter.revealed} corrette</div>
            </div>

            {/* Matches list */}
            {weekCards.length === 0 ? (
              <div className="bg-white rounded-xl p-8 text-center text-black border border-black/5">Nessuna partita trovata</div>
            ) : (
              <div className="space-y-3">
                {weekCards.map((m) => {
                  const pred = predByFixture.get(m.fixtureId);
                  const isRevealed = !!revealed[m.fixtureId];
                  const statusLabel = isRevealed ? 'FINE PARTITA' : 'Mostra risultato';
                  const statusColor = isRevealed ? 'bg-gray-200 text-gray-700' : 'bg-indigo-500 bg-opacity-90 text-white';
                  return (
                    <div key={m.fixtureId} className="bg-white rounded-2xl p-4 shadow-[0_8px_24px_rgba(0,0,0,0.06)] border border-black/5">
                      <div className="grid grid-cols-[minmax(0,1fr)_auto_auto_auto] gap-4 items-center">
                        {/* Col 1: Teams (no date) */}
                        <div className="flex flex-col gap-3">
                          <div className="flex items-center gap-3">
                            {m.home.logo ? (
                              <Image src={m.home.logo} alt={m.home.name} width={28} height={28} className="rounded" />
                            ) : (
                              <div className="w-7 h-7 rounded bg-gray-100" />
                            )}
                            <div className="text-black font-medium truncate">{m.home.name}</div>
                          </div>
                          <div className="flex items-center gap-3">
                            {m.away.logo ? (
                              <Image src={m.away.logo} alt={m.away.name} width={28} height={28} className="rounded" />
                            ) : (
                              <div className="w-7 h-7 rounded bg-gray-100" />
                            )}
                            <div className="text-black font-medium truncate">{m.away.name}</div>
                          </div>
                        </div>

                        {/* Col 2: Final scores (two rows) */}
                        <div className="flex flex-col items-center gap-5 pr-1">
                          <div className="text-2xl leading-none font-semibold text-black min-w-[16px] text-center">{isRevealed ? (pred?.homeScore ?? '–') : '–'}</div>
                          <div className="text-2xl leading-none font-semibold text-black min-w-[16px] text-center">{isRevealed ? (pred?.awayScore ?? '–') : '–'}</div>
                        </div>

                        {/* Col 3: Status button (centered) */}
                        <div className="flex items-center justify-center">
                          <button
                            onClick={() => onReveal(m.fixtureId)}
                            disabled={isRevealed}
                            className={`px-3 py-2 rounded-md text-xs font-medium ${statusColor} ${isRevealed ? 'opacity-100 cursor-default' : 'hover:bg-opacity-100'}`}
                          >
                            {statusLabel}
                          </button>
                        </div>

                        {/* Col 4: 1 / X / 2 vertical stack */}
                        <div className="flex flex-col items-center gap-2">
                          {(['1','X','2'] as Choice[]).map((c) => {
                            const chosen = pred?.prediction === c;
                            const correct = pred?.actual === c && isRevealed;
                            const classes = correct
                              ? 'bg-green-500 text-white'
                              : chosen && isRevealed
                                ? 'bg-indigo-500 text-white'
                                : 'bg-gray-100 text-gray-700';
                            return (
                              <div key={c} className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${classes}`}>{c}</div>
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
              onClick={() => router.push('/risultati')}
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
              onClick={() => router.push('/gioca')}
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
      {/* Week 2 Guard Modal */}
      {guardOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-2xl p-6 w-11/12 max-w-md">
            <h3 className="text-lg font-bold mb-2">Completa prima le tue giocate</h3>
            <p className="text-gray-700 mb-4">Prima gioca le tue speculazioni nella pagina Gioca per la Giornata 2.</p>
            <div className="flex space-x-3">
              <button
                onClick={() => setGuardOpen(false)}
                className="flex-1 px-4 py-2 rounded-lg bg-gray-200 hover:bg-gray-300"
              >
                Annulla
              </button>
              <button
                onClick={() => router.push('/gioca?mode=test&week=2')}
                className="flex-1 px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700"
              >
                Vai a Gioca
              </button>
            </div>
          </div>
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
