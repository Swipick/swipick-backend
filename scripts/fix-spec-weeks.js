const { Client } = require('pg');
require('dotenv').config({ path: '../.env' });

const client = new Client({
  connectionString: process.env.DATABASE_URL
});

async function fixSpecWeeks() {
  try {
    await client.connect();
    console.log('Connected to database\n');

    // First, let's see the current state
    const checkQuery = `
      SELECT
        s.week as spec_week,
        f.week as fixture_week,
        COUNT(*) as count
      FROM specs s
      JOIN fixtures f ON s.fixture_id = f.id
      WHERE s.mode = 'live'
      GROUP BY s.week, f.week
      ORDER BY s.week, f.week;
    `;

    const before = await client.query(checkQuery);
    console.log('BEFORE FIX - Spec weeks vs Fixture weeks:');
    console.log('==========================================');
    before.rows.forEach(row => {
      console.log(`Spec week ${row.spec_week} -> Fixture week ${row.fixture_week}: ${row.count} specs`);
      if (row.spec_week != row.fixture_week) {
        console.log(`  ⚠️  MISMATCH: ${row.count} specs have wrong week!`);
      }
    });

    // Now fix the mismatched weeks
    console.log('\n' + '='.repeat(50));
    console.log('FIXING SPEC WEEKS...');
    console.log('='.repeat(50));

    const updateQuery = `
      UPDATE specs s
      SET week = f.week
      FROM fixtures f
      WHERE s.fixture_id = f.id
        AND s.week != f.week
        AND s.mode = 'live'
      RETURNING s.id, s.user_id, s.week as new_week, f.week as fixture_week;
    `;

    const result = await client.query(updateQuery);
    console.log(`\n✅ Fixed ${result.rowCount} specs with wrong week values`);

    if (result.rows.length > 0) {
      console.log('\nSample of fixed specs:');
      result.rows.slice(0, 5).forEach(row => {
        console.log(`  Spec ${row.id.substring(0, 8)}... now has week ${row.new_week}`);
      });
    }

    // Verify the fix
    const after = await client.query(checkQuery);
    console.log('\n' + '='.repeat(50));
    console.log('AFTER FIX - Spec weeks vs Fixture weeks:');
    console.log('==========================================');
    after.rows.forEach(row => {
      console.log(`Spec week ${row.spec_week} -> Fixture week ${row.fixture_week}: ${row.count} specs`);
      if (row.spec_week != row.fixture_week) {
        console.log(`  ❌ STILL MISMATCHED: ${row.count} specs`);
      } else {
        console.log(`  ✅ CORRECT`);
      }
    });

    // Show week distribution after fix
    const weekDistribution = await client.query(`
      SELECT week, COUNT(*) as spec_count
      FROM specs
      WHERE mode = 'live'
      GROUP BY week
      ORDER BY week;
    `);

    console.log('\n' + '='.repeat(50));
    console.log('FINAL WEEK DISTRIBUTION:');
    console.log('========================');
    weekDistribution.rows.forEach(row => {
      console.log(`Week ${row.week}: ${row.spec_count} specs`);
    });

  } catch (error) {
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    await client.end();
    console.log('\nDatabase connection closed');
  }
}

// Run the fix
console.log('🔧 FIX SPEC WEEKS SCRIPT');
console.log('========================\n');
fixSpecWeeks();