import { NestFactory } from '@nestjs/core';
import { AppModule } from './src/app.module';
import { DataSource } from 'typeorm';
import { Fixture } from './src/entities/fixture.entity';
import { ApiFootballService } from './src/modules/api-football/api-football.service';

async function populateFixtures2025(): Promise<void> {
  console.log('🚀 Starting 2025 Serie A fixtures population from API-Football...');

  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  const dataSource = app.get(DataSource);
  const apiFootballService = app.get(ApiFootballService);

  try {
    console.log('🔌 Testing database connection...');
    await dataSource.query('SELECT 1');
    console.log('✅ Database connection successful');

    const fixtureRepo = dataSource.getRepository(Fixture);

    // Check existing fixtures
    const existingCount = await fixtureRepo.count();
    console.log(`📊 Existing fixtures in database: ${existingCount}`);

    if (existingCount > 0) {
      console.log('⚠️  Warning: Database already contains fixtures');
      console.log('🗑️  Clearing existing fixtures and dependent records...');

      // Delete specs first (foreign key dependent)
      await dataSource.query(
        'DELETE FROM specs WHERE fixture_id IN (SELECT id FROM fixtures)',
      );

      // Then delete fixtures
      await dataSource.query('DELETE FROM fixtures');

      console.log('✅ Existing fixtures and dependent records cleared');
    }

    // Fetch all 2025 Serie A fixtures from API-Football
    console.log('🔗 Fetching 2025 Serie A fixtures from API-Football...');

    // Use the service method to get all fixtures for league 135, season 2025
    const apiFixtures = await apiFootballService.getFixtures({
      league: 135,
      season: 2025,
    });

    console.log(`📥 Retrieved ${apiFixtures.length} fixtures from API-Football`);

    if (apiFixtures.length === 0) {
      throw new Error('No fixtures returned from API-Football for Serie A 2025');
    }

    // Transform API data to database format and insert
    console.log('💾 Processing and inserting fixtures...');
    const savedFixtures = [];

    for (const apiFixture of apiFixtures) {
      // Extract week number from round (e.g., "Regular Season - 1" -> 1)
      const weekMatch = apiFixture.league.round.match(/(\d+)$/);
      const week = weekMatch ? parseInt(weekMatch[1], 10) : 1;

      // Determine result based on goals
      let result: '1' | 'X' | '2' | null = null;
      if (apiFixture.status.short === 'FT' && apiFixture.goals.home !== null && apiFixture.goals.away !== null) {
        if (apiFixture.goals.home > apiFixture.goals.away) {
          result = '1';
        } else if (apiFixture.goals.home < apiFixture.goals.away) {
          result = '2';
        } else {
          result = 'X';
        }
      }

      // Map API status to our status
      let status: 'SCHEDULED' | 'FINISHED' | 'LIVE' = 'SCHEDULED';
      if (apiFixture.status.short === 'FT') {
        status = 'FINISHED';
      } else if (['1H', '2H', 'HT', 'ET', 'BT', 'P'].includes(apiFixture.status.short)) {
        status = 'LIVE';
      }

      const fixture = fixtureRepo.create({
        home_team: apiFixture.teams.home.name,
        away_team: apiFixture.teams.away.name,
        match_date: new Date(apiFixture.date),
        stadium: apiFixture.venue.name || 'TBD',
        week: week,
        result: result,
        home_score: apiFixture.goals.home,
        away_score: apiFixture.goals.away,
        status: status,
        external_api_id: `api_football_${apiFixture.id}`,
        created_at: new Date(),
        updated_at: new Date(),
      });

      const saved = await fixtureRepo.save(fixture);
      savedFixtures.push(saved);

      // Log progress every 50 fixtures
      if (savedFixtures.length % 50 === 0) {
        console.log(`📈 Processed ${savedFixtures.length}/${apiFixtures.length} fixtures...`);
      }
    }

    console.log(
      `🎉 Population complete! Inserted ${savedFixtures.length} fixtures from API-Football Pro`,
    );

    // Show summary by status
    const statusCounts = await dataSource
      .createQueryBuilder()
      .select('status, COUNT(*) as count')
      .from('fixtures', 'f')
      .groupBy('status')
      .getRawMany();

    console.log('\n📊 Summary by status:', statusCounts);

    // Show summary by week (first 10 weeks)
    const weekCounts = await dataSource
      .createQueryBuilder()
      .select('week, COUNT(*) as count')
      .from('fixtures', 'f')
      .where('week <= 10')
      .groupBy('week')
      .orderBy('week', 'ASC')
      .getRawMany();

    console.log('\n📊 Summary by week (first 10):', weekCounts);

    // Show examples from different weeks
    const examples = await fixtureRepo.find({
      take: 6,
      order: { week: 'ASC', match_date: 'ASC' },
    });

    console.log('\n📝 Example fixtures:');
    examples.forEach((f) => {
      const score = f.home_score !== null ? `${f.home_score}-${f.away_score}` : 'TBD';
      const date = f.match_date.toISOString().split('T')[0];
      console.log(
        `Week ${f.week}: ${f.home_team} vs ${f.away_team} (${score}) - ${f.status} on ${date}`,
      );
    });

    console.log('\n🏆 2025 Serie A fixtures successfully populated from API-Football Pro!');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await app.close();
  }
}

populateFixtures2025().catch(console.error);