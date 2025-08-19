'use client';

import { useState, useEffect, Suspense, useCallback, useRef } from "react";
import { motion, useAnimationControls, PanInfo } from 'framer-motion';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import { apiClient } from "@/lib/api-client";
import { getLogoForTeam } from "@/lib/club-logos";
import { useGameMode } from "@/src/contexts/GameModeContext";
import { useAuthContext } from "@/src/contexts/AuthContext";

// Debug flag (enable with NEXT_PUBLIC_DEBUG_GIOCA=1)
const DEBUG_GIOCA = typeof process !== 'undefined' && process.env.NEXT_PUBLIC_DEBUG_GIOCA === '1';

interface Team {
  id: number;
  name: string;
  logo: string;
  winner?: boolean;
}

interface Fixture {
  id: number;
  date: string;
  timestamp: number;
  venue: {
    id: number;
    name: string;
    city: string;
  };
  status: {
    long: string;
    short: string;
    elapsed?: number;
  };
  league: {
    id: number;
    name: string;
    country: string;
    logo?: string;
    season: number;
    round: string;
  };
  teams: {
    home: Team;
    away: Team;
  };
  goals: {
    home?: number;
    away?: number;
  };
  score: {
    halftime: {
      home?: number;
      away?: number;
    };
    fulltime: {
      home?: number;
      away?: number;
    };
  };
}

// Shape returned by Test Mode API (backend)
interface TestFixtureAPI {
  id?: number;
  week?: number;
  date: string | number | Date;
  homeTeam: string;
  awayTeam: string;
  homeScore?: number;
  awayScore?: number;
  status?: string;
  stadium?: string | null;
}

// Match-cards API types
interface MatchCardKickoff { iso: string; display: string; }
interface Last5Item { fixtureId: number; code: '1'|'X'|'2'; predicted: '1'|'X'|'2'|null; correct: boolean|null; }
interface MatchCardTeamHome { name: string; logo: string | null; winRateHome: number | null; last5: Array<'1' | 'X' | '2'>; standingsPosition?: number|null; form?: Last5Item[]; }
interface MatchCardTeamAway { name: string; logo: string | null; winRateAway: number | null; last5: Array<'1' | 'X' | '2'>; standingsPosition?: number|null; form?: Last5Item[]; }
interface MatchCard { week: number; fixtureId: number; kickoff: MatchCardKickoff; stadium: string | null; home: MatchCardTeamHome; away: MatchCardTeamAway; }

function isTestFixture(obj: unknown): obj is TestFixtureAPI {
  if (typeof obj !== 'object' || obj === null) return false;
  const o = obj as Record<string, unknown>;
  return (
    typeof o.homeTeam === 'string' &&
    typeof o.awayTeam === 'string' &&
    ('date' in o)
  );
}

function isTestFixtureArray(arr: unknown): arr is TestFixtureAPI[] {
  return Array.isArray(arr) && arr.every(isTestFixture);
}

function GiocaPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { mode, setMode } = useGameMode();
  const { firebaseUser } = useAuthContext();
  
  // Get mode from URL parameters or context
  const currentMode = (searchParams.get('mode') as 'live' | 'test') || mode;
  // Selected week for test mode (defaults to 1)
  const selectedWeek = (() => {
    const w = Number(searchParams.get('week'));
    return Number.isFinite(w) && w >= 1 && w <= 38 ? w : 1;
  })();
  
  const [fixtures, setFixtures] = useState<Fixture[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentFixtureIndex, setCurrentFixtureIndex] = useState(0);
  const [predictions, setPredictions] = useState<Record<number, '1' | 'X' | '2'>>({});
  const [matchCards, setMatchCards] = useState<MatchCard[]>([]);
  const controls = useAnimationControls();
  // Backend user id (UUID string) for Test Mode persistence/overlays
  const [userKey, setUserKey] = useState<string | null>(null);
  const [userMissingModal, setUserMissingModal] = useState<{ show: boolean; triedUid?: string }>(() => ({ show: false }));
  // Test Mode: if week already completed (10/10 predictions), disable gameplay and show veil
  const [weekComplete, setWeekComplete] = useState(false);
  // Persisted rollover flag from Risultati once all 10 of week 1 are revealed
  const [rolledWeek1Once, setRolledWeek1Once] = useState(false);
  const didDefaultWeekRef = useRef(false);
  const mismatchLogOnceRef = useRef(false);
  // Local flag to avoid noisy 404 on week-2 stats before any picks exist
  const hasWeekPredsKey = useCallback((week: number, u?: string | null) => {
    return `swipick:gioca:hasPreds:test:week:${week}:user:${u ?? 'anon'}`;
  }, []);

  // Update context if mode changed via URL
  useEffect(() => {
    if (currentMode !== mode) {
      setMode(currentMode);
    }
  }, [currentMode, mode, setMode]);

  useEffect(() => {
    let cancelled = false;
    const fetchFixtures = async () => {
      try {
        setLoading(true);
        setError(null);
  let fixtureData: Fixture[] = [];
  let mcLenForLog = 0;
  let cardsArrLocal: MatchCard[] = [];

    if (currentMode === 'test') {
          // If we should be on week 2 due to rollover, avoid fetching week 1 and flip URL first
      if (selectedWeek === 1) {
            try {
              let rolled = false;
              if (typeof window !== 'undefined' && window.localStorage) {
                for (let i = 0; i < localStorage.length; i++) {
                  const k = localStorage.key(i) || '';
                  if (k.startsWith('swipick:risultati:autoRoll:week1:user:') && localStorage.getItem(k) === '1') {
                    rolled = true;
                    break;
                  }
                }
              }
              if (rolled) {
                if (DEBUG_GIOCA) { try { console.log('[gioca] suppress week1 fetch due to rollover flag; redirecting to week=2'); } catch {} }
                // Flip URL to week=2 and exit early; next effect run will fetch week 2
                const href = typeof window !== 'undefined' ? window.location.href : null;
                if (href) {
                  const url = new URL(href);
                  url.searchParams.set('mode', 'test');
                  url.searchParams.set('week', '2');
                  router.replace(url.toString());
                }
        if (!cancelled) setLoading(false);
        return; // don't fetch week 1
              }
            } catch {}
          }
          // In Test Mode, wait for backend user id to avoid double-fetch (w/o and with overlay)
          if (!userKey) {
            if (DEBUG_GIOCA) { try { console.log('[gioca] defer fetch until userKey is resolved'); } catch {} }
      if (!cancelled) setLoading(false);
      return;
          }
          // Fetch enriched match-cards for card stats
          try {
      const userIdForOverlay = userKey ?? undefined;
            const mcResponse = await apiClient.getTestMatchCardsByWeek(selectedWeek, userIdForOverlay);
            let mcRaw: unknown = mcResponse;
            if (mcResponse && typeof mcResponse === 'object' && 'data' in (mcResponse as Record<string, unknown>)) {
              mcRaw = (mcResponse as Record<string, unknown>).data as unknown;
            }
            if (Array.isArray(mcRaw)) {
              const arr = (mcRaw as MatchCard[]).slice().sort((a, b) => new Date(a.kickoff.iso).getTime() - new Date(b.kickoff.iso).getTime());
              cardsArrLocal = arr;
              if (DEBUG_GIOCA) {
                try { console.log('[gioca] match-cards loaded', { week: selectedWeek, count: arr.length, first: arr[0]?.fixtureId, userIdForOverlay }); } catch {}
              }
              mcLenForLog = arr.length;
            } else {
              cardsArrLocal = [];
              if (DEBUG_GIOCA) {
                try { console.log('[gioca] match-cards empty-or-bad-shape', { week: selectedWeek, mcType: typeof mcRaw }); } catch {}
              }
            }
          } catch {
            cardsArrLocal = [];
            if (DEBUG_GIOCA) {
              try { console.log('[gioca] match-cards fetch failed'); } catch {}
            }
          }

          // Existing fixtures for header/date-range and navigation
          const response = await apiClient.getTestFixtures(selectedWeek);
          let raw: unknown = response;
          if (
            typeof response === 'object' &&
            response !== null &&
            'data' in (response as Record<string, unknown>) &&
            Array.isArray((response as { data?: unknown }).data)
          ) {
            raw = (response as { data: unknown }).data;
          }
          if (isTestFixtureArray(raw)) {
            const mapped = (raw as TestFixtureAPI[])
              .filter((f) => (typeof f.week === 'number' ? f.week === selectedWeek : true))
              .map((f, idx) => {
                const iso = typeof f.date === 'string' ? f.date : new Date(f.date).toISOString();
                return {
                  id: typeof f.id === 'number' ? f.id : idx + 1,
                  date: iso,
                  timestamp: Math.floor(new Date(iso).getTime() / 1000),
                  venue: { id: typeof f.id === 'number' ? f.id : idx + 1, name: String(f.stadium || `${f.homeTeam} vs ${f.awayTeam}`), city: 'N/A' },
                  status: { long: f.status === 'FT' ? 'Match Finished' : 'Scheduled', short: String(f.status || '') },
                  league: { id: 135, name: 'Serie A (Test)', country: 'Italy', season: 2023, round: `Week ${f.week ?? selectedWeek}` },
                  teams: {
                    home: { id: ((typeof f.id === 'number' ? f.id : idx + 1) * 10) + 1, name: String(f.homeTeam || 'Home'), logo: getLogoForTeam(String(f.homeTeam || '')) || '' },
                    away: { id: ((typeof f.id === 'number' ? f.id : idx + 1) * 10) + 2, name: String(f.awayTeam || 'Away'), logo: getLogoForTeam(String(f.awayTeam || '')) || '' },
                  },
                  goals: { home: Number.isFinite(f.homeScore as number) ? Number(f.homeScore) : undefined, away: Number.isFinite(f.awayScore as number) ? Number(f.awayScore) : undefined },
                  score: { halftime: {}, fulltime: { home: Number(f.homeScore ?? 0), away: Number(f.awayScore ?? 0) } },
                } as Fixture;
              });
            fixtureData = mapped.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()).slice(0, 10);
            if (DEBUG_GIOCA) {
              try { console.log('[gioca] fixtures loaded', { week: selectedWeek, count: fixtureData.length, first: fixtureData[0]?.id }); } catch {}
            }
          }
        } else {
          // Load live fixtures
          const response = await apiClient.getUpcomingSerieAFixtures(7);
          if (response.error) {
            throw new Error(response.error);
          }
          fixtureData = response.data || response;
        }
        
        // Align arrays by position and trim to the same length to avoid UI overlap on first paint
        if (currentMode === 'test') {
          const minLen = Math.min(fixtureData.length, cardsArrLocal.length);
          if (minLen > 0) {
            fixtureData = fixtureData.slice(0, minLen);
            cardsArrLocal = cardsArrLocal.slice(0, minLen);
          }
          if (cancelled) return;
          setMatchCards(cardsArrLocal);
        }
        if (cancelled) return;
        setFixtures(fixtureData);
        setCurrentFixtureIndex(0);
        if (DEBUG_GIOCA) {
          try {
            console.log('[gioca] fetch complete', { mode: currentMode, week: selectedWeek, fixtures: fixtureData.length, matchCards: mcLenForLog, alignedTo: currentMode === 'test' ? Math.min(fixtureData.length, cardsArrLocal.length) : fixtureData.length, userKey });
          } catch {}
        }
      } catch (err) {
        console.error('Error fetching fixtures:', err);
        setError(err instanceof Error ? err.message : 'Errore nel caricamento delle partite');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchFixtures();
    return () => { cancelled = true; };
  }, [currentMode, selectedWeek, firebaseUser?.uid, userKey, router]);

  // Check if selected week is already fully predicted (Test Mode) and set veil
  useEffect(() => {
    const checkWeekCompletion = async () => {
      if (currentMode !== 'test' || !userKey) {
        setWeekComplete(false);
        return;
      }
      // Avoid calling weekly-stats for Week 2 until the user has made at least one prediction (prevents 404 noise)
      try {
        if (selectedWeek === 2) {
          const k = hasWeekPredsKey(2, userKey);
          const hasAny = typeof window !== 'undefined' ? localStorage.getItem(k) === '1' : false;
          if (DEBUG_GIOCA) {
            try { console.debug('[gioca] week2 local flag', { key: k, hasAny }); } catch {}
          }
          if (!hasAny) {
            setWeekComplete(false);
            return;
          }
        }
      } catch {}
      try {
        // Authoritative check: ping weekly stats (counts rows in test_specs)
        const weekly = await apiClient.getTestWeeklyStats(userKey, selectedWeek);
        const totalPreds = (() => {
          const r = weekly as unknown;
          if (r && typeof r === 'object') {
            const ro = r as Record<string, unknown>;
            if ('data' in ro && ro.data && typeof ro.data === 'object') {
              const d = ro.data as Record<string, unknown>;
              const tp = d.totalPredictions;
              return typeof tp === 'number' ? tp : 0;
            }
            const tp = ro.totalPredictions;
            return typeof tp === 'number' ? tp : 0;
          }
          return 0;
        })();
        if (DEBUG_GIOCA) {
          try { console.debug('[gioca] weekly stats', { week: selectedWeek, totalPreds }); } catch {}
        }
        setWeekComplete(totalPreds >= 10);
      } catch {
        // If weekly endpoint not available, fall back to no veil
        setWeekComplete(false);
      }
    };
    checkWeekCompletion();
  }, [currentMode, selectedWeek, userKey, hasWeekPredsKey]);

  // Load persisted rollover flag (set by Risultati when all 10 matches of week 1 were revealed)
  useEffect(() => {
    if (!userKey) return;
    try {
      const k = `swipick:risultati:autoRoll:week1:user:${userKey}`;
      setRolledWeek1Once(localStorage.getItem(k) === '1');
  if (DEBUG_GIOCA) { try { console.debug('[gioca] rolledWeek1Once', { key: k, value: localStorage.getItem(k) }); } catch {} }
    } catch {}
  }, [userKey]);

  // Default to week=2 in Test Mode after rollover when no explicit week is provided in the URL
  useEffect(() => {
    if (didDefaultWeekRef.current) return;
    if (currentMode !== 'test') return;
    if (!rolledWeek1Once) return;
    try {
      const qp = searchParams.get('week');
      if (!qp) {
        const href = typeof window !== 'undefined' ? window.location.href : null;
        if (href) {
          const url = new URL(href);
          url.searchParams.set('mode', 'test');
          url.searchParams.set('week', '2');
          router.replace(url.toString());
          didDefaultWeekRef.current = true;
          if (DEBUG_GIOCA) { try { console.debug('[gioca] defaulted week to 2 via replace'); } catch {} }
        }
      }
    } catch {}
  }, [currentMode, rolledWeek1Once, searchParams, router]);

  // Resolve backend user id (UUID string) from Firebase UID for persistence in Test Mode
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

  // Light polling to keep header countdown in sync with any backend updates
  useEffect(() => {
    if (currentMode !== 'test') return;
    const interval = setInterval(async () => {
      try {
  const response = await apiClient.getTestFixtures(selectedWeek);
        let raw: unknown = response;
        if (
          typeof response === 'object' &&
          response !== null &&
          'data' in (response as Record<string, unknown>) &&
          Array.isArray((response as { data?: unknown }).data)
        ) {
          raw = (response as { data: unknown }).data;
        }
        if (isTestFixtureArray(raw)) {
          const mapped = (raw as TestFixtureAPI[])
            .filter((f) => (typeof f.week === 'number' ? f.week === selectedWeek : true))
            .map((f, idx) => {
              const iso = typeof f.date === 'string' ? f.date : new Date(f.date).toISOString();
              return {
                id: typeof f.id === 'number' ? f.id : idx + 1,
                date: iso,
                timestamp: Math.floor(new Date(iso).getTime() / 1000),
                venue: { id: typeof f.id === 'number' ? f.id : idx + 1, name: String(f.stadium || `${f.homeTeam} vs ${f.awayTeam}`), city: 'N/A' },
                status: { long: f.status === 'FT' ? 'Match Finished' : 'Scheduled', short: String(f.status || '') },
                league: { id: 135, name: 'Serie A (Test)', country: 'Italy', season: 2023, round: `Week ${f.week ?? selectedWeek}` },
                teams: {
                  home: { id: ((typeof f.id === 'number' ? f.id : idx + 1) * 10) + 1, name: String(f.homeTeam || 'Home'), logo: getLogoForTeam(String(f.homeTeam || '')) || '' },
                  away: { id: ((typeof f.id === 'number' ? f.id : idx + 1) * 10) + 2, name: String(f.awayTeam || 'Away'), logo: getLogoForTeam(String(f.awayTeam || '')) || '' },
                },
                goals: { home: Number.isFinite(f.homeScore as number) ? Number(f.homeScore) : undefined, away: Number.isFinite(f.awayScore as number) ? Number(f.awayScore) : undefined },
                score: { halftime: {}, fulltime: { home: Number(f.homeScore ?? 0), away: Number(f.awayScore ?? 0) } },
              } as Fixture;
            })
            .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
            .slice(0, 10);
          setFixtures(mapped);
          if (DEBUG_GIOCA) { try { console.log('[gioca] poll fixtures updated', { week: selectedWeek, count: mapped.length }); } catch {} }
        }
      } catch {
        // ignore poll errors
      }
    }, 60000); // 60s
    return () => clearInterval(interval);
  }, [currentMode, selectedWeek]);

  // Ensure no veil appears for Week 2 until the user has at least one prediction there
  useEffect(() => {
    if (currentMode !== 'test') return;
    if (selectedWeek !== 2) return;
    try {
      const k = hasWeekPredsKey(2, userKey);
      const hasAny = typeof window !== 'undefined' ? localStorage.getItem(k) === '1' : false;
      if (!hasAny) {
        setWeekComplete(false);
      }
  if (DEBUG_GIOCA) { try { console.log('[gioca] ensure no veil pre-picks week2', { key: k, hasAny }); } catch {} }
    } catch {
      setWeekComplete(false);
    }
  }, [currentMode, selectedWeek, userKey, hasWeekPredsKey]);

  // Reset completion flag when switching weeks to avoid stale overlays
  useEffect(() => {
    if (currentMode !== 'test') return;
    setWeekComplete(false);
  if (DEBUG_GIOCA) { try { console.log('[gioca] reset weekComplete due to week/mode change', { week: selectedWeek, mode: currentMode }); } catch {} }
  }, [selectedWeek, currentMode]);

  // Compare fixtures and matchCards alignment to detect overlap/mismatch
  useEffect(() => {
    if (!DEBUG_GIOCA) return;
    if (!fixtures.length || !matchCards.length) return;
    try {
      const pairs = fixtures.slice(0, Math.min(fixtures.length, matchCards.length)).map((f, i) => ({ i, f: `${f.teams.home.name} vs ${f.teams.away.name}`, c: `${matchCards[i]?.home.name} vs ${matchCards[i]?.away.name}` }));
      const mismatches = pairs.filter(p => p.f !== p.c);
  console.log('[gioca] alignment check', { week: selectedWeek, fixtures: fixtures.length, cards: matchCards.length, mismatches });
    } catch {}
  }, [fixtures, matchCards, selectedWeek]);

  // Log veil visibility changes
  const prevVeilRef = useRef<boolean | null>(null);
  useEffect(() => {
    if (!DEBUG_GIOCA) return;
    const canShowVeilNow = (() => {
      if (currentMode !== 'test') return false;
      if (weekComplete !== true) return false;
      if (selectedWeek === 1 && rolledWeek1Once) return false;
      if (selectedWeek === 2) {
        try {
          const k = hasWeekPredsKey(2, userKey);
          const hasAny = typeof window !== 'undefined' ? localStorage.getItem(k) === '1' : false;
          return hasAny;
        } catch { return false; }
      }
      return true;
    })();
    if (prevVeilRef.current !== canShowVeilNow) {
      prevVeilRef.current = canShowVeilNow;
  try { console.log('[gioca] veil state', { canShowVeil: canShowVeilNow, weekComplete, selectedWeek, mode: currentMode }); } catch {}
    }
  }, [weekComplete, selectedWeek, currentMode, rolledWeek1Once, hasWeekPredsKey, userKey]);

  const handlePrediction = async (fixtureId: number, prediction: '1' | 'X' | '2') => {
    if (currentMode === 'test' && weekComplete) {
      // Prevent further plays when week is complete
      return;
    }
    // Optimistic UI update
    setPredictions(prev => ({ ...prev, [fixtureId]: prediction }));

    // Persist to backend in Test Mode only
    try {
      if (currentMode === 'test' && userKey) {
        // Use unified BFF route: POST /api/predictions with mode='test'
        await apiClient.createTestModePrediction({
          userId: userKey,
          fixtureId,
          choice: prediction,
        });
        // Mark that the user has at least one prediction for this week (to enable weekly-stats checks later)
        try {
          const k = hasWeekPredsKey(selectedWeek, userKey);
          localStorage.setItem(k, '1');
        } catch {}
        // After posting, re-check completion via test weekly-stats to engage veil immediately after 10th pick
        try {
          const weekly = await apiClient.getTestWeeklyStats(userKey, selectedWeek);
          const totalPreds = (() => {
            const r = weekly as unknown;
            if (r && typeof r === 'object') {
              const ro = r as Record<string, unknown>;
              if ('data' in ro && ro.data && typeof ro.data === 'object') {
                const d = ro.data as Record<string, unknown>;
                const tp = d.totalPredictions;
                return typeof tp === 'number' ? tp : 0;
              }
              const tp = ro.totalPredictions;
              return typeof tp === 'number' ? tp : 0;
            }
            return 0;
          })();
          if (totalPreds >= 10) {
            setWeekComplete(true);
          }
        } catch {}
        // Optionally refresh match-cards to show overlay correctness if any prior fixtures are involved
        try {
          const userIdForOverlay = userKey ?? undefined;
          const mcResponse = await apiClient.getTestMatchCardsByWeek(selectedWeek, userIdForOverlay) as unknown as { success?: boolean; data?: MatchCard[] } | MatchCard[];
          const mcRaw: MatchCard[] | undefined = Array.isArray(mcResponse)
            ? mcResponse
            : (mcResponse as { data?: MatchCard[] })?.data;
          if (Array.isArray(mcRaw)) {
            const arr = mcRaw.slice().sort((a, b) => new Date(a.kickoff.iso).getTime() - new Date(b.kickoff.iso).getTime());
            setMatchCards(arr);
          }
        } catch {}
      }
    } catch (e) {
      console.error('Prediction persist failed', e);
    }
    // Advance to next card
    nextFixture();
  };

  const nextFixture = () => {
    if (currentFixtureIndex < fixtures.length - 1) {
      setCurrentFixtureIndex(prev => prev + 1);
    }
  };

  const skipFixture = () => {
    // Skip advances navigation but does not consume a turn
    // Rotate current card to the end of the list for both fixtures and matchCards
    setFixtures((prev) => {
      if (!prev.length) return prev;
      const copy = prev.slice();
      const idx = Math.min(Math.max(currentFixtureIndex, 0), copy.length - 1);
      const [curr] = copy.splice(idx, 1);
      copy.push(curr);
      return copy;
    });
    setMatchCards((prev) => {
      if (!prev.length) return prev;
      const copy = prev.slice();
      const idx = Math.min(Math.max(currentFixtureIndex, 0), copy.length - 1);
      const [curr] = copy.splice(idx, 1);
      copy.push(curr);
      return copy;
    });
    // Keep index at the same position to show the next card now at that slot
  };

  // Framer Motion: decide direction and commit without snap-back
  const onDragEndCommit = async (_e: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    if (!currentFixture) return;
    if (currentMode === 'test' && weekComplete) {
      return; // Block interactions under veil
    }
    const dx = info.offset.x ?? 0;
    const dy = info.offset.y ?? 0;
    const ax = Math.abs(dx);
    const ay = Math.abs(dy);
    const dominant: 'horizontal' | 'vertical' = ax >= ay ? 'horizontal' : 'vertical';
    const dir = dominant === 'horizontal' ? (dx < 0 ? 'left' : 'right') : (dy < 0 ? 'up' : 'down');

    // Animate out in chosen direction, then commit
    const distance = 900; // off-screen
    const target = {
      x: dir === 'left' ? -distance : dir === 'right' ? distance : 0,
      y: dir === 'up' ? -distance : dir === 'down' ? distance : 0,
      rotate: dir === 'left' ? -8 : dir === 'right' ? 8 : 0,
      transition: { type: 'tween', ease: 'easeOut', duration: 0.25 },
    } as const;
    try {
      await controls.start(target);
    } finally {
      if (dir === 'down') {
        skipFixture();
      } else if (dir === 'up') {
        await handlePrediction(currentFixture.id, 'X');
      } else if (dir === 'left') {
        await handlePrediction(currentFixture.id, '1');
      } else {
        await handlePrediction(currentFixture.id, '2');
      }
      // Reset for next card
      controls.set({ x: 0, y: 0, rotate: 0 });
    }
  };

  const formatMatchDateTime = (dateString: string) => {
    const date = new Date(dateString);
    const dayOfWeek = date.toLocaleDateString('it-IT', { weekday: 'short', timeZone: 'Europe/Rome' });
    const dayMonth = date.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', timeZone: 'Europe/Rome' });
    const time = date.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Rome' });
    return `${dayOfWeek} ${dayMonth} - ${time}`;
  };

  // Week number derived from fixtures or URL
  const getWeekNumber = () => {
    if (fixtures.length === 0) return selectedWeek;
    const round = fixtures[0]?.league?.round;
    const m = String(round).match(/(\d+)/);
    return m ? parseInt(m[1], 10) : selectedWeek;
  };

  // Compute the next kickoff among the 10 fixtures, normalized to this or next year
  const computeNextTarget = useCallback((items: Fixture[]): Date | null => {
    if (!items || items.length === 0) return null;
    const now = Date.now();
    const year = new Date(now).getFullYear();
    const candidates = items.map((f) => {
      const d = new Date(f.date);
      // Normalize to this year to keep a forward-looking countdown in test mode
      const c = new Date(d.getTime());
      c.setFullYear(year);
      if (c.getTime() <= now) {
        c.setFullYear(year + 1);
      }
      return c.getTime();
    });
    const nextTs = candidates.reduce((min, ts) => (ts < min ? ts : min), Number.POSITIVE_INFINITY);
    return Number.isFinite(nextTs) ? new Date(nextTs) : null;
  }, []);

  const [nextTarget, setNextTarget] = useState<Date | null>(null);

  // Recompute next target whenever fixtures change
  useEffect(() => {
    if (fixtures.length > 0) {
      setNextTarget(computeNextTarget(fixtures));
    }
  }, [fixtures, computeNextTarget]);

  // Countdown to the computed next kickoff
  const getTimeToNextMatch = useCallback(() => {
    if (!nextTarget) return { days: 0, hours: 0, minutes: 0, seconds: 0 };
    const now = Date.now();
    const diff = nextTarget.getTime() - now;
    if (diff <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0 };
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);
    return { days, hours, minutes, seconds };
  }, [nextTarget]);

  // Date range directly from current week's fixtures
  const getWeekDateRange = () => {
    if (fixtures.length === 0) return null;
    const times = fixtures.map((f) => new Date(f.date).getTime());
    const start = new Date(Math.min(...times));
    const end = new Date(Math.max(...times));
    return { start, end } as const;
  };

  const [timeToMatch, setTimeToMatch] = useState(getTimeToNextMatch());

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeToMatch(getTimeToNextMatch());
    }, 1000);
    return () => clearInterval(timer);
  }, [getTimeToNextMatch]);

  // Light recheck to advance target as time passes
  useEffect(() => {
    const ref = setInterval(() => {
      if (fixtures.length > 0) {
        setNextTarget(computeNextTarget(fixtures));
      }
    }, 15000); // every 15s
    return () => clearInterval(ref);
  }, [fixtures, computeNextTarget]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center">
        <div className="text-center text-white">
          <div className="animate-spin w-12 h-12 border-4 border-white border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-xl">Caricamento partite Serie A...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center">
        <div className="text-center text-white max-w-md mx-auto p-6">
          <div className="text-6xl mb-4">⚠️</div>
          <h2 className="text-2xl font-bold mb-4">Errore nel caricamento</h2>
          <p className="text-lg opacity-90 mb-6">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="bg-white text-purple-600 px-6 py-3 rounded-lg font-semibold hover:bg-gray-100 transition-colors"
          >
            Riprova
          </button>
        </div>
      </div>
    );
  }

  if (fixtures.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center">
        <div className="text-center text-white max-w-md mx-auto p-6">
          <div className="text-6xl mb-4">⚽</div>
          <h2 className="text-2xl font-bold mb-4">Nessuna partita trovata</h2>
          <p className="text-lg opacity-90">Non ci sono partite di Serie A nei prossimi 7 giorni.</p>
        </div>
      </div>
    );
  }

  // Render-time alignment to avoid overlap when arrays update at different times
  const minAligned = currentMode === 'test' ? Math.min(fixtures.length, matchCards.length) : fixtures.length;
  const effectiveFixtures = currentMode === 'test' ? fixtures.slice(0, minAligned) : fixtures;
  const effectiveCards = currentMode === 'test' ? matchCards.slice(0, minAligned) : matchCards;
  if (!mismatchLogOnceRef.current && currentMode === 'test' && fixtures.length !== matchCards.length) {
    try { console.warn('[gioca] arrays misaligned; trimming for render', { fixtures: fixtures.length, matchCards: matchCards.length, using: minAligned }); } catch {}
    mismatchLogOnceRef.current = true;
  }
  const currentFixture = effectiveFixtures[currentFixtureIndex];
  const currentCard = effectiveCards[currentFixtureIndex];
  const currentPrediction = currentFixture ? predictions[currentFixture.id] : undefined;
  const predictionsCount = effectiveFixtures.reduce((acc, f) => acc + (predictions[f.id] ? 1 : 0), 0);
  const progressPct = Math.min(predictionsCount / 10, 1) * 100;
  const isComplete = predictionsCount >= 10;

  const buttonStyle: React.CSSProperties = {
    background: 'radial-gradient(circle at center, #554099, #3d2d73)',
    boxShadow: '0 8px 16px rgba(85, 64, 153, 0.3), 0 4px 8px rgba(0, 0, 0, 0.2)',
  };
  const skipStyle: React.CSSProperties = {
    background: '#ffffff',
    boxShadow: '0 8px 16px rgba(85, 64, 153, 0.2), 0 4px 8px rgba(0, 0, 0, 0.1)',
    border: '1px solid rgba(85, 64, 153, 0.2)',
  };

  // Hard reset (Test Mode): drop user predictions server-side and clear client keys; return to week 1
  const handleTestReset = async () => {
    if (currentMode !== 'test') return;
    if (!userKey) return;
    try {
      const confirmMsg = 'Questo reimposterà il gioco in modalità TEST: tutte le tue predizioni verranno eliminate e potrai rigiocare dalla Giornata 1. Procedere?';
      if (typeof window !== 'undefined') {
        const ok = window.confirm(confirmMsg);
        if (!ok) return;
      }
      // Backend reset for this user
      try { await apiClient.resetTestData(userKey); } catch (e) { console.warn('resetTestData failed (continuing local cleanup)', e); }

      // Local cleanup of test-mode keys for this user
      try {
        if (typeof window !== 'undefined') {
          const keysToRemove: string[] = [];
          for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i) || '';
            const isGioca = k.startsWith('swipick:gioca:hasPreds:test:week:') && k.includes(`:user:${userKey}`);
            const isReveal = k.startsWith('swipick:risultati:reveal:test:week:') && k.includes(`:user:${userKey}`);
            const isAutoRoll = k === `swipick:risultati:autoRoll:week1:user:${userKey}`;
            if (isGioca || isReveal || isAutoRoll) keysToRemove.push(k);
          }
          keysToRemove.forEach((k) => localStorage.removeItem(k));
        }
      } catch {}

      // Reset local state
      setPredictions({});
      setWeekComplete(false);
      setCurrentFixtureIndex(0);

      // Navigate to week 1 cleanly
      const href = typeof window !== 'undefined' ? window.location.href : null;
      if (href) {
        const url = new URL(href);
        url.searchParams.set('mode', 'test');
        url.searchParams.set('week', '1');
        router.replace(url.toString());
        // Small delay to let route settle, then soft reload the page data
        setTimeout(() => {
          try { window.location.reload(); } catch {}
        }, 60);
      }
    } catch (e) {
      console.error('Test reset failed', e);
    }
  };

  // Decide if the completion veil should be displayed for the current context
  const canShowVeil = (() => {
    if (currentMode !== 'test') return false;
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

  // Helper to render last-5 bubbles
  const renderLastFive = (list: Array<'1' | 'X' | '2'>, side: 'home' | 'away', form?: Last5Item[]) => {
    // Always render 5 bubbles; pad with placeholders if needed
    const raw: (Last5Item | null)[] = (form && form.length)
      ? form
      : list.map((code) => ({ fixtureId: 0, code, predicted: null, correct: null }));
    const filled: Array<Last5Item | null> = [...raw];
    while (filled.length < 5) filled.push(null);

    return (
      <div className="flex justify-center gap-1 mt-1">
        {filled.map((it, idx) => {
          if (it === null) {
            return (
              <div
                key={idx}
                className="w-5 h-5 rounded-full text-[10px] leading-none flex items-center justify-center bg-gray-300 text-gray-500"
              >
                —
              </div>
            );
          }
          const color = it.correct == null
            ? 'bg-gray-300 text-gray-700'
            : it.correct ? 'bg-green-500 text-white' : 'bg-red-500 text-white';
          return (
            <div key={idx} className={`w-5 h-5 rounded-full text-[10px] leading-none flex items-center justify-center ${color}`}>
              {it.code}
            </div>
          );
        })}
      </div>
    );
  };

  // Short date/time for summary list pills (e.g., "Ven 04 18:30")
  const formatShortDateTime = (iso: string) => {
    const d = new Date(iso);
    const dow = d.toLocaleDateString('it-IT', { weekday: 'short', timeZone: 'Europe/Rome' });
    const dd = d.toLocaleDateString('it-IT', { day: '2-digit', timeZone: 'Europe/Rome' });
    const hhmm = d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Rome' });
    return `${dow} ${dd} ${hhmm}`;
  };

  // Completed view: summary list of the 10 selections with indigo highlight on chosen 1/X/2
  if (isComplete) {
    return (
      <div className="min-h-screen bg-white">
        {currentMode === 'test' && (
          <div className="bg-orange-500 text-white py-2 px-3 font-semibold flex items-center justify-between">
            <div>🧪 MODALITÀ TEST - Dati storici Serie A 2023-24</div>
            <button
              onClick={handleTestReset}
              disabled={!userKey}
              className={`text-xs font-semibold border rounded-md px-2.5 py-1 ${userKey ? 'border-white/70 hover:bg-white/10' : 'border-white/30 opacity-60 cursor-not-allowed'}`}
              title={userKey ? 'Reimposta Test Mode' : 'Attendere il caricamento utente'}
            >
              Reset
            </button>
          </div>
        )}

        {/* Header with progress locked at 10/10 */}
        <div
          className="w-full mx-0 mt-0 mb-6 rounded-b-2xl rounded-t-none text-white"
          style={{ background: 'radial-gradient(circle at center, #554099, #3d2d73)', boxShadow: '0 8px 16px rgba(85, 64, 153, 0.3), 0 4px 8px rgba(0, 0, 0, 0.2)' }}
        >
          <div className="text-center pt-6 px-4">
            {(() => {
              const range = getWeekDateRange();
              const from = range?.start?.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', timeZone: 'Europe/Rome' });
              const to = range?.end?.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', timeZone: 'Europe/Rome' });
              return (
                <p className="text-base md:text-lg mb-1 whitespace-nowrap">
                  Giornata {getWeekNumber()} <span className="opacity-90">{from && to ? `dal ${from} al ${to}` : ''}</span>
                </p>
              );
            })()}
          </div>
          <div className="px-6 pb-6">
            <div className="relative mx-auto" style={{ width: 'calc(100% - 115px)' }}>
              <div className="bg-white bg-opacity-30 rounded-sm overflow-hidden" style={{ height: '18px' }}>
                <div className="bg-white h-full rounded-sm" style={{ width: '100%' }} />
              </div>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-xs font-medium text-[#3d2d73]">10/10</span>
              </div>
            </div>
          </div>
        </div>

        {/* Summary list */}
        <div className="px-4 pb-24">
          {fixtures.map((f, idx) => {
            const card = matchCards[idx];
            const pick = predictions[f.id];
            const kickoff = card ? card.kickoff.display : formatShortDateTime(f.date);
            const homeLogo = (card?.home.logo || f.teams.home.logo) as string | undefined;
            const awayLogo = (card?.away.logo || f.teams.away.logo) as string | undefined;
            const homeName = card?.home.name || f.teams.home.name;
            const awayName = card?.away.name || f.teams.away.name;

            const badge = (label: '1'|'X'|'2') => (
              <div
                className={
                  `w-8 h-8 rounded-full grid place-items-center text-xs font-bold ` +
                  (pick === label ? 'bg-indigo-600 text-white shadow-md' : 'bg-gray-100 text-gray-500')
                }
              >
                {label}
              </div>
            );

            return (
              <div key={f.id} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-200 mb-4 flex items-center">
                {/* Teams and details */}
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    {homeLogo ? (
                      <Image src={homeLogo} alt={homeName} width={28} height={28} className="w-7 h-7 object-contain" />
                    ) : (
                      <div className="w-7 h-7 rounded-full bg-purple-100" />
                    )}
                    <span className="text-sm font-semibold text-black">{homeName}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    {awayLogo ? (
                      <Image src={awayLogo} alt={awayName} width={28} height={28} className="w-7 h-7 object-contain" />
                    ) : (
                      <div className="w-7 h-7 rounded-full bg-blue-100" />
                    )}
                    <span className="text-sm font-semibold text-black">{awayName}</span>
                  </div>
                </div>

                {/* Kickoff pill */}
                <div className="mx-3">
                  <div className="px-3 py-1 rounded-md border text-[11px] text-gray-700 border-gray-200 whitespace-nowrap">
                    {kickoff}
                  </div>
                </div>

                {/* Choice badges */}
                <div className="flex flex-col gap-2 items-center">
                  {badge('1')}
                  {badge('X')}
                  {badge('2')}
                </div>
              </div>
            );
          })}
        </div>

        {/* Bottom Nav (same as play view) */}
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t">
          <div className="flex">
            <button onClick={() => {
              if (DEBUG_GIOCA) { try { console.log('[gioca] nav -> risultati', { mode: currentMode, week: selectedWeek }); } catch {} }
              router.push(`/risultati?mode=${currentMode}${currentMode === 'test' ? `&week=${selectedWeek}` : ''}`);
            }} className="flex-1 text-center py-4">
              <div className="text-gray-500 mb-1">
                <svg className="w-6 h-6 mx-auto" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M9 11H7v6h2v-6zm4 0h-2v6h2v-6zm4 0h-2v6h2v-6zM4 22h16v-2H4v2zm0-4h16v-2H4v2zm0-4h16v-2H4v2zm0-4h16V8H4v2zm0-6h16V2H4v2z"/>
                </svg>
              </div>
              <span className="text-xs text-black">Risultati</span>
            </button>
            <div className="flex-1 text-center py-4 border-b-2 border-purple-600">
              <div className="text-purple-600 mb-1">
                <svg className="w-6 h-6 mx-auto" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                </svg>
              </div>
              <span className="text-xs text-purple-600 font-medium">Gioca</span>
            </div>
            <button onClick={() => router.push('/profilo')} className="flex-1 text-center py-4">
              <div className="text-gray-500 mb-1">
                <svg className="w-6 h-6 mx-auto" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2c1.1 0 2 .9 2 2 0 .74-.4 1.38-1 1.72v.78h-.5c-.83 0-1.5.67-1.5 1.5v.5c0 .28-.22.5-.5.5s-.5-.22-.5-.5v-.5c0-1.38 1.12-2.5 2.5-2.5H13V5.72c-.6-.34-1-.98-1-1.72 0-1.1.9-2 2-2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"/>
                </svg>
              </div>
              <span className="text-xs text-black">Profilo</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Test Mode Indicator */}
      {currentMode === 'test' && (
        <div className="bg-orange-500 text-white py-2 px-3 font-semibold flex items-center justify-between">
          <div>🧪 MODALITÀ TEST - Dati storici Serie A 2023-24</div>
          <button
            onClick={handleTestReset}
            disabled={!userKey}
            className={`text-xs font-semibold border rounded-md px-2.5 py-1 ${userKey ? 'border-white/70 hover:bg-white/10' : 'border-white/30 opacity-60 cursor-not-allowed'}`}
            title={userKey ? 'Reimposta Test Mode' : 'Attendere il caricamento utente'}
          >
            Reset
          </button>
        </div>
      )}
      
      {/* Top Header Panel (match button gradient) */}
      <div
        className="w-full mx-0 mt-0 mb-6 rounded-b-2xl rounded-t-none text-white"
        style={{
          background: 'radial-gradient(circle at center, #554099, #3d2d73)',
          boxShadow:
            '0 8px 16px rgba(85, 64, 153, 0.3), 0 4px 8px rgba(0, 0, 0, 0.2)',
        }}
      >
        <div className="text-center pt-6 px-4">
          {(() => {
            const range = getWeekDateRange();
            const from = range?.start?.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', timeZone: 'Europe/Rome' });
            const to = range?.end?.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', timeZone: 'Europe/Rome' });
            return (
              <p className="text-base md:text-lg  mb-1 whitespace-nowrap">
                Giornata {getWeekNumber()}&nbsp;
                <span className="opacity-90">
                  {from && to ? `dal ${from} al ${to}` : ''}
                </span>
              </p>
            );
          })()}
        </div>
        <div className="flex justify-center px-6 py-4">
          <div className="flex gap-6 text-center">
            <div>
              <div className="text-2xl font-bold">{timeToMatch.days}</div>
              <div className="text-xs opacity-80">giorni</div>
            </div>
            <div>
              <div className="text-2xl font-bold">{timeToMatch.hours}</div>
              <div className="text-xs opacity-80">ore</div>
            </div>
            <div>
              <div className="text-2xl font-bold">{timeToMatch.minutes}</div>
              <div className="text-xs opacity-80">minuti</div>
            </div>
            <div>
              <div className="text-2xl font-bold">{timeToMatch.seconds}</div>
              <div className="text-xs opacity-80">secondi</div>
            </div>
          </div>
        </div>
        <div className="px-6 pb-6">
          <div className="relative mx-auto" style={{ width: 'calc(100% - 115px)' }}>
            <div className="bg-white bg-opacity-30 rounded-sm overflow-hidden" style={{ height: '18px' }}>
              <div
                className="bg-white h-full rounded-sm transition-all duration-300"
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-xs font-medium text-[#3d2d73]">
                {Math.min(predictionsCount, 10)}/10
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Match Card Stack with Swipe */}
      <div className="mx-4 mb-8 relative">
        {/* Next card preview to be revealed */}
  {effectiveFixtures[currentFixtureIndex + 1] && (
          <div className="absolute inset-0 scale-[0.97] opacity-95 pointer-events-none">
            <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-200">
              {/* Next card content */}
              {(() => {
    const nf = effectiveFixtures[currentFixtureIndex + 1];
    const nc = effectiveCards[currentFixtureIndex + 1];
                return (
                  <>
                    <div className="text-center mb-6">
                      <p className="text-black text-sm mb-1">{nc ? nc.kickoff.display : formatMatchDateTime(nf.date)}</p>
                      <p className="text-black text-xs">{nc?.stadium || nf.venue.name}</p>
                    </div>
                    <div className="flex items-center justify-between mb-8">
                      <div className="flex-1 text-center opacity-95">
                        {(nc?.home.logo || nf.teams.home.logo) ? (
                          <Image src={(nc?.home.logo || nf.teams.home.logo) as string} alt={nc?.home.name || nf.teams.home.name} width={80} height={80} className="mx-auto mb-3 w-20 h-20 object-contain" />
                        ) : (
                          <div className="w-12 h-12 mx-auto mb-24 bg-purple-100 rounded-full" />
                        )}
                        <h3 className="font-bold text-lg mb-1 text-black">{nc?.home.name || nf.teams.home.name}</h3>
                      </div>
                      <div className="px-4">
                        <div className="text-2xl font-bold text-gray-300">VS</div>
                      </div>
                      <div className="flex-1 text-center opacity-95">
                        {(nc?.away.logo || nf.teams.away.logo) ? (
                          <Image src={(nc?.away.logo || nf.teams.away.logo) as string} alt={nc?.away.name || nf.teams.away.name} width={80} height={80} className="mx-auto mb-3 w-20 h-20 object-contain" />
                        ) : (
                          <div className="w-12 h-12 mx-auto mb-3 bg-blue-100 rounded-full" />
                        )}
                        <h3 className="font-bold text-lg mb-1 text-black">{nc?.away.name || nf.teams.away.name}</h3>
                      </div>
                    </div>
                  </>
                );
              })()}
            </div>
          </div>
        )}

        {/* Top (current) card - draggable */}
        <motion.div
          key={currentFixture?.id}
          drag={currentMode === 'test' ? Boolean(userKey) && !weekComplete : true}
          dragElastic={0}
          dragMomentum={false}
          onDragEnd={onDragEndCommit}
          animate={controls}
          initial={{ x: 0, y: 0, rotate: 0 }}
          whileDrag={{ scale: 1.02 }}
          className="relative z-10"
        >
          <div className={`bg-white rounded-2xl p-6 shadow-lg border border-gray-200 ${weekComplete ? 'opacity-60 pointer-events-none' : ''}`}>
            {/* Match Info */}
            <div className="text-center mb-6">
              <p className="text-black text-sm mb-1">{currentCard ? currentCard.kickoff.display : formatMatchDateTime(currentFixture.date)}</p>
              <p className="text-black text-xs">{currentCard?.stadium || currentFixture.venue.name}</p>
            </div>

            {/* Teams */}
            <div className="flex items-center justify-between mb-8">
              {/* Home Team */}
              <div className="flex-1 text-center">
                {(currentCard?.home.logo || currentFixture.teams.home.logo) ? (
                  <Image
                    src={(currentCard?.home.logo || currentFixture.teams.home.logo) as string}
                    alt={currentCard?.home.name || currentFixture.teams.home.name}
                    width={80}
                    height={80}
                    className="mx-auto mb-3 w-20 h-20 object-contain"
                    priority
                  />
                ) : (
                  <div className="w-12 h-12 mx-auto mb-24 bg-purple-800 rounded-full flex items-center justify-center">
                    <span className="text-black font-bold text-lg">
                      {(currentCard?.home.name || currentFixture.teams.home.name).charAt(0)}
                    </span>
                  </div>
                )}
                <h3 className="font-bold text-lg mb-1 text-black">{currentCard?.home.name || currentFixture.teams.home.name}</h3>
                <p className="text-xs text-black">Posizione in classifica</p>
                <p className="font-bold text-black">{currentCard?.home.standingsPosition ?? '—'}</p>
                <p className="text-xs text-black mt-1">Vittorie in casa</p>
                <p className="font-bold text-black">{currentCard?.home.winRateHome != null ? `${currentCard.home.winRateHome}%` : '—'}</p>
                <p className="text-xs text-black mt-1">Ultimi 5 risultati</p>
                {currentCard ? renderLastFive(currentCard.home.last5, 'home', currentCard.home.form) : renderLastFive([], 'home')}
              </div>

              {/* VS */}
              <div className="px-4">
                <div className="text-2xl font-bold text-gray-400">VS</div>
              </div>

              {/* Away Team */}
              <div className="flex-1 text-center">
                {(currentCard?.away.logo || currentFixture.teams.away.logo) ? (
                  <Image
                    src={(currentCard?.away.logo || currentFixture.teams.away.logo) as string}
                    alt={currentCard?.away.name || currentFixture.teams.away.name}
                    width={80}
                    height={80}
                    className="mx-auto mb-3 w-20 h-20 object-contain"
                    priority
                  />
                ) : (
                  <div className="w-12 h-12 mx-auto mb-3 bg-blue-200 rounded-full flex items-center justify-center">
                    <span className="text-blue-600 font-bold text-lg">
                      {(currentCard?.away.name || currentFixture.teams.away.name).charAt(0)}
                    </span>
                  </div>
                )}
                <h3 className="font-bold text-lg mb-1 text-black">{currentCard?.away.name || currentFixture.teams.away.name}</h3>
                <p className="text-xs text-black">Posizione in classifica</p>
                <p className="font-bold text-black">{currentCard?.away.standingsPosition ?? '—'}</p>
                <p className="text-xs text-black mt-1">Vittorie in trasferta</p>
                <p className="font-bold text-black">{currentCard?.away.winRateAway != null ? `${currentCard.away.winRateAway}%` : '—'}</p>
                <p className="text-xs text-black mt-1">Ultimi 5 risultati</p>
                {currentCard ? renderLastFive(currentCard.away.last5, 'away', currentCard.away.form) : renderLastFive([], 'away')}
              </div>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Prediction Buttons - Diamond Layout */}
      <div className="flex justify-center  ">
        <div className="grid grid-cols-3 gap-x-10 gap-y-0 justify-items-center items-center ">
          {/* Top: X */}
          <div className="col-start-2">
      <button
              onClick={() => handlePrediction(currentFixture.id, 'X')}
  disabled={(currentMode === 'test' && (!userKey || weekComplete))}
        className={`relative w-24 text-center text-white font-bold py-3 px-8 rounded-full shadow-lg transition-all duration-200 hover:scale-105 ${
    currentPrediction === 'X' ? 'scale-105' : ''
              }`}
              style={buttonStyle}
            >
              X
            </button>
          </div>
          {/* Middle Left: 1 */}
          <div className="col-start-1 row-start-2">
      <button
              onClick={() => handlePrediction(currentFixture.id, '1')}
  disabled={(currentMode === 'test' && (!userKey || weekComplete))}
        className={`relative w-24 text-center text-white font-bold py-3 px-8 rounded-full shadow-lg transition-all duration-200 hover:scale-105 ${
                currentPrediction === '1' ? 'scale-105' : ''
              }`}
              style={buttonStyle}
            >
              1
            </button>
          </div>
          {/* Middle Right: 2 */}
          <div className="col-start-3 row-start-2">
      <button
              onClick={() => handlePrediction(currentFixture.id, '2')}
  disabled={(currentMode === 'test' && (!userKey || weekComplete))}
        className={`relative w-24 text-center text-white font-bold py-3 px-8 rounded-full shadow-lg transition-all duration-200 hover:scale-105 ${
                currentPrediction === '2' ? 'scale-105' : ''
              }`}
              style={buttonStyle}
            >
              2
            </button>
          </div>
          {/* Bottom: Skip */}
  <div className="col-start-2 row-start-3 -mt-[15px]">
            <button
              onClick={skipFixture}
     disabled={(currentMode === 'test' && weekComplete)}
     className="relative w-24 text-center bg-white text-[#3d2d73] font-bold py-3 px-8 rounded-full shadow-lg transition-all duration-200 hover:scale-105 disabled:opacity-60"
        style={skipStyle}
            >
              skip
            </button>
          </div>
        </div>
      </div>

      {/* Modal: User not found */}
      {currentMode === 'test' && userMissingModal.show && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl p-6 w-80 shadow-xl">
            <h3 className="text-lg font-semibold text-black mb-2">Account non trovato</h3>
            <p className="text-sm text-gray-600 mb-4">Per continuare in Test Mode serve un account backend. Vai alla pagina di benvenuto per completare.</p>
            <div className="flex gap-3 justify-end">
              <button
                className="px-4 py-2 text-sm rounded-md border border-gray-300 text-black"
                onClick={() => {
                  setUserMissingModal({ show: false });
                }}
              >
                Chiudi
              </button>
              <button
                className="px-4 py-2 text-sm rounded-md bg-purple-600 text-white"
                onClick={() => router.push('/welcome')}
              >
                Vai a Welcome
              </button>
            </div>
          </div>
        </div>
      )}

        {/* Veil when week is completed (Test Mode). Hidden for Week 1 once rollover occurred, to avoid blocking UI when user navigates back. */}
  {canShowVeil && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-[2px]">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-[88%] max-w-md text-center">
            <h3 className="text-xl font-semibold text-black mb-2">Giornata completata</h3>
            <p className="text-sm text-gray-700 mb-5">Hai già effettuato 10 scelte per questa settimana. Vai alla pagina Risultati per rivelare e vedere l&apos;andamento.</p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => router.push(`/risultati?mode=test&week=${selectedWeek}`)}
                className="px-5 py-2 rounded-md bg-purple-600 text-white font-medium hover:bg-purple-700"
              >
                Vai a Risultati
              </button>
            </div>
          </div>
        </div>
      )}

  {/* Bottom Navigation */}
  <div className="fixed bottom-0 left-0 right-0 bg-white border-t">
        <div className="flex">
          <button
            onClick={() => {
              if (DEBUG_GIOCA) { try { console.log('[gioca] nav -> risultati', { mode: currentMode, week: selectedWeek }); } catch {} }
              router.push(`/risultati?mode=${currentMode}${currentMode === 'test' ? `&week=${selectedWeek}` : ''}`);
            }}
            className="flex-1 text-center py-4"
          >
    <div className="text-gray-500 mb-1">
              <svg className="w-6 h-6 mx-auto" fill="currentColor" viewBox="0 0 24 24">
                <path d="M9 11H7v6h2v-6zm4 0h-2v6h2v-6zm4 0h-2v6h2v-6zM4 22h16v-2H4v2zm0-4h16v-2H4v2zm0-4h16v-2H4v2zm0-4h16V8H4v2zm0-6h16V2H4v2z"/>
              </svg>
            </div>
    <span className="text-xs text-black">Risultati</span>
          </button>
          <div className="flex-1 text-center py-4 border-b-2 border-purple-600">
            <div className="text-purple-600 mb-1">
              <svg className="w-6 h-6 mx-auto" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
              </svg>
            </div>
    <span className="text-xs text-purple-600 font-medium">Gioca</span>
          </div>
          <button
            onClick={() => router.push('/profilo')}
            className="flex-1 text-center py-4"
          >
    <div className="text-gray-500 mb-1">
              <svg className="w-6 h-6 mx-auto" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2c1.1 0 2 .9 2 2 0 .74-.4 1.38-1 1.72v.78h-.5c-.83 0-1.5.67-1.5 1.5v.5c0 .28-.22.5-.5.5s-.5-.22-.5-.5v-.5c0-1.38 1.12-2.5 2.5-2.5H13V5.72c-.6-.34-1-.98-1-1.72 0-1.1.9-2 2-2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"/>
              </svg>
            </div>
    <span className="text-xs text-black">Profilo</span>
          </button>
        </div>
      </div>
    </div>
  );
}

export default function GiocaPage() {
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
