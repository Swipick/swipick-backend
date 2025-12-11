import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './src/app.module';
import { DataSource } from 'typeorm';
import { Fixture } from './src/entities/fixture.entity';
import { ApiFootballService } from './src/modules/api-football/api-football.service';

async function repopulateFromWeek13(): Promise<void> {
  console.log('🚀 Repopulating Serie A fixtures from week 13 onwards...');

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
    console.log(`📊 Total fixtures in database: ${existingCount}`);

    // Count fixtures from week 13 onwards
    const week13PlusCount = await fixtureRepo
      .createQueryBuilder('fixture')
      .where('fixture.week >= :week', { week: 13 })
      .getCount();

    console.log(`📊 Fixtures from week 13 onwards: ${week13PlusCount}`);

    if (week13PlusCount > 0) {
      console.log('🗑️  Deleting fixtures from week 13 onwards...');

      // Delete specs first (foreign key dependent)
      await dataSource.query(
        'DELETE FROM specs WHERE fixture_id IN (SELECT id FROM fixtures WHERE week >= 13)',
      );

      // Then delete fixtures
      await dataSource.query('DELETE FROM fixtures WHERE week >= 13');

      console.log('✅ Existing fixtures from week 13+ cleared');
    }

    // Fetch all 2025 Serie A fixtures from API-Football
    console.log('🔗 Fetching 2025-26 Serie A fixtures from API-Football...');

    const apiFixtures = await apiFootballService.getFixtures({
      league: 135,
      season: 2025,
    });

    console.log(`📥 Retrieved ${apiFixtures.length} total fixtures from API-Football`);

    if (apiFixtures.length === 0) {
      throw new Error('No fixtures returned from API-Football for Serie A 2025');
    }

    // Filter for week 13 onwards
    const week13PlusFixtures = apiFixtures.filter((fixture) => {
      const weekMatch = fixture.league.round.match(/(\d+)$/);
      const week = weekMatch ? parseInt(weekMatch[1], 10) : 1;
      return week >= 13;
    });

    console.log(`📥 Filtered to ${week13PlusFixtures.length} fixtures from week 13 onwards`);

    // Transform API data to database format and insert
    console.log('💾 Processing and inserting fixtures from week 13+...');
    const savedFixtures = [];

    for (const apiFixture of week13PlusFixtures) {
      // Extract week number from round (e.g., "Regular Season - 13" -> 13)
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

      // Log progress every 20 fixtures
      if (savedFixtures.length % 20 === 0) {
        console.log(`📈 Processed ${savedFixtures.length}/${week13PlusFixtures.length} fixtures...`);
      }
    }

    console.log(
      `🎉 Repopulation complete! Inserted ${savedFixtures.length} fixtures from week 13 onwards`,
    );

    // Show summary by week for weeks 13+
    const weekCounts = await dataSource
      .createQueryBuilder()
      .select('week, COUNT(*) as count')
      .from('fixtures', 'f')
      .where('week >= 13')
      .groupBy('week')
      .orderBy('week', 'ASC')
      .getRawMany();

    console.log('\n📊 Summary by week (13+):', weekCounts);

    // Show some example fixtures from week 13-14
    const examples = await fixtureRepo.find({
      where: [{ week: 13 }, { week: 14 }],
      take: 10,
      order: { week: 'ASC', match_date: 'ASC' },
    });

    console.log('\n📝 Example fixtures from week 13-14:');
    examples.forEach((f) => {
      const score = f.home_score !== null ? `${f.home_score}-${f.away_score}` : 'TBD';
      const date = f.match_date.toISOString().split('T')[0];
      console.log(
        `Week ${f.week}: ${f.home_team} vs ${f.away_team} (${score}) - ${f.status} on ${date}`,
      );
    });

    // Specifically check for Como fixtures in week 14
    const comoFixtures = await fixtureRepo.find({
      where: [
        { week: 14, home_team: 'Como' },
        { week: 14, away_team: 'Como' },
      ],
    });

    if (comoFixtures.length > 0) {
      console.log('\n✅ Como fixture in week 14:');
      comoFixtures.forEach((f) => {
        const score = f.home_score !== null ? `${f.home_score}-${f.away_score}` : 'TBD';
        const date = f.match_date.toISOString();
        console.log(
          `  ${f.home_team} vs ${f.away_team} (${score}) - ${f.status} on ${date}`,
        );
      });
    }

    console.log('\n🏆 Fixtures from week 13 onwards successfully repopulated!');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await app.close();
  }
}

repopulateFromWeek13().catch(console.error);
