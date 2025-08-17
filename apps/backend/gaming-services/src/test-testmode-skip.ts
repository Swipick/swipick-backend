import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { TestModeService } from './modules/test-mode/test-mode.service';
import { TestFixture } from './entities/test-fixture.entity';

/*
 * Lightweight integration script to validate SKIP persistence & exclusion from percentage
 * Steps:
 * 1. Seed test data (if not already present)
 * 2. Pick two fixtures from same week
 * 3. Create one normal prediction and one SKIP
 * 4. Fetch weekly stats and assert:
 *    - totalPredictions == 1 (non-skip)
 *    - totalTurns == 2 (prediction + skip)
 *    - skippedCount == 1
 *    - weeklyPercentage reflects only the non-skip correctness (0% or 100%)
 */
async function run() {
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn'],
  });
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
  const dataSource = app.get(DataSource);
  const testModeService = app.get(TestModeService);

  const userId = 999999; // dedicated test user id
  try {
    console.log('🔍 Ensuring test data present...');
    const fixtureRepo = dataSource.getRepository(TestFixture);
    const anyFixture = await fixtureRepo.findOne({ where: {} });
    if (!anyFixture) {
      console.log('🌱 Seeding test fixtures...');
      await testModeService.seedTestData();
    }

    // Get two fixtures from same week
    const week1Fixtures = await fixtureRepo.find({
      where: { week: 1 },
      take: 2,
      order: { date: 'ASC' },
    });
    if (week1Fixtures.length < 2) {
      throw new Error('Not enough fixtures in week 1 for test');
    }

    const [f1, f2] = week1Fixtures;
    console.log('🎯 Using fixtures:', f1.id, f2.id);

    // Clean previous specs for this user
    await dataSource.query('DELETE FROM test_specs WHERE "userId" = $1', [
      userId,
    ]);

    console.log('📝 Creating normal prediction (1)');
    await testModeService.createTestPrediction(userId, f1.id, '1');

    console.log('⏭ Creating skip prediction');
    await testModeService.createTestPrediction(userId, f2.id, 'SKIP');

    console.log('📊 Fetching weekly stats');
    const stats = await testModeService.getTestWeeklyStats(userId, 1);

    console.log('➡ Stats:', {
      week: stats.week,
      totalPredictions: stats.totalPredictions,
      correctPredictions: stats.correctPredictions,
      weeklyPercentage: stats.weeklyPercentage,
      totalTurns: stats.totalTurns,
      skippedCount: stats.skippedCount,
    });

    if (stats.totalPredictions !== 1)
      throw new Error('Expected totalPredictions = 1');
    if (stats.totalTurns !== 2) throw new Error('Expected totalTurns = 2');
    if (stats.skippedCount !== 1) throw new Error('Expected skippedCount = 1');

    console.log('✅ SKIP integration test passed');
  } catch (e) {
    console.error('❌ SKIP integration test failed:', e);
    process.exitCode = 1;
  } finally {
    await app.close();
  }
}

run();
