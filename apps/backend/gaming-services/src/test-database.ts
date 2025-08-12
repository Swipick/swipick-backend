import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DataSource } from 'typeorm';
import { Fixture } from './entities/fixture.entity';
import { Spec } from './entities/spec.entity';

async function testDatabase() {
  console.log('🧪 Testing database connection and tables...');

  // Create app with disabled synchronization to avoid schema conflicts
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn'], // Reduce log noise
  });

  const dataSource = app.get(DataSource);

  try {
    // Test database connection
    console.log('🔌 Testing database connection...');
    await dataSource.query('SELECT 1');
    console.log('✅ Database connection successful');

    // Check if tables exist
    console.log('� Checking if tables exist...');
    const fixturesCount = await dataSource.query(
      'SELECT COUNT(*) FROM fixtures',
    );
    const specsCount = await dataSource.query('SELECT COUNT(*) FROM specs');

    console.log('✅ Tables exist:', {
      fixtures: fixturesCount[0].count,
      specs: specsCount[0].count,
    });

    // Test fixtures table with repository
    console.log('📊 Testing fixtures repository...');
    const fixtureRepo = dataSource.getRepository(Fixture);

    // Create a test fixture (will use existing tables)
    const testFixture = fixtureRepo.create({
      home_team: 'AC Milan',
      away_team: 'Inter Milan',
      match_date: new Date('2025-08-15 20:45:00'),
      stadium: 'San Siro',
      week: 1,
      status: 'SCHEDULED',
      external_api_id: 'test_001',
    });

    const savedFixture = await fixtureRepo.save(testFixture);
    console.log('✅ Fixture created:', savedFixture.getMatchDisplay());

    // Test specs table with repository
    console.log('📈 Testing specs repository...');
    const specRepo = dataSource.getRepository(Spec);

    // Create a test spec
    const testSpec = specRepo.create({
      user_id: '12345678-1234-5678-9012-123456789012', // Mock user ID
      fixture_id: savedFixture.id,
      choice: '1', // Home win prediction
      week: 1,
    });

    const savedSpec = await specRepo.save(testSpec);
    console.log('✅ Spec created:', savedSpec.getChoiceDisplay());

    // Test relationship query
    console.log('🔗 Testing relationships...');
    const fixtureWithSpecs = await fixtureRepo.findOne({
      where: { id: savedFixture.id },
      relations: ['specs'],
    });

    console.log('✅ Fixture with specs:', {
      match: fixtureWithSpecs?.getMatchDisplay(),
      specsCount: fixtureWithSpecs?.specs?.length || 0,
    });

    // Test calculation methods
    console.log('🧮 Testing calculation methods...');

    // Simulate match completion
    savedFixture.home_score = 2;
    savedFixture.away_score = 1;
    savedFixture.result = savedFixture.calculateResult();
    savedFixture.status = 'FINISHED';

    await fixtureRepo.save(savedFixture);

    // Update spec correctness
    savedSpec.result = savedFixture.result;
    savedSpec.updateCorrectness();

    await specRepo.save(savedSpec);

    console.log('✅ Match completed:', {
      result: savedFixture.getResultDisplay(),
      prediction: savedSpec.getChoiceDisplay(),
      correct: savedSpec.isCorrect(),
    });

    // Query statistics
    console.log('📊 Testing statistics queries...');

    const userSpecs = await specRepo.find({
      where: { user_id: testSpec.user_id, week: 1 },
    });

    const correctPredictions = userSpecs.filter(
      (spec) => spec.isCorrect() === true,
    );
    const totalPredictions = userSpecs.filter((spec) =>
      spec.countsTowardPercentage(),
    );

    const successRate =
      totalPredictions.length > 0
        ? (correctPredictions.length / totalPredictions.length) * 100
        : 0;

    console.log('✅ Statistics calculated:', {
      totalPredictions: totalPredictions.length,
      correctPredictions: correctPredictions.length,
      successRate: `${successRate.toFixed(2)}%`,
    });

    console.log('🎉 All database tests passed!');

    // Clean up test data
    await specRepo.delete(savedSpec.id);
    await fixtureRepo.delete(savedFixture.id);
    console.log('🧹 Test data cleaned up');
  } catch (error) {
    console.error('❌ Database test failed:', error);
    throw error;
  } finally {
    await app.close();
  }
}

// Run the test
testDatabase().catch(console.error);
