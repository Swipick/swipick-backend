#!/usr/bin/env node

/**
 * Seed test fixtures from CSV data into new Neon database
 */

const fs = require("fs");
const path = require("path");
const { Client } = require("pg");

// Parse CSV and convert to test fixtures
function parseFixturesCSV(csvPath) {
  const csvContent = fs.readFileSync(csvPath, "utf-8");
  const lines = csvContent.trim().split("\n");
  const fixtures = [];

  // Skip header row
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    const [round, date, time, homeTeam, stadium, awayTeam, resultRaw] =
      line.split(",");

    // Parse result from format like "1–3"
    let homeScore = null;
    let awayScore = null;
    let result = null;

    if (resultRaw) {
      const match = resultRaw.match(/(\d+)[–-](\d+)/);
      if (match) {
        homeScore = parseInt(match[1]);
        awayScore = parseInt(match[2]);

        if (homeScore > awayScore) result = "1";
        else if (homeScore < awayScore) result = "2";
        else result = "X";
      }
    }

    // Convert date/time to proper timestamp
    // Assuming 2023 season for now (adjust as needed)
    const [day, month] = date.split(".");
    const timestamp = new Date(
      `2023-${month.padStart(2, "0")}-${day.padStart(2, "0")} ${time}:00`
    );

    fixtures.push({
      week: parseInt(round),
      date: timestamp,
      stadium: stadium.trim(),
      homeTeam: homeTeam.trim(),
      awayTeam: awayTeam.trim(),
      homeScore,
      awayScore,
      result,
      status: "FT",
    });
  }

  return fixtures;
}

async function seedDatabase() {
  // Use the new Neon connection string from .env
  const client = new Client({
    connectionString:
      "postgresql://neondb_owner:npg_GQF3qTHWjck8@ep-rough-dust-aduv9t88-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require",
  });

  try {
    await client.connect();
    console.log("🔗 Connected to Neon database");

    // Check if test_fixtures already has data
    const countResult = await client.query(
      "SELECT COUNT(*) FROM test_fixtures"
    );
    const existingCount = parseInt(countResult.rows[0].count);

    if (existingCount > 0) {
      console.log(`📊 Database already has ${existingCount} test fixtures`);
      return;
    }

    // Parse CSV data
    const csvPath = path.join(__dirname, "data/fixtures/fixtures.csv");
    const fixtures = parseFixturesCSV(csvPath);

    console.log(`📁 Parsed ${fixtures.length} fixtures from CSV`);

    // Insert fixtures
    for (const fixture of fixtures) {
      await client.query(
        `
        INSERT INTO test_fixtures 
        (week, date, stadium, "homeTeam", "awayTeam", "homeScore", "awayScore", result, status)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `,
        [
          fixture.week,
          fixture.date,
          fixture.stadium,
          fixture.homeTeam,
          fixture.awayTeam,
          fixture.homeScore,
          fixture.awayScore,
          fixture.result,
          fixture.status,
        ]
      );
    }

    console.log("✅ Successfully seeded test fixtures!");

    // Show summary
    const summary = await client.query(`
      SELECT week, COUNT(*) as fixture_count 
      FROM test_fixtures 
      GROUP BY week 
      ORDER BY week
    `);

    console.log("📊 Test fixtures by week:");
    summary.rows.forEach((row) => {
      console.log(`   Week ${row.week}: ${row.fixture_count} fixtures`);
    });
  } catch (error) {
    console.error("❌ Error seeding database:", error);
  } finally {
    await client.end();
  }
}

// Run the seeding
seedDatabase().catch(console.error);
