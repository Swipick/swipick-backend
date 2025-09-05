import { NestFactory } from '@nestjs/core';
import { AppModule } from './src/app.module';
import { DataSource } from 'typeorm';
import { Fixture } from './src/entities/fixture.entity';
import * as fs from 'fs';

interface FixtureData {
  week: number;
  home_team: string;
  away_team: string;
  match_date: string;
  stadium: string;
  home_score: number | null;
  away_score: number | null;
  status: 'SCHEDULED' | 'FINISHED';
  result: '1' | 'X' | '2' | null;
  external_api_id: string;
}

// Function to parse CSV and convert to fixtures data
function parseCsvToFixtures(csvPath: string): FixtureData[] {
  const csvContent = fs.readFileSync(csvPath, 'utf8');
  const lines = csvContent.split('\n').filter((line) => line.trim());

  // Skip header
  const dataLines = lines.slice(1);

  const fixtures: FixtureData[] = [];

  // Stadium mapping for Serie A teams
  const STADIUM_MAP: Record<string, string> = {
    'AC Milan': 'San Siro',
    Milan: 'San Siro',
    Inter: 'San Siro',
    Juventus: 'Allianz Stadium',
    Napoli: 'Stadio Diego Armando Maradona',
    'AS Roma': 'Stadio Olimpico',
    Roma: 'Stadio Olimpico',
    Lazio: 'Stadio Olimpico',
    Atalanta: 'Gewiss Stadium',
    Fiorentina: 'Stadio Artemio Franchi',
    Bologna: "Stadio Renato Dall'Ara",
    Torino: 'Stadio Olimpico Grande Torino',
    Udinese: 'Dacia Arena',
    Genoa: 'Stadio Luigi Ferraris',
    Sassuolo: 'Mapei Stadium – Città del Tricolore',
    Empoli: 'Stadio Carlo Castellani',
    Monza: 'U-Power Stadium',
    Verona: "Stadio Marc'Antonio Bentegodi",
    Lecce: 'Stadio Via del Mare',
    Cagliari: 'Unipol Domus',
    Frosinone: 'Stadio Benito Stirpe',
    Salernitana: 'Stadio Arechi',
    Como: 'Stadio Giuseppe Sinigaglia',
    Parma: 'Stadio Ennio Tardini',
    Pisa: 'Arena Garibaldi',
    Cremonese: 'Stadio Giovanni Zini',
  };

  for (const line of dataLines) {
    const parts = line.split(',');
    if (parts.length < 6) continue;

    const [matchday, homeTeam, homeScore, awayScore, awayTeam, date, time] =
      parts;

    // Extract week number from matchday (e.g., "Matchday 1" -> 1)
    const week = parseInt(matchday.replace('Matchday ', ''));

    // Parse scores - handle empty/missing scores
    const parsedHomeScore =
      homeScore && homeScore.trim() !== '' && !isNaN(parseFloat(homeScore))
        ? parseInt(homeScore)
        : null;
    const parsedAwayScore =
      awayScore && awayScore.trim() !== '' && !isNaN(parseFloat(awayScore))
        ? parseInt(awayScore)
        : null;

    // Convert date format: "23 Aug" -> "2024-08-23"
    const [day, month] = date.trim().split(' ');
    const monthMap: Record<string, string> = {
      Jan: '01',
      Feb: '02',
      Mar: '03',
      Apr: '04',
      May: '05',
      Jun: '06',
      Jul: '07',
      Aug: '08',
      Sep: '09',
      Sept: '09',
      Oct: '10',
      Nov: '11',
      Dec: '12',
    };
    const formattedDate = `2024-${monthMap[month]}-${day.padStart(2, '0')}`;

    // Combine date and time
    const matchDateTime = `${formattedDate} ${time.trim()}:00`;

    // Determine status and result
    let status: 'SCHEDULED' | 'FINISHED' = 'SCHEDULED';
    let result: '1' | 'X' | '2' | null = null;

    if (parsedHomeScore !== null && parsedAwayScore !== null) {
      status = 'FINISHED';
      if (parsedHomeScore > parsedAwayScore) {
        result = '1'; // Home win
      } else if (parsedHomeScore < parsedAwayScore) {
        result = '2'; // Away win
      } else {
        result = 'X'; // Draw
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
      external_api_id: `serie_a_2024_${week}_${homeTeam.trim().replace(/\s+/g, '_')}_vs_${awayTeam.trim().replace(/\s+/g, '_')}`,
    });
  }

  return fixtures;
}

async function populateFixtures(): Promise<void> {
  console.log('🚀 Starting fixtures population...');

  // Create NestJS app to get database connection
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn'],
  });

  const dataSource = app.get(DataSource);

  try {
    // Test database connection
    console.log('🔌 Testing database connection...');
    await dataSource.query('SELECT 1');
    console.log('✅ Database connection successful');

    // Parse CSV data
    const csvPath =
      '/Users/ashm4/Downloads/serie_a_fixtures_matchday_1_to_10.csv';
    console.log('📋 Parsing CSV data...');
    const fixtureData = parseCsvToFixtures(csvPath);
    console.log(`✅ Parsed ${fixtureData.length} fixtures`);

    // Get fixture repository
    const fixtureRepo = dataSource.getRepository(Fixture);

    // Check if any fixtures already exist
    const existingCount = await fixtureRepo.count();
    console.log(`📊 Existing fixtures in database: ${existingCount}`);

    if (existingCount > 0) {
      console.log('⚠️  Warning: Database already contains fixtures');
      console.log('🗑️  Clearing existing fixtures...');
      await fixtureRepo.delete({});
      console.log('✅ Existing fixtures cleared');
    }

    // Insert fixtures in batches
    console.log('💾 Inserting fixtures...');
    const batchSize = 10;
    let inserted = 0;

    for (let i = 0; i < fixtureData.length; i += batchSize) {
      const batch = fixtureData.slice(i, i + batchSize);

      const fixtures = batch.map((data) => {
        return fixtureRepo.create({
          home_team: data.home_team,
          away_team: data.away_team,
          match_date: new Date(data.match_date),
          stadium: data.stadium,
          week: data.week,
          result: data.result,
          home_score: data.home_score,
          away_score: data.away_score,
          status: data.status,
          external_api_id: data.external_api_id,
        });
      });

      await fixtureRepo.save(fixtures);
      inserted += fixtures.length;
      console.log(
        `✅ Inserted batch ${Math.ceil((i + 1) / batchSize)}: ${inserted}/${fixtureData.length} fixtures`,
      );
    }

    // Verify insertion
    const finalCount = await fixtureRepo.count();
    console.log(
      `🎉 Population complete! Total fixtures in database: ${finalCount}`,
    );

    // Show summary statistics
    const statusCounts = await dataSource
      .createQueryBuilder()
      .select('status, COUNT(*) as count')
      .from('fixtures', 'f')
      .groupBy('status')
      .getRawMany();

    const weekCounts = await dataSource
      .createQueryBuilder()
      .select('week, COUNT(*) as count')
      .from('fixtures', 'f')
      .groupBy('week')
      .orderBy('week', 'ASC')
      .getRawMany();

    console.log('\n📊 Summary:');
    console.log('By status:', statusCounts);
    console.log('By week:', weekCounts);

    // Show a few example fixtures
    const examples = await fixtureRepo.find({
      take: 3,
      order: { week: 'ASC', match_date: 'ASC' },
    });

    console.log('\n📝 Example fixtures:');
    examples.forEach((f) => {
      console.log(
        `Week ${f.week}: ${f.home_team} vs ${f.away_team} (${f.status}) - ${f.match_date}`,
      );
    });
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await app.close();
  }
}

// Run the population script
populateFixtures().catch(console.error);
