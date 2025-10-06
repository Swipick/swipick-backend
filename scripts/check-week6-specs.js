const { Client } = require('pg');
require('dotenv').config({ path: '../.env' });

const client = new Client({
  connectionString: process.env.DATABASE_URL
});

const userId = 'VWHFxaVPdYZhAvOGOPbRbKQFbNV2';

async function checkWeek6Specs() {
  try {
    await client.connect();
    console.log('🔍 CHECKING WEEK 6 SPECS FOR USER:', userId);
    console.log('='.repeat(60) + '\n');

    // 1. Check what weeks the user has specs for
    console.log('1️⃣  USER SPECS BY WEEK:');
    console.log('-----------------------');

    const userWeeks = await client.query(`
      SELECT
        s.week as spec_week,
        COUNT(*) as spec_count
      FROM specs s
      WHERE s.user_id = $1
        AND s.mode = 'live'
      GROUP BY s.week
      ORDER BY s.week;
    `, [userId]);

    if (userWeeks.rows.length === 0) {
      console.log('User has no specs at all');
    } else {
      userWeeks.rows.forEach(row => {
        console.log(`Week ${row.spec_week}: ${row.spec_count} specs`);
      });
    }

    // 2. Check what fixtures the user has predictions for
    console.log('\n2️⃣  USER PREDICTIONS BY FIXTURE WEEK:');
    console.log('--------------------------------------');

    const userFixtures = await client.query(`
      SELECT
        f.week as fixture_week,
        COUNT(*) as prediction_count,
        STRING_AGG(f.home_team || ' vs ' || f.away_team, ', ') as matches
      FROM specs s
      JOIN fixtures f ON s.fixture_id = f.id
      WHERE s.user_id = $1
        AND s.mode = 'live'
      GROUP BY f.week
      ORDER BY f.week;
    `, [userId]);

    userFixtures.rows.forEach(row => {
      console.log(`\nFixtures from Week ${row.fixture_week}: ${row.prediction_count} predictions`);
      console.log(`Matches: ${row.matches}`);
    });

    // 3. Check if there are week 6 fixtures
    console.log('\n3️⃣  AVAILABLE WEEK 6 FIXTURES:');
    console.log('-------------------------------');

    const week6Fixtures = await client.query(`
      SELECT
        id,
        home_team || ' vs ' || away_team as match,
        match_date,
        status
      FROM fixtures
      WHERE week = 6
      ORDER BY match_date
      LIMIT 10;
    `);

    if (week6Fixtures.rows.length === 0) {
      console.log('❌ No week 6 fixtures found in database');
    } else {
      console.log(`Found ${week6Fixtures.rowCount} week 6 fixtures:`);
      week6Fixtures.rows.forEach((fixture, index) => {
        console.log(`${index + 1}. ${fixture.match}`);
        console.log(`   ID: ${fixture.id}`);
        console.log(`   Date: ${fixture.match_date}`);
        console.log(`   Status: ${fixture.status}`);
      });
    }

    // 4. Check if user has any historical predictions that might be week 6
    console.log('\n4️⃣  CHECKING FOR POSSIBLE WEEK 6 PREDICTIONS:');
    console.log('----------------------------------------------');

    // Look for predictions on fixtures that are week 6 but specs might have wrong week
    const possibleWeek6 = await client.query(`
      SELECT
        s.id as spec_id,
        s.week as recorded_week,
        f.week as fixture_week,
        f.home_team || ' vs ' || f.away_team as match,
        s.choice,
        s.timestamp
      FROM specs s
      JOIN fixtures f ON s.fixture_id = f.id
      WHERE s.user_id = $1
        AND f.week = 6
        AND s.mode = 'live'
      ORDER BY s.timestamp;
    `, [userId]);

    if (possibleWeek6.rows.length > 0) {
      console.log(`✅ Found ${possibleWeek6.rows.length} predictions for week 6 fixtures!`);
      possibleWeek6.rows.forEach(spec => {
        console.log(`\nSpec ID: ${spec.spec_id}`);
        console.log(`  Match: ${spec.match}`);
        console.log(`  Choice: ${spec.choice}`);
        console.log(`  Recorded as week: ${spec.recorded_week} (should be ${spec.fixture_week})`);
        console.log(`  Created: ${spec.timestamp}`);
      });

      if (possibleWeek6.rows.some(r => r.recorded_week !== r.fixture_week)) {
        console.log('\n⚠️  Some specs have incorrect week values!');
      }
    } else {
      console.log('❌ User has no predictions for week 6 fixtures');
    }

    // 5. Summary and recommendations
    console.log('\n5️⃣  SUMMARY & RECOMMENDATIONS:');
    console.log('--------------------------------');

    if (possibleWeek6.rows.length > 0) {
      console.log('✅ User HAS made predictions for week 6 fixtures');
      if (possibleWeek6.rows.some(r => r.recorded_week != 6)) {
        console.log('⚠️  But some are recorded with wrong week number');
        console.log('💡 Run fix-spec-weeks.js again to correct them');
      }
    } else if (week6Fixtures.rows.length > 0) {
      console.log('❌ User has NOT made predictions for week 6 fixtures');
      console.log('💡 User needs to make predictions through the app');
      console.log('💡 Week 6 fixtures are available in the database');
    } else {
      console.log('❌ No week 6 fixtures exist in the database');
      console.log('💡 Need to import week 6 fixtures first');
    }

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await client.end();
    console.log('\nCheck completed');
  }
}

checkWeek6Specs();