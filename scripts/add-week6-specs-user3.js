const { Client } = require('pg');
require('dotenv').config({ path: '../.env' });

const client = new Client({
  connectionString: process.env.DATABASE_URL
});

const userId = '2VxJNVD1R0aFtB10huOewh0SM4n1';
const predictions = ['1', '1', '2', '2', '1', 'X', '2', '2', '2', '2'];

async function addWeek6Specs() {
  try {
    await client.connect();
    console.log('📝 ADDING WEEK 6 SPECS FOR USER:', userId);
    console.log('Predictions:', predictions.join(', '));
    console.log('='.repeat(60) + '\n');

    // 1. Get week 6 fixtures in order
    console.log('1️⃣  FETCHING WEEK 6 FIXTURES:');
    console.log('-----------------------------');

    const week6Fixtures = await client.query(`
      SELECT
        id,
        home_team || ' vs ' || away_team as match,
        match_date,
        status,
        result
      FROM fixtures
      WHERE week = 6
      ORDER BY match_date, id
    `);

    if (week6Fixtures.rows.length !== predictions.length) {
      console.log(`❌ Error: Found ${week6Fixtures.rows.length} fixtures but have ${predictions.length} predictions`);
      console.log('Please check the predictions array');
      return;
    }

    console.log(`Found ${week6Fixtures.rows.length} fixtures for week 6:\n`);
    week6Fixtures.rows.forEach((fixture, index) => {
      console.log(`${index + 1}. ${fixture.match}`);
      console.log(`   Date: ${new Date(fixture.match_date).toLocaleString()}`);
      console.log(`   Prediction: ${predictions[index]}`);
      console.log(`   Actual result: ${fixture.result || 'N/A'}`);
      console.log(`   Match: ${predictions[index] === fixture.result ? '✅' : '❌'}`);
      console.log();
    });

    // 2. Check for existing specs
    console.log('2️⃣  CHECKING FOR EXISTING SPECS:');
    console.log('---------------------------------');

    const existingSpecs = await client.query(`
      SELECT
        s.id,
        f.home_team || ' vs ' || f.away_team as match,
        s.choice
      FROM specs s
      JOIN fixtures f ON s.fixture_id = f.id
      WHERE s.user_id = $1
        AND f.week = 6
        AND s.mode = 'live'
    `, [userId]);

    if (existingSpecs.rows.length > 0) {
      console.log(`⚠️  User already has ${existingSpecs.rows.length} specs for week 6:`);
      existingSpecs.rows.forEach(spec => {
        console.log(`   ${spec.match}: ${spec.choice}`);
      });
      console.log('\nDeleting existing specs first...');

      await client.query(`
        DELETE FROM specs
        WHERE user_id = $1
          AND fixture_id IN (
            SELECT id FROM fixtures WHERE week = 6
          )
          AND mode = 'live'
      `, [userId]);

      console.log('✅ Existing specs deleted');
    } else {
      console.log('✅ No existing week 6 specs found');
    }

    // 3. Insert new specs
    console.log('\n3️⃣  INSERTING NEW SPECS:');
    console.log('------------------------');

    const insertPromises = week6Fixtures.rows.map((fixture, index) => {
      const choice = predictions[index];
      const correct = fixture.result ? (choice === fixture.result) : null;

      return client.query(`
        INSERT INTO specs (
          id,
          user_id,
          fixture_id,
          choice,
          result,
          correct,
          week,
          timestamp,
          mode
        ) VALUES (
          gen_random_uuid(),
          $1,
          $2,
          $3,
          $4,
          $5,
          6,
          NOW() - INTERVAL '2 days' + INTERVAL '${index * 130} seconds',
          'live'
        )
        RETURNING id
      `, [userId, fixture.id, choice, fixture.result, correct]);
    });

    const results = await Promise.all(insertPromises);
    console.log(`✅ Successfully inserted ${results.length} specs`);

    // 4. Verify the insertion
    console.log('\n4️⃣  VERIFYING INSERTION:');
    console.log('------------------------');

    const verifyQuery = await client.query(`
      SELECT
        s.id,
        f.home_team || ' vs ' || f.away_team as match,
        s.choice as prediction,
        f.result as actual,
        CASE
          WHEN s.choice::text = f.result::text THEN '✅ CORRECT'
          WHEN f.result IS NULL THEN '⏳ PENDING'
          ELSE '❌ WRONG'
        END as outcome,
        s.week,
        s.timestamp
      FROM specs s
      JOIN fixtures f ON s.fixture_id = f.id
      WHERE s.user_id = $1
        AND f.week = 6
        AND s.mode = 'live'
      ORDER BY f.match_date, f.id
    `, [userId]);

    console.log(`\nUser now has ${verifyQuery.rows.length} predictions for week 6:\n`);

    let correctCount = 0;
    let wrongCount = 0;

    verifyQuery.rows.forEach((spec, index) => {
      console.log(`${index + 1}. ${spec.match}`);
      console.log(`   Prediction: ${spec.prediction}, Actual: ${spec.actual || 'N/A'}`);
      console.log(`   Outcome: ${spec.outcome}`);

      if (spec.outcome === '✅ CORRECT') correctCount++;
      else if (spec.outcome === '❌ WRONG') wrongCount++;
    });

    // 5. Calculate and save final week score
    console.log('\n5️⃣  CALCULATING WEEK 6 SCORE:');
    console.log('------------------------------');

    const totalMatches = verifyQuery.rows.length;
    const percentage = totalMatches > 0 ? (correctCount / totalMatches * 100).toFixed(1) : 0;

    console.log(`Correct: ${correctCount}/${totalMatches}`);
    console.log(`Wrong: ${wrongCount}/${totalMatches}`);
    console.log(`Percentage: ${percentage}%`);

    // Check if final week score exists
    const existingScore = await client.query(`
      SELECT * FROM final_week_scores
      WHERE "userId" = $1 AND week = 6 AND mode = 'live'
    `, [userId]);

    if (existingScore.rows.length > 0) {
      // Update existing score
      await client.query(`
        UPDATE final_week_scores
        SET revealed = $1, correct = $2, percent = $3, "updatedAt" = NOW()
        WHERE "userId" = $4 AND week = 6 AND mode = 'live'
      `, [totalMatches, correctCount, parseFloat(percentage), userId]);
      console.log('✅ Updated final week score');
    } else {
      // Insert new score
      await client.query(`
        INSERT INTO final_week_scores (
          id, "userId", week, mode, revealed, correct, percent, "createdAt", "updatedAt"
        ) VALUES (
          gen_random_uuid(), $1, 6, 'live', $2, $3, $4, NOW(), NOW()
        )
      `, [userId, totalMatches, correctCount, parseFloat(percentage)]);
      console.log('✅ Created final week score');
    }

    console.log('\n' + '='.repeat(60));
    console.log('✅ SUCCESSFULLY ADDED WEEK 6 PREDICTIONS!');
    console.log(`User ${userId} now has:`);
    console.log(`- ${verifyQuery.rows.length} predictions for week 6`);
    console.log(`- Score: ${correctCount}/${totalMatches} (${percentage}%)`);

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    await client.end();
    console.log('\nScript completed');
  }
}

// Run the script
addWeek6Specs();
