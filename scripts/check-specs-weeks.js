const { Client } = require('pg');
require('dotenv').config({ path: '../.env' });

const client = new Client({
  connectionString: process.env.DATABASE_URL
});

async function checkSpecsWeeks() {
  try {
    await client.connect();
    console.log('Connected to database successfully\n');

    // Check what weeks are in the specs table
    const weeksQuery = `
      SELECT
        week,
        COUNT(*) as spec_count,
        COUNT(DISTINCT user_id) as unique_users
      FROM specs
      GROUP BY week
      ORDER BY week;
    `;

    const weeks = await client.query(weeksQuery);

    console.log('='.repeat(80));
    console.log('WEEKS IN SPECS TABLE');
    console.log('='.repeat(80));

    weeks.rows.forEach(row => {
      console.log(`Week ${row.week}: ${row.spec_count} specs from ${row.unique_users} users`);
    });

    // Now let's see what fixtures these week 1 specs are actually for
    console.log('\n' + '='.repeat(80));
    console.log('ACTUAL FIXTURE WEEKS FOR "WEEK 1" SPECS');
    console.log('='.repeat(80));

    const fixtureWeeksQuery = `
      SELECT
        s.week as spec_week,
        f.week as fixture_week,
        COUNT(*) as count,
        COUNT(DISTINCT s.user_id) as users
      FROM specs s
      JOIN fixtures f ON s.fixture_id = f.id
      WHERE s.week = 1
      GROUP BY s.week, f.week
      ORDER BY f.week;
    `;

    const fixtureWeeks = await client.query(fixtureWeeksQuery);

    console.log('\nSpecs marked as week 1 are actually for fixtures in:');
    fixtureWeeks.rows.forEach(row => {
      console.log(`  Fixture Week ${row.fixture_week}: ${row.count} predictions from ${row.users} users`);
    });

    // Show sample data
    console.log('\n' + '='.repeat(80));
    console.log('SAMPLE SPECS DATA (showing mismatch)');
    console.log('='.repeat(80));

    const sampleQuery = `
      SELECT
        s.user_id,
        s.week as spec_week,
        f.week as fixture_week,
        f.home_team || ' vs ' || f.away_team as match,
        s.choice as prediction
      FROM specs s
      JOIN fixtures f ON s.fixture_id = f.id
      WHERE f.week = 7
      LIMIT 5;
    `;

    const sample = await client.query(sampleQuery);

    console.log('\nSample of fixtures from week 7 with their spec weeks:');
    sample.rows.forEach(row => {
      console.log(`User: ${row.user_id.substring(0, 10)}...`);
      console.log(`  Match: ${row.match}`);
      console.log(`  Spec says week: ${row.spec_week}, Fixture is week: ${row.fixture_week}`);
      console.log(`  Prediction: ${row.prediction}`);
      console.log('-'.repeat(40));
    });

  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await client.end();
    console.log('\nDatabase connection closed');
  }
}

checkSpecsWeeks();