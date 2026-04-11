/**
 * Fix Script: Correct match_date + external_api_id for giornata 23 onwards
 *
 * Problem: From giornata 23 onwards all fixtures were seeded with a
 * placeholder match_date (same timestamp for the whole round), causing:
 *   - GameHeader to display "dal XX/MM al XX/MM" instead of the real date range
 *   - Backfill service to only query the placeholder date and miss matches
 *     that actually kicked off on other days
 *   - external_api_id not set in api_football_<id> format, so Strategy A
 *     (direct ID lookup) never fires
 *
 * Fix:
 *   For each week from START_WEEK to END_WEEK:
 *     1. Fetch all Serie A fixtures for that round from API-Football
 *        (uses the round param so no date guessing is needed).
 *     2. Match each API fixture to a DB row by fuzzy team name.
 *     3. Update match_date, external_api_id, status, scores, result.
 *   Then update user predictions for any newly-finished fixtures.
 *
 * Usage:
 *   npx ts-node fix-fixtures-from-giornata-23.ts
 */

import axios from 'axios';
import { Pool } from 'pg';

const API_KEY = '8b6eae1b729c38e5c9104fd622723236';
const API_URL = 'https://v3.football.api-sports.io';
const DATABASE_URL =
  'postgresql://neondb_owner:npg_GQF3qTHWjck8@ep-rough-dust-aduv9t88-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require';

const START_WEEK = 23;
// Set to the last giornata that has been played or seeded (update as season progresses)
const END_WEEK = 38;

interface ApiMatch {
  fixture: {
    id: number;
    date: string; // ISO timestamp e.g. "2026-01-31T18:00:00+00:00"
    status: { short: string };
  };
  teams: {
    home: { name: string };
    away: { name: string };
  };
  goals: {
    home: number | null;
    away: number | null;
  };
}

async function fetchRound(week: number): Promise<ApiMatch[]> {
  const round = `Regular Season - ${week}`;
  console.log(`\n📡 Fetching round "${round}"...`);
  try {
    const response = await axios.get(`${API_URL}/fixtures`, {
      headers: {
        'x-rapidapi-key': API_KEY,
        'x-rapidapi-host': 'v3.football.api-sports.io',
      },
      params: { league: 135, season: 2025, round },
    });
    const matches = response.data.response as ApiMatch[];
    console.log(`   ✅ API returned ${matches.length} fixtures`);
    return matches;
  } catch (error: any) {
    console.error(`   ❌ API call failed: ${error.message}`);
    return [];
  }
}

function calculateResult(
  homeScore: number | null,
  awayScore: number | null,
): '1' | 'X' | '2' | null {
  if (homeScore === null || awayScore === null) return null;
  if (homeScore > awayScore) return '1';
  if (homeScore < awayScore) return '2';
  return 'X';
}

async function fixWeek(pool: Pool, week: number, matches: ApiMatch[]) {
  let updated = 0;
  let notFound = 0;

  for (const match of matches) {
    const apiHomeTeam = match.teams.home.name;
    const apiAwayTeam = match.teams.away.name;
    const apiFixtureId = match.fixture.id;
    const apiDate = match.fixture.date;
    const status = match.fixture.status.short;
    const homeScore = match.goals.home;
    const awayScore = match.goals.away;

    const isFinished =
      status === 'FT' || status === 'AET' || status === 'PEN';
    const result = isFinished ? calculateResult(homeScore, awayScore) : null;
    const dbStatus = isFinished ? 'FINISHED' : 'SCHEDULED';

    const res = await pool.query(
      `
      UPDATE fixtures
      SET
        match_date      = $1,
        external_api_id = $2,
        status          = $3,
        home_score      = $4,
        away_score      = $5,
        result          = $6,
        updated_at      = NOW()
      WHERE
        week = $7
        AND home_team ILIKE $8
        AND away_team ILIKE $9
      RETURNING id, home_team, away_team, match_date, external_api_id, status, home_score, away_score, result
      `,
      [
        apiDate,
        `api_football_${apiFixtureId}`,
        dbStatus,
        isFinished ? homeScore : null,
        isFinished ? awayScore : null,
        result,
        week,
        `%${apiHomeTeam}%`,
        `%${apiAwayTeam}%`,
      ],
    );

    if (res.rowCount && res.rowCount > 0) {
      updated++;
      const row = res.rows[0];
      console.log(
        `   ✅ [W${week}] ${row.home_team} vs ${row.away_team} → ${row.match_date} | ${row.external_api_id} | ${row.status} | ${row.home_score ?? '-'}-${row.away_score ?? '-'}`,
      );
    } else {
      notFound++;
      console.log(
        `   ⚠️  [W${week}] No DB match for: ${apiHomeTeam} vs ${apiAwayTeam}`,
      );
    }
  }

  return { updated, notFound };
}

async function main() {
  console.log(
    `🚀 Fix fixtures from giornata ${START_WEEK} to ${END_WEEK}\n`,
  );

  const pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  let totalUpdated = 0;
  let totalNotFound = 0;
  const weeksWithUpdates: number[] = [];

  try {
    for (let week = START_WEEK; week <= END_WEEK; week++) {
      const matches = await fetchRound(week);

      if (matches.length === 0) {
        console.log(`   ⏭️  No fixtures returned — skipping week ${week}`);
        // Rate limit between API calls
        await new Promise((resolve) => setTimeout(resolve, 1000));
        continue;
      }

      const { updated, notFound } = await fixWeek(pool, week, matches);
      totalUpdated += updated;
      totalNotFound += notFound;
      if (updated > 0) weeksWithUpdates.push(week);

      // Rate limit between rounds (API-Football free tier: 10 req/min)
      await new Promise((resolve) => setTimeout(resolve, 6000));
    }

    console.log(`\n${'─'.repeat(60)}`);
    console.log(`✨ All done.`);
    console.log(`   Fixtures updated : ${totalUpdated}`);
    console.log(`   Not matched in DB: ${totalNotFound}`);
    console.log(`   Weeks touched    : ${weeksWithUpdates.join(', ') || 'none'}`);

    // Update user predictions for all newly-finished fixtures
    if (weeksWithUpdates.length > 0) {
      console.log(`\n📊 Updating user predictions for affected weeks...`);
      const updatePredictionsQuery = `
        UPDATE specs s
        SET
          result  = f.result,
          correct = (s.choice = f.result)
        FROM fixtures f
        WHERE
          s.fixture_id = f.id::text
          AND f.week >= ${START_WEEK}
          AND f.status = 'FINISHED'
          AND s.result IS NULL
        RETURNING s.id
      `;
      const predRes = await pool.query(updatePredictionsQuery);
      console.log(`   ✅ Updated ${predRes.rowCount || 0} user predictions`);
    }
  } catch (error: any) {
    console.error(`❌ Fatal error: ${error.message}`);
    throw error;
  } finally {
    await pool.end();
  }

  console.log('\n✅ Script complete!');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
