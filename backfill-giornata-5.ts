/**
 * Emergency Script: Backfill Giornata 5 Results
 *
 * This script manually fetches results from API Football for giornata 5
 * and updates the database with final scores and results.
 *
 * Usage:
 *   npx ts-node backfill-giornata-5.ts
 */

import axios from 'axios';
import { Pool } from 'pg';

const API_KEY = '8b6eae1b729c38e5c9104fd622723236';
const API_URL = 'https://v3.football.api-sports.io';
const DATABASE_URL =
  'postgresql://neondb_owner:npg_GQF3qTHWjck8@ep-rough-dust-aduv9t88-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require';

// Giornata 5 dates
const GIORNATA_5_DATES = ['2025-09-27', '2025-09-28', '2025-09-29'];

interface ApiMatch {
  fixture: {
    id: number;
    date: string;
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

async function fetchMatchesForDate(date: string): Promise<ApiMatch[]> {
  console.log(`📡 Fetching matches for ${date}...`);

  try {
    const response = await axios.get(`${API_URL}/fixtures`, {
      headers: {
        'x-rapidapi-key': API_KEY,
        'x-rapidapi-host': 'v3.football.api-sports.io',
      },
      params: {
        date: date,
        league: 135, // Serie A
        season: 2025,
      },
    });

    const matches = response.data.response as ApiMatch[];
    console.log(`   ✅ Found ${matches.length} matches`);
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

async function updateDatabase(matches: ApiMatch[]) {
  const pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  try {
    let updated = 0;

    for (const match of matches) {
      const homeTeam = match.teams.home.name;
      const awayTeam = match.teams.away.name;
      const homeScore = match.goals.home;
      const awayScore = match.goals.away;
      const status = match.fixture.status.short;

      // Only update finished matches
      if (status !== 'FT' && status !== 'AET') {
        console.log(`   ⏭️  Skipping ${homeTeam} vs ${awayTeam} (status: ${status})`);
        continue;
      }

      const result = calculateResult(homeScore, awayScore);

      console.log(
        `   🔄 Updating: ${homeTeam} ${homeScore}-${awayScore} ${awayTeam} (Result: ${result})`,
      );

      // Find and update the fixture by team names and week 5
      const updateQuery = `
        UPDATE fixtures
        SET
          status = 'FINISHED',
          home_score = $1,
          away_score = $2,
          result = $3,
          updated_at = NOW()
        WHERE
          week = 5
          AND home_team ILIKE $4
          AND away_team ILIKE $5
          AND status = 'SCHEDULED'
        RETURNING id, home_team, away_team, home_score, away_score, result
      `;

      const res = await pool.query(updateQuery, [
        homeScore,
        awayScore,
        result,
        `%${homeTeam}%`,
        `%${awayTeam}%`,
      ]);

      if (res.rowCount && res.rowCount > 0) {
        updated++;
        console.log(`      ✅ Updated fixture ${res.rows[0].id}`);
      } else {
        console.log(`      ⚠️  No matching fixture found in database`);
      }
    }

    console.log(`\n✨ Successfully updated ${updated} fixtures!`);

    // Now update user predictions
    console.log(`\n📊 Updating user prediction scores...`);
    const updatePredictionsQuery = `
      UPDATE specs s
      SET
        result = f.result,
        correct = (s.choice = f.result)
      FROM fixtures f
      WHERE
        s.fixture_id = f.id::text
        AND f.week = 5
        AND f.status = 'FINISHED'
        AND s.result IS NULL
      RETURNING s.id
    `;

    const predRes = await pool.query(updatePredictionsQuery);
    console.log(`   ✅ Updated ${predRes.rowCount || 0} predictions`);
  } catch (error: any) {
    console.error(`❌ Database error: ${error.message}`);
    throw error;
  } finally {
    await pool.end();
  }
}

async function main() {
  console.log('🚀 Starting Giornata 5 Backfill Script\n');

  let allMatches: ApiMatch[] = [];

  // Fetch matches for all giornata 5 dates
  for (const date of GIORNATA_5_DATES) {
    const matches = await fetchMatchesForDate(date);
    allMatches = allMatches.concat(matches);
    await new Promise((resolve) => setTimeout(resolve, 1000)); // Rate limit
  }

  console.log(`\n📦 Total matches fetched: ${allMatches.length}\n`);

  if (allMatches.length === 0) {
    console.log('❌ No matches found. Exiting.');
    return;
  }

  // Update database
  await updateDatabase(allMatches);

  console.log('\n✅ Backfill complete!');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});