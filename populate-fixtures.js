const fs = require("fs");
const path = require("path");

// Function to parse CSV and convert to fixtures data
function parseCsvToFixtures(csvPath) {
  const csvContent = fs.readFileSync(csvPath, "utf8");
  const lines = csvContent.split("\n").filter((line) => line.trim());

  // Skip header
  const dataLines = lines.slice(1);

  const fixtures = [];

  // Stadium mapping for Serie A teams
  const STADIUM_MAP = {
    "AC Milan": "San Siro",
    Milan: "San Siro",
    Inter: "San Siro",
    Juventus: "Allianz Stadium",
    Napoli: "Stadio Diego Armando Maradona",
    "AS Roma": "Stadio Olimpico",
    Roma: "Stadio Olimpico",
    Lazio: "Stadio Olimpico",
    Atalanta: "Gewiss Stadium",
    Fiorentina: "Stadio Artemio Franchi",
    Bologna: "Stadio Renato Dall'Ara",
    Torino: "Stadio Olimpico Grande Torino",
    Udinese: "Dacia Arena",
    Genoa: "Stadio Luigi Ferraris",
    Sassuolo: "Mapei Stadium – Città del Tricolore",
    Empoli: "Stadio Carlo Castellani",
    Monza: "U-Power Stadium",
    Verona: "Stadio Marc'Antonio Bentegodi",
    Lecce: "Stadio Via del Mare",
    Cagliari: "Unipol Domus",
    Frosinone: "Stadio Benito Stirpe",
    Salernitana: "Stadio Arechi",
    Como: "Stadio Giuseppe Sinigaglia",
    Parma: "Stadio Ennio Tardini",
    Pisa: "Arena Garibaldi",
    Cremonese: "Stadio Giovanni Zini",
  };

  for (const line of dataLines) {
    const parts = line.split(",");
    if (parts.length < 6) continue;

    const [matchday, homeTeam, homeScore, awayScore, awayTeam, date, time] =
      parts;

    // Extract week number from matchday (e.g., "Matchday 1" -> 1)
    const week = parseInt(matchday.replace("Matchday ", ""));

    // Parse scores - handle empty/missing scores
    const parsedHomeScore =
      homeScore && homeScore.trim() !== "" && !isNaN(parseFloat(homeScore))
        ? parseInt(homeScore)
        : null;
    const parsedAwayScore =
      awayScore && awayScore.trim() !== "" && !isNaN(parseFloat(awayScore))
        ? parseInt(awayScore)
        : null;

    // Convert date format: "23 Aug" -> "2024-08-23"
    // Note: Assuming 2024 season, adjust year if needed
    const [day, month] = date.trim().split(" ");
    const monthMap = {
      Jan: "01",
      Feb: "02",
      Mar: "03",
      Apr: "04",
      May: "05",
      Jun: "06",
      Jul: "07",
      Aug: "08",
      Sep: "09",
      Sept: "09",
      Oct: "10",
      Nov: "11",
      Dec: "12",
    };
    const formattedDate = `2024-${monthMap[month]}-${day.padStart(2, "0")}`;

    // Combine date and time
    const matchDateTime = `${formattedDate} ${time.trim()}:00`;

    // Determine status and result
    let status = "SCHEDULED";
    let result = null;

    if (parsedHomeScore !== null && parsedAwayScore !== null) {
      status = "FINISHED";
      if (parsedHomeScore > parsedAwayScore) {
        result = "1"; // Home win
      } else if (parsedHomeScore < parsedAwayScore) {
        result = "2"; // Away win
      } else {
        result = "X"; // Draw
      }
    }

    // Get stadium (default to home team's stadium)
    const stadium =
      STADIUM_MAP[homeTeam.trim()] || `${homeTeam.trim()} Stadium`;

    fixtures.push({
      week,
      home_team: homeTeam.trim(),
      away_team: awayTeam.trim(),
      match_date: matchDateTime,
      stadium,
      home_score: parsedHomeScore,
      away_score: parsedAwayScore,
      status,
      result,
      external_api_id: `serie_a_2024_${week}_${homeTeam.trim().replace(/\s+/g, "_")}_vs_${awayTeam.trim().replace(/\s+/g, "_")}`,
    });
  }

  return fixtures;
}

// Generate SQL INSERT statements
function generateSql(fixtures) {
  const insertStatements = [];

  // First, clear existing fixtures (optional - comment out if you want to keep existing data)
  insertStatements.push("-- Clear existing fixtures (optional)");
  insertStatements.push("-- DELETE FROM fixtures;");
  insertStatements.push("");

  for (const fixture of fixtures) {
    const values = [
      `'${fixture.home_team.replace(/'/g, "''")}'`, // Escape single quotes
      `'${fixture.away_team.replace(/'/g, "''")}'`,
      `'${fixture.match_date}'`,
      `'${fixture.stadium.replace(/'/g, "''")}'`,
      fixture.week,
      fixture.result ? `'${fixture.result}'` : "NULL",
      fixture.home_score || "NULL",
      fixture.away_score || "NULL",
      `'${fixture.status}'`,
      `'${fixture.external_api_id.replace(/'/g, "''")}'`,
      "NOW()", // created_at
      "NOW()", // updated_at
    ];

    const sql = `INSERT INTO fixtures (home_team, away_team, match_date, stadium, week, result, home_score, away_score, status, external_api_id, created_at, updated_at) VALUES (${values.join(", ")});`;
    insertStatements.push(sql);
  }

  return insertStatements.join("\n");
}

// Main execution
function main() {
  const csvPath =
    "/Users/ashm4/Downloads/serie_a_fixtures_matchday_1_to_10.csv";

  try {
    console.log("🔄 Parsing CSV file...");
    const fixtures = parseCsvToFixtures(csvPath);
    console.log(`✅ Parsed ${fixtures.length} fixtures`);

    console.log("🔄 Generating SQL...");
    const sql = generateSql(fixtures);

    // Write SQL to file
    const outputPath = path.join(__dirname, "populate-fixtures.sql");
    fs.writeFileSync(outputPath, sql);
    console.log(`✅ SQL written to: ${outputPath}`);

    // Also output a summary
    console.log("\n📊 Summary:");
    console.log(`Total fixtures: ${fixtures.length}`);

    const weekCounts = {};
    const statusCounts = {};

    fixtures.forEach((f) => {
      weekCounts[f.week] = (weekCounts[f.week] || 0) + 1;
      statusCounts[f.status] = (statusCounts[f.status] || 0) + 1;
    });

    console.log("By week:", weekCounts);
    console.log("By status:", statusCounts);

    // Show first few fixtures as example
    console.log("\n📝 Example fixtures:");
    fixtures.slice(0, 3).forEach((f) => {
      console.log(
        `Week ${f.week}: ${f.home_team} vs ${f.away_team} (${f.status})`
      );
    });
  } catch (error) {
    console.error("❌ Error:", error.message);
    process.exit(1);
  }
}

// Run the script
main();
