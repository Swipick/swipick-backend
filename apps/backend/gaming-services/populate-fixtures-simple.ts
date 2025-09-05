import { NestFactory } from '@nestjs/core';
import { AppModule } from './src/app.module';
import { DataSource } from 'typeorm';
import { Fixture } from './src/entities/fixture.entity';

async function populateFixtures(): Promise<void> {
  console.log('🚀 Starting fixtures population...');

  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn'],
  });

  const dataSource = app.get(DataSource);

  try {
    console.log('🔌 Testing database connection...');
    await dataSource.query('SELECT 1');
    console.log('✅ Database connection successful');

    // Raw fixture data from CSV
    const fixtures = [
      {
        week: 1,
        home_team: 'Genoa',
        away_team: 'Lecce',
        match_date: '2024-08-23 18:30:00',
        stadium: 'Stadio Luigi Ferraris',
        home_score: 0,
        away_score: 0,
        status: 'FINISHED',
        result: 'X',
      },
      {
        week: 1,
        home_team: 'Sassuolo',
        away_team: 'Napoli',
        match_date: '2024-08-23 18:30:00',
        stadium: 'Mapei Stadium',
        home_score: 0,
        away_score: 2,
        status: 'FINISHED',
        result: '2',
      },
      {
        week: 1,
        home_team: 'Roma',
        away_team: 'Bologna',
        match_date: '2024-08-23 20:45:00',
        stadium: 'Stadio Olimpico',
        home_score: 1,
        away_score: 0,
        status: 'FINISHED',
        result: '1',
      },
      {
        week: 1,
        home_team: 'Milan',
        away_team: 'Cremonese',
        match_date: '2024-08-23 20:45:00',
        stadium: 'San Siro',
        home_score: 1,
        away_score: 2,
        status: 'FINISHED',
        result: '2',
      },
      {
        week: 1,
        home_team: 'Cagliari',
        away_team: 'Fiorentina',
        match_date: '2024-08-24 18:30:00',
        stadium: 'Unipol Domus',
        home_score: 1,
        away_score: 1,
        status: 'FINISHED',
        result: 'X',
      },
      {
        week: 1,
        home_team: 'Como',
        away_team: 'Lazio',
        match_date: '2024-08-24 18:30:00',
        stadium: 'Stadio Giuseppe Sinigaglia',
        home_score: 2,
        away_score: 0,
        status: 'FINISHED',
        result: '1',
      },
      {
        week: 1,
        home_team: 'Juventus',
        away_team: 'Parma',
        match_date: '2024-08-24 20:45:00',
        stadium: 'Allianz Stadium',
        home_score: 2,
        away_score: 0,
        status: 'FINISHED',
        result: '1',
      },
      {
        week: 1,
        home_team: 'Atalanta',
        away_team: 'Pisa',
        match_date: '2024-08-24 20:45:00',
        stadium: 'Gewiss Stadium',
        home_score: 1,
        away_score: 1,
        status: 'FINISHED',
        result: 'X',
      },
      {
        week: 1,
        home_team: 'Udinese',
        away_team: 'Verona',
        match_date: '2024-08-25 18:30:00',
        stadium: 'Dacia Arena',
        home_score: 1,
        away_score: 1,
        status: 'FINISHED',
        result: 'X',
      },
      {
        week: 1,
        home_team: 'Inter',
        away_team: 'Torino',
        match_date: '2024-08-25 20:45:00',
        stadium: 'San Siro',
        home_score: 5,
        away_score: 0,
        status: 'FINISHED',
        result: '1',
      },

      {
        week: 2,
        home_team: 'Cremonese',
        away_team: 'Sassuolo',
        match_date: '2024-08-29 18:30:00',
        stadium: 'Stadio Giovanni Zini',
        home_score: 3,
        away_score: 2,
        status: 'FINISHED',
        result: '1',
      },
      {
        week: 2,
        home_team: 'Lecce',
        away_team: 'Milan',
        match_date: '2024-08-29 20:45:00',
        stadium: 'Stadio Via del Mare',
        home_score: 0,
        away_score: 2,
        status: 'FINISHED',
        result: '2',
      },
      {
        week: 2,
        home_team: 'Bologna',
        away_team: 'Como',
        match_date: '2024-08-30 18:30:00',
        stadium: "Stadio Renato Dall'Ara",
        home_score: 1,
        away_score: 0,
        status: 'FINISHED',
        result: '1',
      },
      {
        week: 2,
        home_team: 'Parma',
        away_team: 'Atalanta',
        match_date: '2024-08-30 18:30:00',
        stadium: 'Stadio Ennio Tardini',
        home_score: 1,
        away_score: 1,
        status: 'FINISHED',
        result: 'X',
      },
      {
        week: 2,
        home_team: 'Napoli',
        away_team: 'Cagliari',
        match_date: '2024-08-30 20:45:00',
        stadium: 'Stadio Diego Armando Maradona',
        home_score: 1,
        away_score: 0,
        status: 'FINISHED',
        result: '1',
      },
      {
        week: 2,
        home_team: 'Pisa',
        away_team: 'Roma',
        match_date: '2024-08-30 20:45:00',
        stadium: 'Arena Garibaldi',
        home_score: 0,
        away_score: 1,
        status: 'FINISHED',
        result: '2',
      },
      {
        week: 2,
        home_team: 'Torino',
        away_team: 'Fiorentina',
        match_date: '2024-08-31 18:30:00',
        stadium: 'Stadio Olimpico Grande Torino',
        home_score: 0,
        away_score: 0,
        status: 'FINISHED',
        result: 'X',
      },
      {
        week: 2,
        home_team: 'Genoa',
        away_team: 'Juventus',
        match_date: '2024-08-31 18:30:00',
        stadium: 'Stadio Luigi Ferraris',
        home_score: 0,
        away_score: 1,
        status: 'FINISHED',
        result: '2',
      },
      {
        week: 2,
        home_team: 'Inter',
        away_team: 'Udinese',
        match_date: '2024-08-31 20:45:00',
        stadium: 'San Siro',
        home_score: 1,
        away_score: 2,
        status: 'FINISHED',
        result: '2',
      },
      {
        week: 2,
        home_team: 'Lazio',
        away_team: 'Verona',
        match_date: '2024-08-31 20:45:00',
        stadium: 'Stadio Olimpico',
        home_score: 4,
        away_score: 0,
        status: 'FINISHED',
        result: '1',
      },

      // Upcoming fixtures (weeks 3-10) - SCHEDULED status, no scores/results
      {
        week: 3,
        home_team: 'Cagliari',
        away_team: 'Parma',
        match_date: '2024-09-13 15:00:00',
        stadium: 'Unipol Domus',
        home_score: null,
        away_score: null,
        status: 'SCHEDULED',
        result: null,
      },
      {
        week: 3,
        home_team: 'Juventus',
        away_team: 'Inter',
        match_date: '2024-09-13 18:00:00',
        stadium: 'Allianz Stadium',
        home_score: null,
        away_score: null,
        status: 'SCHEDULED',
        result: null,
      },
      {
        week: 3,
        home_team: 'Fiorentina',
        away_team: 'Napoli',
        match_date: '2024-09-13 20:45:00',
        stadium: 'Stadio Artemio Franchi',
        home_score: null,
        away_score: null,
        status: 'SCHEDULED',
        result: null,
      },
      {
        week: 3,
        home_team: 'Roma',
        away_team: 'Torino',
        match_date: '2024-09-14 12:30:00',
        stadium: 'Stadio Olimpico',
        home_score: null,
        away_score: null,
        status: 'SCHEDULED',
        result: null,
      },
      {
        week: 3,
        home_team: 'Atalanta',
        away_team: 'Lecce',
        match_date: '2024-09-14 15:00:00',
        stadium: 'Gewiss Stadium',
        home_score: null,
        away_score: null,
        status: 'SCHEDULED',
        result: null,
      },
      {
        week: 3,
        home_team: 'Pisa',
        away_team: 'Udinese',
        match_date: '2024-09-14 15:00:00',
        stadium: 'Arena Garibaldi',
        home_score: null,
        away_score: null,
        status: 'SCHEDULED',
        result: null,
      },
      {
        week: 3,
        home_team: 'Sassuolo',
        away_team: 'Lazio',
        match_date: '2024-09-14 18:00:00',
        stadium: 'Mapei Stadium',
        home_score: null,
        away_score: null,
        status: 'SCHEDULED',
        result: null,
      },
      {
        week: 3,
        home_team: 'Milan',
        away_team: 'Bologna',
        match_date: '2024-09-14 20:45:00',
        stadium: 'San Siro',
        home_score: null,
        away_score: null,
        status: 'SCHEDULED',
        result: null,
      },
      {
        week: 3,
        home_team: 'Verona',
        away_team: 'Cremonese',
        match_date: '2024-09-15 18:30:00',
        stadium: "Stadio Marc'Antonio Bentegodi",
        home_score: null,
        away_score: null,
        status: 'SCHEDULED',
        result: null,
      },
      {
        week: 3,
        home_team: 'Como',
        away_team: 'Genoa',
        match_date: '2024-09-15 20:45:00',
        stadium: 'Stadio Giuseppe Sinigaglia',
        home_score: null,
        away_score: null,
        status: 'SCHEDULED',
        result: null,
      },

      {
        week: 4,
        home_team: 'Lecce',
        away_team: 'Cagliari',
        match_date: '2024-09-19 20:45:00',
        stadium: 'Stadio Via del Mare',
        home_score: null,
        away_score: null,
        status: 'SCHEDULED',
        result: null,
      },
      {
        week: 4,
        home_team: 'Bologna',
        away_team: 'Genoa',
        match_date: '2024-09-20 15:00:00',
        stadium: "Stadio Renato Dall'Ara",
        home_score: null,
        away_score: null,
        status: 'SCHEDULED',
        result: null,
      },
      {
        week: 4,
        home_team: 'Verona',
        away_team: 'Juventus',
        match_date: '2024-09-20 18:00:00',
        stadium: "Stadio Marc'Antonio Bentegodi",
        home_score: null,
        away_score: null,
        status: 'SCHEDULED',
        result: null,
      },
      {
        week: 4,
        home_team: 'Udinese',
        away_team: 'Milan',
        match_date: '2024-09-20 20:45:00',
        stadium: 'Dacia Arena',
        home_score: null,
        away_score: null,
        status: 'SCHEDULED',
        result: null,
      },
      {
        week: 4,
        home_team: 'Lazio',
        away_team: 'Roma',
        match_date: '2024-09-21 12:30:00',
        stadium: 'Stadio Olimpico',
        home_score: null,
        away_score: null,
        status: 'SCHEDULED',
        result: null,
      },
      {
        week: 4,
        home_team: 'Torino',
        away_team: 'Atalanta',
        match_date: '2024-09-21 15:00:00',
        stadium: 'Stadio Olimpico Grande Torino',
        home_score: null,
        away_score: null,
        status: 'SCHEDULED',
        result: null,
      },
      {
        week: 4,
        home_team: 'Cremonese',
        away_team: 'Parma',
        match_date: '2024-09-21 15:00:00',
        stadium: 'Stadio Giovanni Zini',
        home_score: null,
        away_score: null,
        status: 'SCHEDULED',
        result: null,
      },
      {
        week: 4,
        home_team: 'Fiorentina',
        away_team: 'Como',
        match_date: '2024-09-21 18:00:00',
        stadium: 'Stadio Artemio Franchi',
        home_score: null,
        away_score: null,
        status: 'SCHEDULED',
        result: null,
      },
      {
        week: 4,
        home_team: 'Inter',
        away_team: 'Sassuolo',
        match_date: '2024-09-21 20:45:00',
        stadium: 'San Siro',
        home_score: null,
        away_score: null,
        status: 'SCHEDULED',
        result: null,
      },
      {
        week: 4,
        home_team: 'Napoli',
        away_team: 'Pisa',
        match_date: '2024-09-22 20:45:00',
        stadium: 'Stadio Diego Armando Maradona',
        home_score: null,
        away_score: null,
        status: 'SCHEDULED',
        result: null,
      },
    ];

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

    // Insert fixtures
    console.log('💾 Inserting fixtures...');
    const savedFixtures = [];

    for (const fixtureData of fixtures) {
      const fixture = fixtureRepo.create({
        home_team: fixtureData.home_team,
        away_team: fixtureData.away_team,
        match_date: new Date(fixtureData.match_date),
        stadium: fixtureData.stadium,
        week: fixtureData.week,
        result: fixtureData.result as '1' | 'X' | '2' | null,
        home_score: fixtureData.home_score,
        away_score: fixtureData.away_score,
        status: fixtureData.status as 'SCHEDULED' | 'FINISHED',
        external_api_id: `serie_a_2024_${fixtureData.week}_${fixtureData.home_team.replace(/\s+/g, '_')}_vs_${fixtureData.away_team.replace(/\s+/g, '_')}`,
      });

      const saved = await fixtureRepo.save(fixture);
      savedFixtures.push(saved);
    }

    console.log(
      `🎉 Population complete! Inserted ${savedFixtures.length} fixtures`,
    );

    // Show summary
    const statusCounts = await dataSource
      .createQueryBuilder()
      .select('status, COUNT(*) as count')
      .from('fixtures', 'f')
      .groupBy('status')
      .getRawMany();

    console.log('\n📊 Summary by status:', statusCounts);

    // Show examples
    const examples = await fixtureRepo.find({
      take: 3,
      order: { week: 'ASC', match_date: 'ASC' },
    });

    console.log('\n📝 Example fixtures:');
    examples.forEach((f) => {
      const score =
        f.home_score !== null ? `${f.home_score}-${f.away_score}` : 'TBD';
      console.log(
        `Week ${f.week}: ${f.home_team} vs ${f.away_team} (${score}) - ${f.status}`,
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

populateFixtures().catch(console.error);
