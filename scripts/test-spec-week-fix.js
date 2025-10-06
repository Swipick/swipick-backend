const { Client } = require('pg');
require('dotenv').config({ path: '../.env' });

const client = new Client({
  connectionString: process.env.DATABASE_URL
});

async function testSpecWeekFix() {
  try {
    await client.connect();
    console.log('🔍 TESTING SPEC WEEK FIX');
    console.log('========================\n');

    // 1. Check current spec weeks
    console.log('1️⃣  CHECKING CURRENT SPEC WEEKS:');
    console.log('---------------------------------');

    const currentSpecs = await client.query(`
      SELECT
        s.week as spec_week,
        f.week as fixture_week,
        COUNT(*) as count,
        CASE
          WHEN s.week = f.week THEN '✅ CORRECT'
          ELSE '❌ WRONG'
        END as status
      FROM specs s
      JOIN fixtures f ON s.fixture_id = f.id
      WHERE s.mode = 'live'
      GROUP BY s.week, f.week
      ORDER BY f.week, s.week;
    `);

    currentSpecs.rows.forEach(row => {
      console.log(`Specs with week ${row.spec_week} for fixtures in week ${row.fixture_week}: ${row.count} specs ${row.status}`);
    });

    // 2. Check if any new specs were created recently (last hour)
    console.log('\n2️⃣  RECENT SPECS (Last Hour):');
    console.log('-----------------------------');

    const recentSpecs = await client.query(`
      SELECT
        s.id,
        s.user_id,
        s.week as spec_week,
        f.week as fixture_week,
        f.home_team || ' vs ' || f.away_team as match,
        s.choice,
        s.timestamp,
        CASE
          WHEN s.week = f.week THEN '✅'
          ELSE '❌'
        END as correct_week
      FROM specs s
      JOIN fixtures f ON s.fixture_id = f.id
      WHERE s.timestamp > NOW() - INTERVAL '1 hour'
        AND s.mode = 'live'
      ORDER BY s.timestamp DESC
      LIMIT 5;
    `);

    if (recentSpecs.rows.length === 0) {
      console.log('No specs created in the last hour');
    } else {
      recentSpecs.rows.forEach(spec => {
        console.log(`${spec.correct_week} User ${spec.user_id.substring(0, 10)}...`);
        console.log(`   Match: ${spec.match}`);
        console.log(`   Spec week: ${spec.spec_week}, Fixture week: ${spec.fixture_week}`);
        console.log(`   Created: ${spec.timestamp}`);
      });
    }

    // 3. Test the percentile endpoint
    console.log('\n3️⃣  TESTING PERCENTILE ENDPOINT:');
    console.log('----------------------------------');

    // Get a user with week 7 specs
    const userWithSpecs = await client.query(`
      SELECT DISTINCT s.user_id, COUNT(*) as spec_count
      FROM specs s
      JOIN fixtures f ON s.fixture_id = f.id
      WHERE f.week = 7 AND s.mode = 'live'
      GROUP BY s.user_id
      LIMIT 1;
    `);

    if (userWithSpecs.rows.length > 0) {
      const testUserId = userWithSpecs.rows[0].user_id;
      console.log(`Testing with user: ${testUserId}`);
      console.log(`User has ${userWithSpecs.rows[0].spec_count} specs for week 7`);

      // Test the percentile endpoint
      const fetch = require('node-fetch');
      const percentileUrl = `https://swipick-backend-production.up.railway.app/api/final-week-scores/${testUserId}/week/7/percentile?mode=live`;

      try {
        const response = await fetch(percentileUrl);
        const data = await response.json();

        if (response.ok) {
          console.log('✅ Percentile endpoint working!');
          console.log(`   Percentile: ${data.percentile}`);
          console.log(`   Total players: ${data.totalPlayers}`);
          console.log(`   Better than: ${data.betterThanPercent}% of players`);
        } else {
          console.log('❌ Percentile endpoint failed:');
          console.log(`   Status: ${response.status}`);
          console.log(`   Error: ${JSON.stringify(data)}`);
        }
      } catch (error) {
        console.log('❌ Failed to call percentile endpoint:', error.message);
      }
    } else {
      console.log('No users found with week 7 specs to test percentile');
    }

    // 4. Summary
    console.log('\n4️⃣  SUMMARY:');
    console.log('------------');

    const summary = await client.query(`
      SELECT
        COUNT(CASE WHEN s.week = f.week THEN 1 END) as correct_count,
        COUNT(CASE WHEN s.week != f.week THEN 1 END) as wrong_count,
        COUNT(*) as total_count
      FROM specs s
      JOIN fixtures f ON s.fixture_id = f.id
      WHERE s.mode = 'live';
    `);

    const row = summary.rows[0];
    const correctPct = ((row.correct_count / row.total_count) * 100).toFixed(1);

    console.log(`Total specs: ${row.total_count}`);
    console.log(`✅ Correct week: ${row.correct_count} (${correctPct}%)`);
    console.log(`❌ Wrong week: ${row.wrong_count}`);

    if (row.wrong_count === '0') {
      console.log('\n🎉 SUCCESS! All specs have correct week values!');
    } else {
      console.log(`\n⚠️  WARNING: ${row.wrong_count} specs still have incorrect week values`);
    }

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await client.end();
    console.log('\nTest completed');
  }
}

testSpecWeekFix();