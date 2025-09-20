/**
 * useLiveWeek Hook
 * Polls /api/fixtures/next to get accurate current live week data from database
 * NO FALLBACKS - returns error if live week cannot be determined
 */

import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '@/lib/api-client';

interface LiveWeekData {
  currentWeek: number;
  weekDateRange: {
    from: string;
    to: string;
  };
  nextFixtures?: any[];
}

interface UseLiveWeekReturn {
  liveWeekData: LiveWeekData | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useLiveWeek(): UseLiveWeekReturn {
  const [liveWeekData, setLiveWeekData] = useState<LiveWeekData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchLiveWeek = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Call /api/fixtures/next to get current week from database
      const response = await apiClient.getNextFixtures(10);

      // Debug: log the actual response
      console.log('[useLiveWeek] API response:', response);

      if (!response.success) {
        throw new Error(response.error || 'Failed to get current week data');
      }

      // Validate that we have a detectedWeek
      if (!response.detectedWeek) {
        console.log('[useLiveWeek] No detectedWeek in response. Full response:', response);

        // If no upcoming fixtures, try to determine current week from fixtures anyway
        const fixtures = response.fixtures || [];
        if (fixtures.length > 0) {
          // Try to extract week from the fixture data itself
          const firstFixture = fixtures[0];
          if (firstFixture && firstFixture.league && firstFixture.league.round) {
            const match = firstFixture.league.round.match(/(\d+)/);
            if (match) {
              const weekFromRound = parseInt(match[1], 10);
              console.log('[useLiveWeek] Extracted week from round:', weekFromRound);
              response.detectedWeek = weekFromRound; // Override the detectedWeek
            }
          }
        }

        if (!response.detectedWeek) {
          throw new Error('No current week detected - database may not have upcoming fixtures');
        }
      }

      // Calculate date range from the fixtures in this week
      const fixtures = response.fixtures || [];
      if (fixtures.length === 0) {
        throw new Error('No fixtures found for current week');
      }

      // Calculate actual week date range from fixtures
      const dates = fixtures.map((f: any) => new Date(f.date)).sort((a: Date, b: Date) => a.getTime() - b.getTime());
      const firstDate = dates[0];
      const lastDate = dates[dates.length - 1];

      const weekDateRange = {
        from: firstDate.toLocaleDateString('it-IT', {
          day: '2-digit',
          month: '2-digit',
          timeZone: 'Europe/Rome'
        }),
        to: lastDate.toLocaleDateString('it-IT', {
          day: '2-digit',
          month: '2-digit',
          timeZone: 'Europe/Rome'
        })
      };

      setLiveWeekData({
        currentWeek: response.detectedWeek,
        weekDateRange,
        nextFixtures: fixtures
      });

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      console.error('[useLiveWeek] Failed to fetch current week:', errorMessage);
      setError(errorMessage);
      setLiveWeekData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch on mount
  useEffect(() => {
    fetchLiveWeek();
  }, [fetchLiveWeek]);

  // Poll every 5 minutes to keep current week data fresh
  useEffect(() => {
    const interval = setInterval(() => {
      fetchLiveWeek();
    }, 5 * 60 * 1000); // 5 minutes

    return () => clearInterval(interval);
  }, [fetchLiveWeek]);

  return {
    liveWeekData,
    loading,
    error,
    refetch: fetchLiveWeek,
  };
}