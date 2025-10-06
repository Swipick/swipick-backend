const { Client } = require('pg');
require('dotenv').config({ path: '../.env' });

const client = new Client({
  connectionString: process.env.DATABASE_URL
});

async function getUserSpecs() {
  try {
    await client.connect();
    console.log('Connected to database successfully\n');

    // First, let's check if the user exists in specs table
    const checkUser = await client.query(`
      SELECT COUNT(*) as count
      FROM specs
      WHERE user_id = 'd2a9e44a-c9d4-4747-9489-b3e10bbec892'
    `);
    console.log(`Total specs for this user: ${checkUser.rows[0].count}\n`);

    // Get week 7 specs with match details
    const query = `
      SELECT
        f.home_team,
        f.away_team,
        s.choice as user_prediction,
        f.result as actual_result,
        f.home_score,
        f.away_score,
        f.status,
        CASE
          WHEN f.result IS NULL THEN 'Pending'
          WHEN s.choice::text = f.result::text THEN 'Correct ✓'
          ELSE 'Wrong ✗'
        END as outcome
      FROM specs s
      JOIN fixtures f ON s.fixture_id = f.id
      WHERE
        s.user_id = 'd2a9e44a-c9d4-4747-9489-b3e10bbec892'
        AND f.week = 7
        AND s.mode = 'live'
      ORDER BY f.id;
    `;

    const result = await client.query(query);

    console.log('='.repeat(80));
    console.log('USER PREDICTIONS FOR WEEK 7');
    console.log('User ID: d2a9e44a-c9d4-4747-9489-b3e10bbec892');
    console.log('='.repeat(80));
    console.log();

    if (result.rows.length === 0) {
      console.log('No predictions found for week 7');
    } else {
      result.rows.forEach((row, index) => {
        console.log(`Match ${index + 1}: ${row.home_team} vs ${row.away_team}`);
        console.log(`  User predicted: ${row.user_prediction}`);
        console.log(`  Actual result: ${row.actual_result || 'Not finished'}`);
        if (row.home_score !== null && row.away_score !== null) {
          console.log(`  Final score: ${row.home_score} - ${row.away_score}`);
        }
        console.log(`  Status: ${row.status}`);
        console.log(`  Outcome: ${row.outcome}`);
        console.log('-'.repeat(40));
      });

      // Calculate statistics
      const finished = result.rows.filter(r => r.actual_result !== null);
      const correct = result.rows.filter(r => r.outcome === 'Correct ✓');

      console.log('\nSUMMARY:');
      console.log(`Total predictions: ${result.rows.length}`);
      console.log(`Matches finished: ${finished.length}`);
      console.log(`Correct predictions: ${correct.length}`);
      if (finished.length > 0) {
        console.log(`Accuracy: ${((correct.length / finished.length) * 100).toFixed(1)}%`);
      }
    }

  } catch (err) {
    console.error('Error executing query:', err.message);
    console.error('Full error:', err);
  } finally {
    await client.end();
    console.log('\nDatabase connection closed');
  }
}

getUserSpecs();