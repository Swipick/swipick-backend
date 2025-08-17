'use client';

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from 'next/navigation';
import { apiClient } from "@/lib/api-client";
import { getLogoForTeam } from "@/lib/club-logos";
import { useGameMode } from "@/src/contexts/GameModeContext";

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

function GiocaPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { mode, setMode } = useGameMode();
  
  // Get mode from URL parameters or context
  const currentMode = (searchParams.get('mode') as 'live' | 'test') || mode;
  
  const [fixtures, setFixtures] = useState<Fixture[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentFixtureIndex, setCurrentFixtureIndex] = useState(0);
  const [predictions, setPredictions] = useState<Record<number, '1' | 'X' | '2'>>({});

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
        
        let fixtureData: Fixture[];
        
        if (currentMode === 'test') {
          // Load test fixtures (historical Serie A data) and normalize shape for UI
          try {
      const response = await apiClient.getTestFixtures();
            const raw = (response as any)?.data ?? response;
            if (Array.isArray(raw) && raw.length > 0 && typeof raw[0]?.homeTeam === 'string') {
              fixtureData = (raw as any[]).map((f, idx) => {
                const date = typeof f.date === 'string' ? f.date : new Date(f.date).toISOString();
                return {
                  id: Number(f.id) ?? idx + 1,
                  date,
                  timestamp: Math.floor(new Date(date).getTime() / 1000),
                  venue: { id: Number(f.id) ?? idx + 1, name: `${f.homeTeam} vs ${f.awayTeam}`, city: 'N/A' },
                  status: { long: f.status === 'FT' ? 'Match Finished' : 'Scheduled', short: String(f.status || '') },
                  league: { id: 135, name: 'Serie A (Test)', country: 'Italy', season: 2023, round: `Week ${f.week ?? '-'}` },
                  teams: {
        home: { id: (Number(f.id) ?? idx + 1) * 10 + 1, name: String(f.homeTeam || 'Home'), logo: getLogoForTeam(String(f.homeTeam || '')) || '' },
        away: { id: (Number(f.id) ?? idx + 1) * 10 + 2, name: String(f.awayTeam || 'Away'), logo: getLogoForTeam(String(f.awayTeam || '')) || '' },
                  },
                  goals: { home: Number.isFinite(f.homeScore) ? Number(f.homeScore) : undefined, away: Number.isFinite(f.awayScore) ? Number(f.awayScore) : undefined },
                  score: { halftime: {}, fulltime: { home: Number(f.homeScore ?? 0), away: Number(f.awayScore ?? 0) } },
                } as Fixture;
              }).slice(0, 10);
            } else {
              // Already in UI shape or empty
              fixtureData = (raw as Fixture[]) || [];
            }
          } catch (testError) {
            console.warn('Test fixtures not available, using mock data:', testError);
            // Fallback to mock test data for development
            fixtureData = [
              {
                id: 1001,
                date: '2023-08-19T18:30:00Z',
                timestamp: 1692467400,
                venue: { id: 1, name: 'San Siro', city: 'Milano' },
                status: { long: 'Match Finished', short: 'FT' },
                league: { 
                  id: 135, 
                  name: 'Serie A', 
                  country: 'Italy', 
                  season: 2023, 
                  round: 'Regular Season - 1' 
                },
                teams: {
                  home: { id: 1, name: 'AC Milan', logo: getLogoForTeam('AC Milan') || '' },
                  away: { id: 2, name: 'Bologna', logo: getLogoForTeam('Bologna') || '' }
                },
                goals: { home: 2, away: 0 },
                score: {
                  halftime: { home: 1, away: 0 },
                  fulltime: { home: 2, away: 0 }
                }
              },
              {
                id: 1002,
                date: '2023-08-19T18:30:00Z',
                timestamp: 1692467400,
                venue: { id: 2, name: 'Giuseppe Meazza', city: 'Milano' },
                status: { long: 'Match Finished', short: 'FT' },
                league: { 
                  id: 135, 
                  name: 'Serie A', 
                  country: 'Italy', 
                  season: 2023, 
                  round: 'Regular Season - 1' 
                },
                teams: {
                  home: { id: 3, name: 'Inter', logo: getLogoForTeam('Inter') || '' },
                  away: { id: 4, name: 'Monza', logo: getLogoForTeam('Monza') || '' }
                },
                goals: { home: 1, away: 1 },
                score: {
                  halftime: { home: 0, away: 1 },
                  fulltime: { home: 1, away: 1 }
                }
              }
            ];
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
  }, [currentMode]); // Re-fetch when mode changes

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
    nextFixture();
  };

  const formatMatchDateTime = (dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();
    const tomorrow = new Date();
    tomorrow.setDate(today.getDate() + 1);
    
    const dayOfWeek = date.toLocaleDateString('it-IT', { weekday: 'short' });
    const dayMonth = date.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' });
    const time = date.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
    
    return `${dayOfWeek} ${dayMonth} - ${time}`;
  };

  const getCurrentRound = () => {
    if (fixtures.length === 0) return 'Caricamento...';
    const currentFixture = fixtures[currentFixtureIndex];
    return currentFixture?.league?.round || 'Serie A';
  };

  const getTimeToNextMatch = () => {
    if (fixtures.length === 0) return { days: 0, hours: 0, minutes: 0, seconds: 0 };
    
    const currentFixture = fixtures[currentFixtureIndex];
    if (!currentFixture) return { days: 0, hours: 0, minutes: 0, seconds: 0 };
    
    const matchTime = new Date(currentFixture.date);
    const now = new Date();
    const diff = matchTime.getTime() - now.getTime();
    
    if (diff <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0 };
    
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);
    
    return { days, hours, minutes, seconds };
  };

  const [timeToMatch, setTimeToMatch] = useState(getTimeToNextMatch());

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeToMatch(getTimeToNextMatch());
    }, 1000);

    return () => clearInterval(timer);
  }, [currentFixtureIndex, fixtures]);

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
  const currentPrediction = predictions[currentFixture.id];

  return (
    <div className="min-h-screen bg-white">
      {/* Test Mode Indicator */}
      {currentMode === 'test' && (
        <div className="bg-orange-500 text-white text-center py-3 font-semibold">
          🧪 MODALITÀ TEST - Dati storici Serie A 2023-24
        </div>
      )}
      
      {/* Top Header Panel (Purple) */}
      <div className="mx-4 mt-4 mb-6 rounded-2xl bg-gradient-to-br  from-indigo-600 to-indigo-900  text-white shadow-md">
        <div className="text-center pt-6 px-4">
          <h1 className="text-lg font-semibold mb-1">{getCurrentRound()}</h1>
          <p className="text-sm opacity-90">dal {formatMatchDateTime(fixtures[0]?.date)} al {formatMatchDateTime(fixtures[fixtures.length - 1]?.date)}</p>
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
          <div className="bg-white bg-opacity-30 rounded-full h-2">
            <div
              className="bg-white rounded-full h-2 transition-all duration-300"
              style={{ width: `${((currentFixtureIndex + 1) / fixtures.length) * 100}%` }}
            />
          </div>
          <div className="text-center text-xs mt-2">
            {currentFixtureIndex + 1}/{fixtures.length}
          </div>
        </div>
      </div>

      {/* Match Card */}
      <div className="mx-4 mb-8">
        <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-200">
          {/* Match Info */}
          <div className="text-center mb-6">
            <p className="text-black text-sm mb-1">{formatMatchDateTime(currentFixture.date)}</p>
            <p className="text-black text-xs">{currentFixture.venue.name}</p>
          </div>

          {/* Teams */}
          <div className="flex items-center justify-between mb-8">
            {/* Home Team */}
            <div className="flex-1 text-center">
              {currentFixture.teams.home.logo ? (
                <img
                  src={currentFixture.teams.home.logo}
                  alt={currentFixture.teams.home.name}
                  className="mx-auto mb-3 w-20 h-20 object-contain"
                />
              ) : (
                <div className="w-12 h-12 mx-auto mb-24 bg-purple-800 rounded-full flex items-center justify-center">
                  <span className="text-black font-bold text-lg">
                    {currentFixture.teams.home.name.charAt(0)}
                  </span>
                </div>
              )}
              <h3 className="font-bold text-lg mb-1 text-black">{currentFixture.teams.home.name}</h3>
              <p className="text-xs text-black">Posizione in classifica</p>
              <p className="font-bold text-black">1</p>
              <p className="text-xs text-black mt-1">Vittorie in casa</p>
              <p className="font-bold text-black">82%</p>
              <p className="text-xs text-black mt-1">Ultimi 5 risultati</p>
              <div className="flex justify-center gap-1 mt-1">
                {[2, 1, 2, 1, 2].map((result, idx) => (
                  <div 
                    key={idx}
                    className={`w-5 h-5 rounded-full text-xs text-white flex items-center justify-center ${
                      result === 2 ? 'bg-green-500' : result === 1 ? 'bg-yellow-500' : 'bg-red-500'
                    }`}
                  >
                    {result}
                  </div>
                ))}
              </div>
            </div>

            {/* VS */}
            <div className="px-4">
              <div className="text-2xl font-bold text-gray-400">VS</div>
            </div>

            {/* Away Team */}
            <div className="flex-1 text-center">
              {currentFixture.teams.away.logo ? (
                <img
                  src={currentFixture.teams.away.logo}
                  alt={currentFixture.teams.away.name}
                  className="mx-auto mb-3 w-20 h-20 object-contain"
                />
              ) : (
                <div className="w-12 h-12 mx-auto mb-3 bg-blue-200 rounded-full flex items-center justify-center">
                  <span className="text-blue-600 font-bold text-lg">
                    {currentFixture.teams.away.name.charAt(0)}
                  </span>
                </div>
              )}
              <h3 className="font-bold text-lg mb-1 text-black">{currentFixture.teams.away.name}</h3>
              <p className="text-xs text-black">Posizione in classifica</p>
              <p className="font-bold text-black">14</p>
              <p className="text-xs text-black mt-1">Vittorie in trasferta</p>
              <p className="font-bold text-black">34%</p>
              <p className="text-xs text-black mt-1">Ultimi 5 risultati</p>
              <div className="flex justify-center gap-1 mt-1">
                {[1, 2, 1, 2, 1].map((result, idx) => (
                  <div 
                    key={idx}
                    className={`w-5 h-5 rounded-full text-xs text-white flex items-center justify-center ${
                      result === 2 ? 'bg-green-500' : result === 1 ? 'bg-yellow-500' : 'bg-red-500'
                    }`}
                  >
                    {result}
                  </div>
                ))}
              </div>
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
              className={`w-18 h-8 rounded-2xl font-bold text-lg text-white shadow-md transition-all bg-gradient-to-br from-indigo-600 to-indigo-900 hover:shadow-lg ${
                currentPrediction === 'X' ? 'scale-105 shadow-lg' : ''
              }`}
            >
              X
            </button>
          </div>
          {/* Middle Left: 1 */}
          <div className="col-start-1 row-start-2">
            <button
              onClick={() => handlePrediction(currentFixture.id, '1')}
              className={`w-18 h-8 rounded-2xl font-bold text-lg text-white shadow-md transition-all bg-gradient-to-br from-indigo-600 to-indigo-900 hover:shadow-lg ${
                currentPrediction === '1' ? 'scale-105 shadow-lg' : ''
              }`}
            >
              1
            </button>
          </div>
          {/* Middle Right: 2 */}
          <div className="col-start-3 row-start-2">
            <button
              onClick={() => handlePrediction(currentFixture.id, '2')}
              className={`w-18 h-8 rounded-2xl font-bold text-lg text-white shadow-md transition-all bg-gradient-to-br from-indigo-600 to-indigo-900 hover:shadow-lg ${
                currentPrediction === '2' ? 'scale-105 shadow-lg' : ''
              }`}
            >
              2
            </button>
          </div>
          {/* Bottom: Skip */}
          <div className="col-start-2 row-start-3 -mt-[15px]">
            <button
              onClick={skipFixture}
              className="bg-white  text-indigo-900 w-18 h-8 rounded-2xl font-medium shadow-lg border border-gray-200"
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
