/**
 * useFixtures Hook
 * Manages fixture data fetching and state for both test and live modes
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from "@/lib/api-client";
import { getLogoForTeam } from "@/lib/club-logos";

import type {
  Fixture,
  TestFixtureAPI,
  DatabaseFixture,
  MatchCard,
  GameMode
} from '../types';
import { isTestFixture, isTestFixtureArray } from '../types';
import { DEBUG_GIOCA } from '../utils/constants';

interface UseFixturesParams {
  currentMode: GameMode;
  selectedWeek: number | null; // allow null to auto-detect for live mode
  userKey: string | null;
  currentLiveWeek: number | null;
}

interface UseFixturesReturn {
  fixtures: Fixture[];
  matchCards: MatchCard[];
  loading: boolean;
  error: string | null;
  currentLiveWeek: number | null;
  setCurrentLiveWeek: (week: number | null) => void;
}

export function useFixtures({
  currentMode,
  selectedWeek,
  userKey,
  currentLiveWeek,
}: UseFixturesParams): UseFixturesReturn {
  const router = useRouter();
  const [fixtures, setFixtures] = useState<Fixture[]>([]);
  const [matchCards, setMatchCards] = useState<MatchCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [localCurrentLiveWeek, setLocalCurrentLiveWeek] = useState<number | null>(currentLiveWeek);
  
  // Prevent duplicate fetches with the same parameters
  const fetchGuardRef = useRef<string | null>(null);

  const fetchFixtures = useCallback(async () => {
    const fetchKey = `${currentMode}:${selectedWeek ?? 'null'}:${userKey || 'anon'}`;

    if (DEBUG_GIOCA) {
      console.log('[gioca] fetchFixtures called with key:', fetchKey, 'previous key:', fetchGuardRef.current);
    }

    if (fetchGuardRef.current === fetchKey) {
      if (DEBUG_GIOCA) {
        console.log('[gioca] skipping fetch - same key as previous');
      }
      return; // Already fetched for this key
    }
    fetchGuardRef.current = fetchKey;

    try {
      const isFirstFetch = fixtures.length === 0;
      if (isFirstFetch) {
        setLoading(true);
        if (DEBUG_GIOCA) {
          console.log('[gioca] setting loading=true for first fetch', { fetchKey });
        }
      }
      setError(null);

      let fixtureData: Fixture[] = [];
      let cardsArrLocal: MatchCard[] = [];

      if (currentMode === 'test') {
        // Handle week 1 rollover check
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
              if (DEBUG_GIOCA) {
                console.log('[gioca] suppress week1 fetch due to rollover flag; redirecting to week=2');
              }
              // Redirect to week 2
              const href = typeof window !== 'undefined' ? window.location.href : null;
              if (href) {
                const url = new URL(href);
                url.searchParams.set('mode', 'test');
                url.searchParams.set('week', '2');
                try {
                  sessionStorage.setItem('swipick:gioca:autoAdvanceMsg', 'Stiamo iniziando dal giorno 2,\\nvisualizza i risultati della settimana 1 nella pagina dei risultati');
                } catch {}
                router.replace(url.toString());
              }
              return; // Don't fetch week 1
            }
          } catch {}
        }

        // Test mode can work with or without userKey (anonymous mode supported)
        // Only defer if userKey is actively being resolved (not permanently null)
        if (!userKey && typeof window !== 'undefined') {
          // Check if user is actually logged in but userKey is still loading
          const isUserLoading = false; // TODO: Add proper user loading check if needed
          if (isUserLoading) {
            if (DEBUG_GIOCA) {
              console.log('[gioca] defer fetch until userKey is resolved');
            }
            return;
          }
          // Otherwise proceed with anonymous mode
          if (DEBUG_GIOCA) {
            console.log('[gioca] proceeding with anonymous test mode');
          }
        }

        // Fetch match cards for test mode
        try {
          const userIdForOverlay = userKey ?? undefined;
          const mcResponse = await apiClient.getTestMatchCardsByWeek(selectedWeek ?? 1, userIdForOverlay);
          let mcRaw: unknown = mcResponse;
          
          if (mcResponse && typeof mcResponse === 'object' && 'data' in (mcResponse as Record<string, unknown>)) {
            mcRaw = (mcResponse as Record<string, unknown>).data as unknown;
          }
          
          if (Array.isArray(mcRaw)) {
            const arr = (mcRaw as MatchCard[]).slice().sort((a, b) => 
              new Date(a.kickoff.iso).getTime() - new Date(b.kickoff.iso).getTime()
            );
            cardsArrLocal = arr;
            if (DEBUG_GIOCA) {
              console.log('[gioca] match-cards loaded', {
                week: selectedWeek,
                count: arr.length,
                first: arr[0]?.fixtureId,
                userIdForOverlay
              });
              // Log first match card structure to analyze data format
              if (arr.length > 0) {
                console.log('[gioca] TEST MODE - First match card structure:', {
                  home: {
                    name: arr[0]?.home?.name,
                    last5: arr[0]?.home?.last5,
                    form: arr[0]?.home?.form,
                    hasFormArray: Array.isArray(arr[0]?.home?.form),
                    formLength: arr[0]?.home?.form?.length
                  },
                  away: {
                    name: arr[0]?.away?.name,
                    last5: arr[0]?.away?.last5,
                    form: arr[0]?.away?.form,
                    hasFormArray: Array.isArray(arr[0]?.away?.form),
                    formLength: arr[0]?.away?.form?.length
                  }
                });
              }
            }
          } else {
            cardsArrLocal = [];
            if (DEBUG_GIOCA) {
              console.log('[gioca] match-cards empty-or-bad-shape', { 
                week: selectedWeek, 
                mcType: typeof mcRaw 
              });
            }
          }
        } catch {
          cardsArrLocal = [];
          if (DEBUG_GIOCA) {
            console.log('[gioca] match-cards fetch failed');
          }
        }

        // Fetch test fixtures
        const response = await apiClient.getTestFixtures(selectedWeek ?? 1);
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
                venue: { 
                  id: typeof f.id === 'number' ? f.id : idx + 1, 
                  name: String(f.stadium || `${f.homeTeam} vs ${f.awayTeam}`), 
                  city: 'N/A' 
                },
                status: { 
                  long: f.status === 'FT' ? 'Match Finished' : 'Scheduled', 
                  short: String(f.status || '') 
                },
                league: {
                  id: 1,
                  name: 'Serie A',
                  country: 'Italy',
                  season: new Date().getFullYear(),
                  round: `Regular Season - ${selectedWeek}`
                },
                teams: {
                  home: { 
                    id: ((typeof f.id === 'number' ? f.id : idx + 1) * 10) + 1, 
                    name: String(f.homeTeam || 'Home'), 
                    logo: getLogoForTeam(String(f.homeTeam || '')) || '' 
                  },
                  away: { 
                    id: ((typeof f.id === 'number' ? f.id : idx + 1) * 10) + 2, 
                    name: String(f.awayTeam || 'Away'), 
                    logo: getLogoForTeam(String(f.awayTeam || '')) || '' 
                  },
                },
                goals: { home: f.homeScore, away: f.awayScore },
                score: {
                  halftime: { home: undefined, away: undefined },
                  fulltime: { home: f.homeScore, away: f.awayScore },
                },
              };
            });
            
          fixtureData = mapped.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()).slice(0, 10);
        }
        
      } else {
        // Live mode logic - fetch from database fixtures by week
        try {
          // In live mode, find the current active week with upcoming matches
          // For live mode, require selectedWeek to be explicitly provided
          // No auto-detection fallbacks - this prevents unreliable data
          if (!selectedWeek) {
            if (DEBUG_GIOCA) {
              console.log('[gioca] Live mode: waiting for selectedWeek to be provided');
            }
            // Don't throw error immediately - let the loading state handle this
            // Clear any existing data while waiting for selectedWeek
            setFixtures([]);
            setMatchCards([]);
            setLoading(false);
            return;
          }

          const targetWeek = selectedWeek;
          
          // Fetch fixtures for the current week from database
          const dbFixtures = await apiClient.getFixturesByWeek(targetWeek);
          
          if (Array.isArray(dbFixtures) && dbFixtures.length > 0) {
            console.log('[DEBUG] Raw database fixtures for week', targetWeek, ':', dbFixtures.slice(0, 2)); // Show first 2 fixtures
          console.log('[DEBUG] All fixture dates in week', targetWeek, ':', dbFixtures.map(f => ({ date: f.match_date, teams: `${f.home_team} vs ${f.away_team}` })));
            
            // Map database fixtures to Fixture interface
            fixtureData = dbFixtures.map((f: DatabaseFixture, idx: number) => ({
              id: f.id || idx + 1,
              date: f.match_date,
              timestamp: Math.floor(new Date(f.match_date).getTime() / 1000),
              venue: { 
                id: f.id || idx + 1, 
                name: f.stadium || `${f.home_team} vs ${f.away_team}`, 
                city: 'N/A' 
              },
              status: { 
                long: f.status === 'FINISHED' ? 'Match Finished' : f.status === 'LIVE' ? 'Match Live' : 'Scheduled', 
                short: f.status === 'FINISHED' ? 'FT' : f.status === 'LIVE' ? '1H' : 'NS'
              },
              league: {
                id: 135,
                name: 'Serie A',
                country: 'Italy',
                season: new Date().getFullYear(),
                round: `Regular Season - ${f.week || targetWeek}`
              },
              teams: {
                home: { 
                  id: (f.id || idx + 1) * 10 + 1, 
                  name: f.home_team, 
                  logo: getLogoForTeam(f.home_team) || '' 
                },
                away: { 
                  id: (f.id || idx + 1) * 10 + 2, 
                  name: f.away_team, 
                  logo: getLogoForTeam(f.away_team) || '' 
                },
              },
              goals: { home: f.home_score || 0, away: f.away_score || 0 },
              score: {
                halftime: { home: undefined, away: undefined },
                fulltime: { home: f.home_score || 0, away: f.away_score || 0 },
              },
            })).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

            // Try to fetch live match cards if available
            try {
              const cardsResponse = await apiClient.getLiveMatchCardsByWeek(targetWeek, userKey || undefined);
              if (Array.isArray(cardsResponse)) {
                cardsArrLocal = cardsResponse;
                if (DEBUG_GIOCA && cardsResponse.length > 0) {
                  console.log('[gioca] LIVE MODE - First match card structure:', {
                    home: {
                      name: cardsResponse[0]?.home?.name,
                      last5: cardsResponse[0]?.home?.last5,
                      form: cardsResponse[0]?.home?.form,
                      hasFormArray: Array.isArray(cardsResponse[0]?.home?.form),
                      formLength: cardsResponse[0]?.home?.form?.length
                    },
                    away: {
                      name: cardsResponse[0]?.away?.name,
                      last5: cardsResponse[0]?.away?.last5,
                      form: cardsResponse[0]?.away?.form,
                      hasFormArray: Array.isArray(cardsResponse[0]?.away?.form),
                      formLength: cardsResponse[0]?.away?.form?.length
                    }
                  });
                }
              }
            } catch (cardError) {
              if (DEBUG_GIOCA) {
                console.log('[gioca] live match-cards fetch failed, continuing without cards');
              }
            }
          }
        } catch (liveError) {
          if (DEBUG_GIOCA) {
            console.error('[gioca] live fixtures fetch failed:', liveError);
          }
          // Fallback to empty arrays
          fixtureData = [];
          cardsArrLocal = [];
        }
      }

      // Update state
      setFixtures(fixtureData);
      setMatchCards(cardsArrLocal);
      setLoading(false);

      if (DEBUG_GIOCA) {
        console.log('[gioca] fixtures fetched successfully', { 
          mode: currentMode, 
          week: selectedWeek, 
          fixtureCount: fixtureData.length,
          cardCount: cardsArrLocal.length
        });
      }

    } catch (err) {
      console.error('[gioca] fixtures fetch failed:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch fixtures');
      setLoading(false);
    }
  }, [currentMode, selectedWeek, userKey, router, fixtures.length]);

  useEffect(() => {
    if (DEBUG_GIOCA) {
      console.log('[gioca] useEffect triggered for fetchFixtures', {
        currentMode,
        selectedWeek,
        userKey: userKey ? 'present' : 'null'
      });
    }
    fetchFixtures();
  }, [fetchFixtures]);

  return {
    fixtures,
    matchCards,
    loading,
    error,
    currentLiveWeek: localCurrentLiveWeek,
    setCurrentLiveWeek: setLocalCurrentLiveWeek,
  };
}
