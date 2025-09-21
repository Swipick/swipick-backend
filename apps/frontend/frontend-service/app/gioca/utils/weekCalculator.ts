/**
 * Week Calculator Utility
 * Dynamically determines the active prediction week based on virtual time
 */

export interface WeekInfo {
  activeWeek: number;
  status: 'prediction' | 'live' | 'completed';
  nextMatchDate?: Date;
}

interface FixtureData {
  id: number;
  date: string;
}

// Cache for API results to avoid repeated calls
const fixtureCache = new Map<number, FixtureData[]>();
const weekInfoCache = new Map<string, { result: WeekInfo; timestamp: number }>();
const CACHE_DURATION = 30000; // 30 seconds cache

/**
 * Calculate the active prediction week based on current virtual time
 * Logic: User can predict for the week whose matches haven't started yet
 * Optimized to start checking from week 4 and work backwards/forwards
 */
export async function calculateActiveWeek(virtualTime: Date): Promise<WeekInfo> {
  try {
    // Check cache first
    const cacheKey = virtualTime.toISOString().slice(0, 16); // Round to nearest minute
    const cached = weekInfoCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      console.log(`[weekCalculator] Cache hit for ${cacheKey}`);
      return cached.result;
    }

    console.log(`[weekCalculator] Cache miss, calculating active week...`);

    // Optimized approach: Start from week 4 (known active week) and check nearby weeks
    const candidateWeeks = [4, 3, 5, 2, 6, 1, 7]; // Check week 4 first, then nearby weeks

    for (const week of candidateWeeks) {
      if (week > 38) continue;

      const fixtures = await getWeekFixturesWithCache(week);

      if (fixtures.length === 0) continue;

      // Get all fixture dates for this week
      const fixtureDates = fixtures.map((f) => new Date(f.date)).sort((a: Date, b: Date) => a.getTime() - b.getTime());

      if (fixtureDates.length === 0) continue;

      const firstMatchDate = fixtureDates[0];
      const lastMatchDate = fixtureDates[fixtureDates.length - 1];
      const virtualNow = virtualTime.getTime();

      // If virtual time is before the first match of this week, this is the prediction week
      if (virtualNow < firstMatchDate.getTime()) {
        const result = {
          activeWeek: week,
          status: 'prediction' as const,
          nextMatchDate: firstMatchDate
        };

        // Cache the result
        weekInfoCache.set(cacheKey, { result, timestamp: Date.now() });
        console.log(`[weekCalculator] Active week determined: ${week}`);
        return result;
      }

      // If virtual time is during this week (between first and last match), week is live
      if (virtualNow >= firstMatchDate.getTime() && virtualNow <= lastMatchDate.getTime()) {
        // Look for next week for prediction
        const nextWeek = week + 1;
        if (nextWeek <= 38) {
          const result = {
            activeWeek: nextWeek,
            status: 'prediction' as const,
          };

          // Cache the result
          weekInfoCache.set(cacheKey, { result, timestamp: Date.now() });
          console.log(`[weekCalculator] Active week determined: ${nextWeek} (next after live week ${week})`);
          return result;
        }
      }
    }

    // If no week found in candidates, fallback to week 4
    const fallbackResult = {
      activeWeek: 4,
      status: 'prediction' as const
    };

    // Cache the fallback result
    weekInfoCache.set(cacheKey, { result: fallbackResult, timestamp: Date.now() });
    console.log(`[weekCalculator] Fallback to week 4`);
    return fallbackResult;

  } catch (error) {
    console.warn('Error calculating active week:', error);
    // Fallback to week 4 (our known test case)
    return {
      activeWeek: 4,
      status: 'prediction'
    };
  }
}

/**
 * Get fixtures for a specific week with caching
 */
async function getWeekFixturesWithCache(week: number): Promise<FixtureData[]> {
  // Check cache first
  if (fixtureCache.has(week)) {
    return fixtureCache.get(week)!;
  }

  try {
    const response = await fetch(`https://swipick-backend-production.up.railway.app/api/test-mode/fixtures/week/${week}`);

    if (!response.ok) {
      fixtureCache.set(week, []); // Cache empty result
      return [];
    }

    const result = await response.json();

    if (!result.success || !result.data) {
      fixtureCache.set(week, []); // Cache empty result
      return [];
    }

    const fixtures = result.data as FixtureData[];
    fixtureCache.set(week, fixtures); // Cache result
    return fixtures;

  } catch (error) {
    console.warn(`Error fetching week ${week} fixtures:`, error);
    fixtureCache.set(week, []); // Cache empty result on error
    return [];
  }
}

/**
 * Get fixtures for a specific week (public interface)
 */
export async function getWeekFixtures(week: number): Promise<Array<{ date: string; id: number }>> {
  const fixtures = await getWeekFixturesWithCache(week);
  return fixtures.map((f) => ({
    date: f.date,
    id: f.id
  }));
}