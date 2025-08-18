'use client';

import { useState, useEffect, Suspense, useCallback } from "react";
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import { apiClient } from "@/lib/api-client";
import { getLogoForTeam } from "@/lib/club-logos";
import { useGameMode } from "@/src/contexts/GameModeContext";
import { useAuthContext } from "@/src/contexts/AuthContext";

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

  // Update context if mode changed via URL
  useEffect(() => {
    if (currentMode !== mode) {
      setMode(currentMode);
    }
  }, [currentMode, mode, setMode]);

  useEffect(() => {
    const fetchFixtures = async () => {
      try {
        setLoading(true);
        setError(null);
        let fixtureData: Fixture[] = [];

        if (currentMode === 'test') {
          // Fetch enriched match-cards for card stats
          try {
            const mcResponse = await apiClient.getTestMatchCardsByWeek(selectedWeek, firebaseUser?.uid);
            let mcRaw: unknown = mcResponse;
            if (mcResponse && typeof mcResponse === 'object' && 'data' in (mcResponse as Record<string, unknown>)) {
              mcRaw = (mcResponse as Record<string, unknown>).data as unknown;
            }
            if (Array.isArray(mcRaw)) {
              const arr = (mcRaw as MatchCard[]).slice().sort((a, b) => new Date(a.kickoff.iso).getTime() - new Date(b.kickoff.iso).getTime());
              setMatchCards(arr);
            } else {
              setMatchCards([]);
            }
          } catch {
            setMatchCards([]);
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
          }
        } else {
          // Load live fixtures
          const response = await apiClient.getUpcomingSerieAFixtures(7);
          if (response.error) {
            throw new Error(response.error);
          }
          fixtureData = response.data || response;
        }
        
        setFixtures(fixtureData);
        if (fixtureData.length > 0) {
          setCurrentFixtureIndex(0);
        }
      } catch (err) {
        console.error('Error fetching fixtures:', err);
        setError(err instanceof Error ? err.message : 'Errore nel caricamento delle partite');
      } finally {
        setLoading(false);
      }
    };

    fetchFixtures();
  }, [currentMode, selectedWeek, firebaseUser?.uid]);

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
        }
      } catch {
        // ignore poll errors
      }
    }, 60000); // 60s
    return () => clearInterval(interval);
  }, [currentMode, selectedWeek]);

  const handlePrediction = (fixtureId: number, prediction: '1' | 'X' | '2') => {
    setPredictions(prev => ({
      ...prev,
      [fixtureId]: prediction
    }));
  };

  const nextFixture = () => {
    if (currentFixtureIndex < fixtures.length - 1) {
      setCurrentFixtureIndex(prev => prev + 1);
    }
  };

  const skipFixture = () => {
    // Skip advances navigation but does not consume a turn
    nextFixture();
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

  const currentFixture = fixtures[currentFixtureIndex];
  const currentCard = matchCards[currentFixtureIndex];
  const currentPrediction = currentFixture ? predictions[currentFixture.id] : undefined;
  const predictionsCount = fixtures.reduce((acc, f) => acc + (predictions[f.id] ? 1 : 0), 0);
  const progressPct = Math.min(predictionsCount / 10, 1) * 100;

  const buttonStyle: React.CSSProperties = {
    background: 'radial-gradient(circle at center, #554099, #3d2d73)',
    boxShadow: '0 8px 16px rgba(85, 64, 153, 0.3), 0 4px 8px rgba(0, 0, 0, 0.2)',
  };
  const skipStyle: React.CSSProperties = {
    background: '#ffffff',
    boxShadow: '0 8px 16px rgba(85, 64, 153, 0.2), 0 4px 8px rgba(0, 0, 0, 0.1)',
    border: '1px solid rgba(85, 64, 153, 0.2)',
  };

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

  return (
    <div className="min-h-screen bg-white">
      {/* Test Mode Indicator */}
      {currentMode === 'test' && (
        <div className="bg-orange-500 text-white text-center py-3 font-semibold">
          🧪 MODALITÀ TEST - Dati storici Serie A 2023-24
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

      {/* Match Card */}
      <div className="mx-4 mb-8">
        <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-200">
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
      </div>

      {/* Prediction Buttons - Diamond Layout */}
      <div className="flex justify-center  ">
        <div className="grid grid-cols-3 gap-x-10 gap-y-0 justify-items-center items-center ">
          {/* Top: X */}
          <div className="col-start-2">
            <button
              onClick={() => handlePrediction(currentFixture.id, 'X')}
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
                 className="relative w-24 text-center bg-white text-[#3d2d73] font-bold py-3 px-8 rounded-full shadow-lg transition-all duration-200 hover:scale-105"
        style={skipStyle}
            >
              skip
            </button>
          </div>
        </div>
      </div>

  {/* Bottom Navigation */}
  <div className="fixed bottom-0 left-0 right-0 bg-white border-t">
        <div className="flex">
          <button
            onClick={() => router.push('/risultati')}
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
