const { Client } = require('pg');
require('dotenv').config({ path: '../.env' });

const client = new Client({
  connectionString: process.env.DATABASE_URL
});

const userId = 'VWHFxaVPdYZhAvOGOPbRbKQFbNV2';

async function verifyWeek6Results() {
  try {
    await client.connect();
    console.log('📊 WEEK 6 RESULTS FOR USER:', userId);
    console.log('='.repeat(60) + '\n');

    // Get all week 6 predictions with results
    const results = await client.query(`
      SELECT
        f.home_team || ' vs ' || f.away_team as match,
        s.choice as prediction,
        f.result as actual,
        f.home_score,
        f.away_score,
        CASE
          WHEN s.choice::text = f.result::text THEN '✅'
          ELSE '❌'
        END as correct
      FROM specs s
      JOIN fixtures f ON s.fixture_id = f.id
      WHERE s.user_id = $1
        AND f.week = 6
        AND s.mode = 'live'
      ORDER BY f.match_date, f.id
    `, [userId]);

    console.log('MATCH RESULTS:');
    console.log('--------------\n');

    let correctCount = 0;
    let totalCount = results.rows.length;

    results.rows.forEach((match, index) => {
      const scoreDisplay = (match.home_score !== null && match.away_score !== null)
        ? `(${match.home_score}-${match.away_score})`
        : '';

      console.log(`${index + 1}. ${match.match} ${scoreDisplay}`);
      console.log(`   Predicted: ${match.prediction} | Actual: ${match.actual} ${match.correct}`);

      if (match.correct === '✅') correctCount++;
    });

    const percentage = totalCount > 0 ? (correctCount / totalCount * 100).toFixed(1) : 0;

    console.log('\n' + '='.repeat(60));
    console.log('SUMMARY:');
    console.log('--------');
    console.log(`Total Matches: ${totalCount}`);
    console.log(`Correct Predictions: ${correctCount}`);
    console.log(`Wrong Predictions: ${totalCount - correctCount}`);
    console.log(`Success Rate: ${percentage}%`);

    // Check final week score
    const finalScore = await client.query(`
      SELECT revealed, correct, percent
      FROM final_week_scores
      WHERE "userId" = $1 AND week = 6 AND mode = 'live'
    `, [userId]);

    if (finalScore.rows.length > 0) {
      const score = finalScore.rows[0];
      console.log('\nFINAL WEEK SCORE (from database):');
      console.log(`Revealed: ${score.revealed}, Correct: ${score.correct}, Percent: ${score.percent}%`);
    }

    // Check user's week distribution
    console.log('\n' + '='.repeat(60));
    console.log('USER WEEK DISTRIBUTION:');
    console.log('-----------------------');

    const weekDist = await client.query(`
      SELECT
        f.week,
        COUNT(*) as spec_count
      FROM specs s
      JOIN fixtures f ON s.fixture_id = f.id
      WHERE s.user_id = $1
        AND s.mode = 'live'
      GROUP BY f.week
      ORDER BY f.week
    `, [userId]);

    weekDist.rows.forEach(row => {
      console.log(`Week ${row.week}: ${row.spec_count} predictions`);
    });

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await client.end();
    console.log('\nVerification completed');
  }
}

verifyWeek6Results();