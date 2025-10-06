import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { DataSource } from 'typeorm';
import axios from 'axios';
import { ConfigService } from '@nestjs/config';

interface ApiFixtureResponse {
  fixture: {
    id: number;
    referee: string;
    timezone: string;
    date: string;
    timestamp: number;
    venue: {
      id: number;
      name: string;
      city: string;
    };
    status: {
      long: string;
      short: string;
      elapsed: number;
    };
  };
  league: {
    id: number;
    name: string;
    country: string;
    round: string;
  };
  teams: {
    home: {
      id: number;
      name: string;
      logo: string;
      winner: boolean | null;
    };
    away: {
      id: number;
      name: string;
      logo: string;
      winner: boolean | null;
    };
  };
  goals: {
    home: number | null;
    away: number | null;
  };
}

async function refreshWeek7Fixtures() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const dataSource = app.get(DataSource);
  const configService = app.get(ConfigService);

  const apiFootballConfig = configService.get('apiFootball');
  const apiKey = apiFootballConfig?.apiKey || process.env.API_FOOTBALL_KEY;
  const apiHost =
    apiFootballConfig?.baseUrl || 'https://v3.football.api-sports.io';

  console.log(
    '🔑 API Key found:',
    apiKey ? `${apiKey.substring(0, 8)}...` : 'NOT FOUND',
  );
  console.log('🌐 API Host:', apiHost);

  if (!apiKey) {
    console.error(
      '❌ API_FOOTBALL_KEY not found in environment variables or config',
    );
    await app.close();
    return;
  }

  try {
    console.log('🔄 Starting Week 7 fixtures refresh...');

    // Step 1: Delete existing week 7 fixtures and related data
    console.log('🗑️  Deleting existing week 7 data...');

    // First, get all week 7 fixture IDs
    const week7Fixtures = await dataSource.query(
      `SELECT id FROM fixtures WHERE week = 7`,
    );

    if (week7Fixtures.length > 0) {
      const fixtureIds = week7Fixtures.map((f: any) => f.id);

      // Delete specs that reference these fixtures
      const specsResult = await dataSource.query(
        `DELETE FROM specs WHERE fixture_id = ANY($1)`,
        [fixtureIds],
      );
      console.log(
        `  - Deleted ${specsResult.rowCount || 0} user predictions (specs)`,
      );

      // Now delete the fixtures
      const fixturesResult = await dataSource.query(
        `DELETE FROM fixtures WHERE week = 7`,
      );
      console.log(
        `  - Deleted ${fixturesResult.rowCount || 0} week 7 fixtures`,
      );
    } else {
      console.log('  - No week 7 fixtures found to delete');
    }

    // Step 2: Fetch week 7 fixtures from API
    console.log('📡 Fetching Round 7 fixtures from API-Football...');

    const baseUrl = apiHost.startsWith('http') ? apiHost : `https://${apiHost}`;
    const url = `${baseUrl}/fixtures?league=135&season=2025&round=${encodeURIComponent('Regular Season - 7')}`;
    console.log('📡 API URL:', url);

    console.log('📡 Sending headers:', {
      'X-RapidAPI-Key': apiKey ? `${apiKey.substring(0, 8)}...` : 'NOT SET',
      'X-RapidAPI-Host': 'v3.football.api-sports.io',
    });

    const response = await axios.get(url, {
      headers: {
        'X-RapidAPI-Key': apiKey,
        'X-RapidAPI-Host': 'v3.football.api-sports.io',
      },
    });

    console.log('📡 API Response status:', response.status);
    console.log('📡 API Response data keys:', Object.keys(response.data));
    if (response.data.errors && Object.keys(response.data.errors).length > 0) {
      console.error('❌ API Errors:', response.data.errors);
    }

    const fixtures: ApiFixtureResponse[] = response.data.response;
    console.log(`✅ Fetched ${fixtures.length} fixtures from API`);

    // Step 3: Map and insert fixtures
    console.log('💾 Inserting fixtures into database...');

    for (const apiFixture of fixtures) {
      const { fixture, teams, goals } = apiFixture;

      // Determine match status
      let dbStatus = 'SCHEDULED';
      if (
        fixture.status.short === 'FT' ||
        fixture.status.short === 'AET' ||
        fixture.status.short === 'PEN'
      ) {
        dbStatus = 'FINISHED';
      } else if (
        fixture.status.short === 'LIVE' ||
        fixture.status.short === '1H' ||
        fixture.status.short === 'HT' ||
        fixture.status.short === '2H'
      ) {
        dbStatus = 'LIVE';
      }

      // Calculate result if match is finished
      // DB uses '1' for home win, 'X' for draw, '2' for away win
      let result = null;
      if (
        dbStatus === 'FINISHED' &&
        goals.home !== null &&
        goals.away !== null
      ) {
        if (goals.home > goals.away) {
          result = '1'; // Home win
        } else if (goals.away > goals.home) {
          result = '2'; // Away win
        } else {
          result = 'X'; // Draw
        }
      }

      // Prepare insert data
      const insertData = {
        home_team: teams.home.name,
        away_team: teams.away.name,
        match_date: fixture.date,
        stadium: fixture.venue.name,
        week: 7,
        result: result,
        home_score: goals.home,
        away_score: goals.away,
        status: dbStatus,
        external_api_id: fixture.id.toString(),
        created_at: new Date(),
        updated_at: new Date(),
      };

      // Insert fixture
      await dataSource.query(
        `INSERT INTO fixtures (home_team, away_team, match_date, stadium, week, result, home_score, away_score, status, external_api_id, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
        [
          insertData.home_team,
          insertData.away_team,
          insertData.match_date,
          insertData.stadium,
          insertData.week,
          insertData.result,
          insertData.home_score,
          insertData.away_score,
          insertData.status,
          insertData.external_api_id,
          insertData.created_at,
          insertData.updated_at,
        ],
      );

      // Convert UTC to Italy time for logging
      const utcDate = new Date(fixture.date);
      const italyOffset = 2; // Italy is UTC+2 (CEST - Central European Summer Time in Oct)
      const italyTime = new Date(
        utcDate.getTime() + italyOffset * 60 * 60 * 1000,
      );

      console.log(`✅ Inserted: ${teams.home.name} vs ${teams.away.name}`);
      console.log(
        `   UTC: ${fixture.date} | Italy: ${italyTime.toISOString().replace('Z', '+02:00')}`,
      );
    }

    console.log('🎉 Week 7 fixtures refresh completed successfully!');

    // Show summary
    const countResult = await dataSource.query(
      `SELECT COUNT(*) as count FROM fixtures WHERE week = 7`,
    );
    console.log(
      `📊 Total week 7 fixtures in database: ${countResult[0].count}`,
    );
  } catch (error) {
    console.error('❌ Error refreshing week 7 fixtures:', error);
    if (error.response) {
      console.error('API Response:', error.response.data);
    }
  } finally {
    await app.close();
  }
}

// Run the script
refreshWeek7Fixtures().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
