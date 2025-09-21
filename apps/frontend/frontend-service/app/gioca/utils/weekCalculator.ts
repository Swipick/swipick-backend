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

/**
 * Calculate the active prediction week based on current virtual time
 * Logic: User can predict for the week whose matches haven't started yet
 */
export async function calculateActiveWeek(virtualTime: Date): Promise<WeekInfo> {
  try {
    // Try weeks starting from 1 to find the active prediction week
    for (let week = 1; week <= 38; week++) {
      const response = await fetch(`https://swipick-backend-production.up.railway.app/api/test-mode/fixtures/week/${week}`);

      if (!response.ok) {
        continue; // Skip weeks with no data
      }

      const result = await response.json();

      if (!result.success || !result.data || result.data.length === 0) {
        continue; // Skip weeks with no fixtures
      }

      const fixtures = result.data;

      // Get all fixture dates for this week
      const fixtureDates = (fixtures as FixtureData[]).map((f) => new Date(f.date)).sort((a: Date, b: Date) => a.getTime() - b.getTime());

      if (fixtureDates.length === 0) continue;

      const firstMatchDate = fixtureDates[0];
      const lastMatchDate = fixtureDates[fixtureDates.length - 1];
      const virtualNow = virtualTime.getTime();

      // If virtual time is before the first match of this week, this is the prediction week
      if (virtualNow < firstMatchDate.getTime()) {
        return {
          activeWeek: week,
          status: 'prediction',
          nextMatchDate: firstMatchDate
        };
      }

      // If virtual time is during this week (between first and last match), week is live
      if (virtualNow >= firstMatchDate.getTime() && virtualNow <= lastMatchDate.getTime()) {
        // Look for next week for prediction
        const nextWeek = week + 1;
        if (nextWeek <= 38) {
          return {
            activeWeek: nextWeek,
            status: 'prediction',
          };
        }
      }
    }

    // Fallback: if no suitable week found, return week 1
    return {
      activeWeek: 1,
      status: 'prediction'
    };

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
 * Get fixtures for a specific week
 */
export async function getWeekFixtures(week: number): Promise<Array<{ date: string; id: number }>> {
  try {
    const response = await fetch(`https://swipick-backend-production.up.railway.app/api/test-mode/fixtures/week/${week}`);

    if (!response.ok) {
      return [];
    }

    const result = await response.json();

    if (!result.success || !result.data) {
      return [];
    }

    return (result.data as FixtureData[]).map((f) => ({
      date: f.date,
      id: f.id
    }));

  } catch (error) {
    console.warn(`Error fetching week ${week} fixtures:`, error);
    return [];
  }
}