import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TestFixture } from '../../entities/test-fixture.entity';
import { TestSpec } from '../../entities/test-spec.entity';
import { WeeklyStats, UserSummary } from './dto/test-mode.dto';

// Re-export for external use
export { WeeklyStats, UserSummary } from './dto/test-mode.dto';

@Injectable()
export class TestModeService {
  private readonly logger = new Logger(TestModeService.name);

  constructor(
    @InjectRepository(TestFixture)
    private testFixtureRepository: Repository<TestFixture>,
    @InjectRepository(TestSpec)
    private testSpecRepository: Repository<TestSpec>,
  ) {}

  async createTestPrediction(
    userId: number,
    fixtureId: number,
    choice: '1' | 'X' | '2' | 'SKIP',
  ): Promise<TestSpec> {
    // Check if fixture exists
    const fixture = await this.testFixtureRepository.findOne({
      where: { id: fixtureId },
    });

    if (!fixture) {
      throw new NotFoundException(
        `Test fixture with ID ${fixtureId} not found`,
      );
    }

    // Check for duplicate prediction
    const existingSpec = await this.testSpecRepository.findOne({
      where: { userId, fixtureId },
    });

    if (existingSpec) {
      this.logger.warn(
        `Duplicate test prediction attempt (idempotent success): user ${userId}, fixture ${fixtureId}`,
      );
      return existingSpec; // Idempotent behavior
    }

    // Create new test prediction
    const isSkip = choice === 'SKIP';
    const testSpec = this.testSpecRepository.create({
      userId,
      fixtureId,
      week: fixture.week,
      choice,
      isCorrect: false,
      countsTowardPercentage: !isSkip,
    });

    if (!isSkip && fixture.isCompleted()) {
      const actualResult = fixture.calculateResult();
      testSpec.isCorrect = choice === actualResult;
    }

    const savedSpec = await this.testSpecRepository.save(testSpec);

    this.logger.log(
      `Test prediction created: User ${userId}, Fixture ${fixtureId}, Choice: ${choice}`,
    );

    return savedSpec;
  }

  async getTestWeeklyStats(userId: number, week: number): Promise<WeeklyStats> {
    const specs = await this.testSpecRepository.find({
      where: { userId, week },
      relations: ['fixture'],
    });

    if (specs.length === 0) {
      throw new NotFoundException(
        `No test predictions found for user ${userId} in week ${week}`,
      );
    }

    const nonSkipSpecs = specs.filter((s) => s.choice !== 'SKIP');
    const totalPredictions = nonSkipSpecs.length;
    const correctPredictions = nonSkipSpecs.filter(
      (spec) => spec.isCorrect,
    ).length;
    const skippedCount = specs.length - nonSkipSpecs.length;
    const totalTurns = specs.length; // predictions + skips
    const weeklyPercentage =
      totalPredictions > 0
        ? Math.round((correctPredictions / totalPredictions) * 100)
        : 0;

    const predictions = specs.map((spec) => ({
      fixtureId: spec.fixtureId,
      homeTeam: spec.fixture.homeTeam,
      awayTeam: spec.fixture.awayTeam,
      userChoice: spec.choice,
      actualResult: spec.fixture.calculateResult() || 'TBD',
      isCorrect: spec.isCorrect,
      homeScore: spec.fixture.homeScore,
      awayScore: spec.fixture.awayScore,
    }));

    this.logger.log(
      `Test weekly stats calculated: User ${userId}, Week ${week}, ${correctPredictions}/${totalPredictions} (${weeklyPercentage}%)`,
    );

    return {
      week,
      totalPredictions,
      correctPredictions,
      weeklyPercentage,
      totalTurns,
      skippedCount,
      predictions,
    };
  }

  async getTestUserSummary(userId: number): Promise<UserSummary> {
    const specs = await this.testSpecRepository.find({
      where: { userId },
      relations: ['fixture'],
    });

    if (specs.length === 0) {
      throw new NotFoundException(
        `No test predictions found for user ${userId}`,
      );
    }

    const nonSkipSpecs = specs.filter((s) => s.choice !== 'SKIP');
    const totalPredictions = nonSkipSpecs.length;
    const totalCorrect = nonSkipSpecs.filter((spec) => spec.isCorrect).length;
    const skippedCount = specs.length - nonSkipSpecs.length;
    const totalTurns = specs.length;
    const overallPercentage =
      totalPredictions > 0
        ? Math.round((totalCorrect / totalPredictions) * 100)
        : 0;

    // Group by week for breakdown
    const weeklyGroups = specs.reduce(
      (groups, spec) => {
        const week = spec.week;
        if (!groups[week]) {
          groups[week] = [];
        }
        groups[week].push(spec);
        return groups;
      },
      {} as { [week: number]: TestSpec[] },
    );

    const weeklyBreakdown = Object.entries(weeklyGroups).map(
      ([week, weekSpecs]) => {
        const nonSkipWeek = weekSpecs.filter((s) => s.choice !== 'SKIP');
        const totalCount = nonSkipWeek.length;
        const correctCount = nonSkipWeek.filter(
          (spec) => spec.isCorrect,
        ).length;
        const skipped = weekSpecs.length - nonSkipWeek.length;
        const totalTurnsWeek = weekSpecs.length;
        const percentage =
          totalCount > 0 ? Math.round((correctCount / totalCount) * 100) : 0;
        return {
          week: parseInt(week),
          percentage,
          correctCount,
          totalCount,
          totalTurns: totalTurnsWeek,
          skippedCount: skipped,
        };
      },
    );

    // Find best and worst weeks
    const bestWeek = weeklyBreakdown.reduce((best, current) =>
      current.percentage > best.percentage ? current : best,
    );

    const worstWeek = weeklyBreakdown.reduce((worst, current) =>
      current.percentage < worst.percentage ? current : worst,
    );

    this.logger.log(
      `Test user summary calculated: User ${userId}, ${totalCorrect}/${totalPredictions} (${overallPercentage}%), ${Object.keys(weeklyGroups).length} weeks`,
    );

    return {
      userId,
      totalWeeks: Object.keys(weeklyGroups).length,
      totalPredictions,
      totalCorrect,
      overallPercentage,
      totalTurns,
      skippedCount,
      weeklyBreakdown,
      bestWeek: {
        week: bestWeek.week,
        percentage: bestWeek.percentage,
      },
      worstWeek: {
        week: worstWeek.week,
        percentage: worstWeek.percentage,
      },
    };
  }

  async getTestFixturesByWeek(week: number): Promise<TestFixture[]> {
    const fixtures = await this.testFixtureRepository.find({
      where: { week },
      order: { date: 'ASC' },
    });

    this.logger.log(
      `Retrieved ${fixtures.length} test fixtures for week ${week}`,
    );
    return fixtures;
  }

  async getAllTestWeeks(): Promise<number[]> {
    const result = await this.testFixtureRepository
      .createQueryBuilder('fixture')
      .select('DISTINCT fixture.week', 'week')
      .orderBy('fixture.week', 'ASC')
      .getRawMany();

    const weeks = result.map((row) => row.week);
    this.logger.log(`Retrieved test weeks: ${weeks.join(', ')}`);
    return weeks;
  }

  async seedTestData(): Promise<void> {
    this.logger.log('Starting test data seeding...');

    // Check if data already exists
    const existingFixtures = await this.testFixtureRepository.count();
    if (existingFixtures > 0) {
      this.logger.warn(
        `Test data already exists (${existingFixtures} fixtures). Skipping seed.`,
      );
      return;
    }

    // The historical Serie A fixtures for test mode (sample data)
    const testFixtures = [
      // Giornata 1 (August 19-20, 2023)
      {
        week: 1,
        date: '2023-08-19 18:30:00',
        homeTeam: 'AC Milan',
        awayTeam: 'Bologna',
        homeScore: 2,
        awayScore: 0,
      },
      {
        week: 1,
        date: '2023-08-19 18:30:00',
        homeTeam: 'Inter',
        awayTeam: 'Monza',
        homeScore: 1,
        awayScore: 1,
      },
      {
        week: 1,
        date: '2023-08-19 20:45:00',
        homeTeam: 'Torino',
        awayTeam: 'Cagliari',
        homeScore: 1,
        awayScore: 1,
      },
      {
        week: 1,
        date: '2023-08-20 18:30:00',
        homeTeam: 'Juventus',
        awayTeam: 'Udinese',
        homeScore: 3,
        awayScore: 0,
      },
      {
        week: 1,
        date: '2023-08-20 20:45:00',
        homeTeam: 'Napoli',
        awayTeam: 'Frosinone',
        homeScore: 1,
        awayScore: 2,
      },
      {
        week: 1,
        date: '2023-08-21 18:30:00',
        homeTeam: 'Lazio',
        awayTeam: 'Lecce',
        homeScore: 2,
        awayScore: 1,
      },
      {
        week: 1,
        date: '2023-08-21 20:45:00',
        homeTeam: 'Roma',
        awayTeam: 'Salernitana',
        homeScore: 2,
        awayScore: 1,
      },

      // Giornata 2 (August 26-27, 2023)
      {
        week: 2,
        date: '2023-08-26 18:30:00',
        homeTeam: 'Bologna',
        awayTeam: 'Napoli',
        homeScore: 0,
        awayScore: 2,
      },
      {
        week: 2,
        date: '2023-08-26 20:45:00',
        homeTeam: 'Udinese',
        awayTeam: 'Juventus',
        homeScore: 0,
        awayScore: 1,
      },
      {
        week: 2,
        date: '2023-08-27 18:30:00',
        homeTeam: 'Monza',
        awayTeam: 'Roma',
        homeScore: 0,
        awayScore: 1,
      },
      {
        week: 2,
        date: '2023-08-27 20:45:00',
        homeTeam: 'Salernitana',
        awayTeam: 'AC Milan',
        homeScore: 1,
        awayScore: 4,
      },
      {
        week: 2,
        date: '2023-08-28 18:30:00',
        homeTeam: 'Frosinone',
        awayTeam: 'Inter',
        homeScore: 0,
        awayScore: 1,
      },

      // Giornata 3 (September 2-3, 2023)
      {
        week: 3,
        date: '2023-09-02 18:30:00',
        homeTeam: 'Juventus',
        awayTeam: 'Lazio',
        homeScore: 3,
        awayScore: 1,
      },
      {
        week: 3,
        date: '2023-09-02 20:45:00',
        homeTeam: 'Napoli',
        awayTeam: 'AC Milan',
        homeScore: 2,
        awayScore: 1,
      },
      {
        week: 3,
        date: '2023-09-03 18:30:00',
        homeTeam: 'Inter',
        awayTeam: 'Fiorentina',
        homeScore: 4,
        awayScore: 0,
      },
      {
        week: 3,
        date: '2023-09-03 20:45:00',
        homeTeam: 'Roma',
        awayTeam: 'Empoli',
        homeScore: 7,
        awayScore: 0,
      },

      // Add a few more weeks for testing...
      {
        week: 4,
        date: '2023-09-16 15:00:00',
        homeTeam: 'AC Milan',
        awayTeam: 'Hellas Verona',
        homeScore: 1,
        awayScore: 0,
      },
      {
        week: 4,
        date: '2023-09-16 18:00:00',
        homeTeam: 'Fiorentina',
        awayTeam: 'Atalanta',
        homeScore: 3,
        awayScore: 2,
      },
      {
        week: 4,
        date: '2023-09-16 20:45:00',
        homeTeam: 'Lazio',
        awayTeam: 'Torino',
        homeScore: 2,
        awayScore: 0,
      },

      {
        week: 5,
        date: '2023-09-23 15:00:00',
        homeTeam: 'Juventus',
        awayTeam: 'Lecce',
        homeScore: 1,
        awayScore: 0,
      },
      {
        week: 5,
        date: '2023-09-23 18:00:00',
        homeTeam: 'Inter',
        awayTeam: 'AC Milan',
        homeScore: 5,
        awayScore: 1,
      },
      {
        week: 5,
        date: '2023-09-23 20:45:00',
        homeTeam: 'Roma',
        awayTeam: 'Udinese',
        homeScore: 3,
        awayScore: 0,
      },
    ];

    // Map stadiums by home team for quick backfill
    const STADIUM_BY_TEAM: Record<string, string> = {
      'AC Milan': 'Giuseppe Meazza (San Siro)',
      Inter: 'Giuseppe Meazza (San Siro)',
      Torino: 'Stadio Olimpico Grande Torino',
      Juventus: 'Allianz Stadium',
      Napoli: 'Stadio Diego Armando Maradona',
      Lazio: 'Stadio Olimpico',
      Roma: 'Stadio Olimpico',
      Bologna: "Stadio Renato Dall'Ara",
      Udinese: 'Dacia Arena (Stadio Friuli)',
      Monza: 'U-Power Stadium',
      Salernitana: 'Stadio Arechi',
      Cagliari: 'Unipol Domus',
      Frosinone: 'Stadio Benito Stirpe',
      Fiorentina: 'Stadio Artemio Franchi',
      Empoli: 'Stadio Carlo Castellani – Computer Gross Arena',
      'Hellas Verona': "Stadio Marc'Antonio Bentegodi",
      Atalanta: 'Gewiss Stadium',
      Lecce: 'Stadio Via del Mare',
      TorinoFC: 'Stadio Olimpico Grande Torino',
    };

    for (const fixtureData of testFixtures) {
      const fixture = this.testFixtureRepository.create({
        ...fixtureData,
        date: new Date(fixtureData.date),
        stadium: STADIUM_BY_TEAM[String(fixtureData.homeTeam)] || null,
        status: 'FT',
        result: this.calculateResultFromScores(
          fixtureData.homeScore,
          fixtureData.awayScore,
        ),
      });

      await this.testFixtureRepository.save(fixture);
    }

    this.logger.log(
      `✅ Test data seeded successfully: ${testFixtures.length} fixtures`,
    );
  }

  async resetUserTestData(userId: number): Promise<void> {
    this.logger.log(`Resetting test data for user ${userId}...`);

    // Delete all test predictions for this user
    const deleteResult = await this.testSpecRepository.delete({ userId });

    this.logger.log(
      `✅ Test data reset completed for user ${userId}: ${deleteResult.affected || 0} predictions deleted`,
    );
  }

  private calculateResultFromScores(
    homeScore: number,
    awayScore: number,
  ): string {
    if (homeScore > awayScore) {
      return '1'; // Home win
    } else if (homeScore < awayScore) {
      return '2'; // Away win
    } else {
      return 'X'; // Draw
    }
  }
}
