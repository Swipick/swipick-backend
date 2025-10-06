const { Client } = require('pg');
require('dotenv').config({ path: '../.env' });

const client = new Client({
  connectionString: process.env.DATABASE_URL
});

async function checkWeek7Users() {
  try {
    await client.connect();
    console.log('Connected to database successfully\n');

    // Find users who have week 7 predictions
    const usersQuery = `
      SELECT DISTINCT s.user_id, COUNT(*) as prediction_count
      FROM specs s
      JOIN fixtures f ON s.fixture_id = f.id
      WHERE f.week = 7
        AND s.mode = 'live'
      GROUP BY s.user_id
      ORDER BY prediction_count DESC
      LIMIT 10;
    `;

    const users = await client.query(usersQuery);

    console.log('='.repeat(80));
    console.log('USERS WITH WEEK 7 PREDICTIONS');
    console.log('='.repeat(80));

    if (users.rows.length === 0) {
      console.log('No users found with week 7 predictions');

      // Check if there are any specs at all
      const anySpecs = await client.query(`
        SELECT COUNT(*) as total,
               COUNT(DISTINCT user_id) as unique_users,
               MIN(week) as min_week,
               MAX(week) as max_week
        FROM specs;
      `);

      console.log('\nGeneral specs statistics:');
      console.log(`Total specs in database: ${anySpecs.rows[0].total}`);
      console.log(`Unique users: ${anySpecs.rows[0].unique_users}`);
      console.log(`Week range: ${anySpecs.rows[0].min_week} to ${anySpecs.rows[0].max_week}`);

    } else {
      console.log(`Found ${users.rows.length} users with week 7 predictions:\n`);

      users.rows.forEach((user, index) => {
        console.log(`${index + 1}. User ID: ${user.user_id}`);
        console.log(`   Predictions made: ${user.prediction_count}`);
      });

      // Get details for the first user
      if (users.rows.length > 0) {
        const firstUserId = users.rows[0].user_id;
        console.log('\n' + '='.repeat(80));
        console.log(`SAMPLE: Showing predictions for user: ${firstUserId}`);
        console.log('='.repeat(80));

        const userSpecs = await client.query(`
          SELECT
            f.home_team || ' vs ' || f.away_team as match,
            s.choice as prediction,
            f.result as actual_result,
            CASE
              WHEN f.result IS NULL THEN 'Pending'
              WHEN s.choice::text = f.result::text THEN '✓'
              ELSE '✗'
            END as correct
          FROM specs s
          JOIN fixtures f ON s.fixture_id = f.id
          WHERE s.user_id = $1
            AND f.week = 7
            AND s.mode = 'live'
          ORDER BY f.id
          LIMIT 5;
        `, [firstUserId]);

        userSpecs.rows.forEach(spec => {
          console.log(`${spec.match}: Predicted ${spec.prediction}, Result: ${spec.actual_result || 'TBD'} ${spec.correct}`);
        });
      }
    }

  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await client.end();
    console.log('\nDatabase connection closed');
  }
}

checkWeek7Users();