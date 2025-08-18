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

  async seedTestData(forceReplace = false): Promise<void> {
    this.logger.log('Starting test data seeding...');

    // Check if data already exists
    const existingFixtures = await this.testFixtureRepository.count();
    if (existingFixtures > 0) {
      if (forceReplace) {
        this.logger.warn(
          `Test data already exists (${existingFixtures} fixtures). Force replace enabled — clearing and reseeding.`,
        );
        await this.testFixtureRepository.clear();
      } else {
        this.logger.warn(
          `Test data already exists (${existingFixtures} fixtures). Skipping seed.`,
        );
        return;
      }
    }

    // The historical Serie A fixtures for test mode (Weeks 1–4) based on provided CSV
    const testFixtures = [
      // Week 1 (19–21 Aug 2023)
      {
        week: 1,
        date: '2023-08-19 20:45:00',
        homeTeam: 'Genoa',
        stadium: 'Stadio Luigi Ferraris',
        awayTeam: 'Fiorentina',
        homeScore: 1,
        awayScore: 4,
      },
      {
        week: 1,
        date: '2023-08-19 20:45:00',
        homeTeam: 'Inter',
        stadium: 'San Siro (Giuseppe Meazza)',
        awayTeam: 'Monza',
        homeScore: 2,
        awayScore: 0,
      },
      {
        week: 1,
        date: '2023-08-19 18:30:00',
        homeTeam: 'Empoli',
        stadium: 'Stadio Carlo Castellani – Computer Gross Arena',
        awayTeam: 'Verona',
        homeScore: 0,
        awayScore: 1,
      },
      {
        week: 1,
        date: '2023-08-19 18:30:00',
        homeTeam: 'Frosinone',
        stadium: 'Stadio Benito Stirpe',
        awayTeam: 'Napoli',
        homeScore: 1,
        awayScore: 3,
      },
      {
        week: 1,
        date: '2023-08-20 20:45:00',
        homeTeam: 'Lecce',
        stadium: 'Stadio Via del Mare',
        awayTeam: 'Lazio',
        homeScore: 2,
        awayScore: 1,
      },
      {
        week: 1,
        date: '2023-08-20 20:45:00',
        homeTeam: 'Udinese',
        stadium: 'Stadio Friuli',
        awayTeam: 'Juventus',
        homeScore: 0,
        awayScore: 3,
      },
      {
        week: 1,
        date: '2023-08-20 18:30:00',
        homeTeam: 'AS Roma',
        stadium: 'Stadio Olimpico (Rome)',
        awayTeam: 'Salernitana',
        homeScore: 2,
        awayScore: 2,
      },
      {
        week: 1,
        date: '2023-08-20 18:30:00',
        homeTeam: 'Sassuolo',
        stadium: 'Mapei Stadium – Città del Tricolore',
        awayTeam: 'Atalanta',
        homeScore: 0,
        awayScore: 2,
      },
      {
        week: 1,
        date: '2023-08-21 20:45:00',
        homeTeam: 'Bologna',
        stadium: "Stadio Renato Dall'Ara",
        awayTeam: 'AC Milan',
        homeScore: 0,
        awayScore: 2,
      },
      {
        week: 1,
        date: '2023-08-21 18:30:00',
        homeTeam: 'Torino',
        stadium: 'Stadio Olimpico Grande Torino',
        awayTeam: 'Cagliari',
        homeScore: 0,
        awayScore: 0,
      },

      // Week 2 (26–28 Aug 2023)
      {
        week: 2,
        date: '2023-08-26 18:30:00',
        homeTeam: 'Frosinone',
        stadium: 'Stadio Benito Stirpe',
        awayTeam: 'Atalanta',
        homeScore: 2,
        awayScore: 1,
      },
      {
        week: 2,
        date: '2023-08-26 20:45:00',
        homeTeam: 'Verona',
        stadium: 'Stadio Marcantonio Bentegodi',
        awayTeam: 'AS Roma',
        homeScore: 2,
        awayScore: 1,
      },
      {
        week: 2,
        date: '2023-08-26 20:45:00',
        homeTeam: 'AC Milan',
        stadium: 'San Siro (Giuseppe Meazza)',
        awayTeam: 'Torino',
        homeScore: 4,
        awayScore: 1,
      },
      {
        week: 2,
        date: '2023-08-26 18:30:00',
        homeTeam: 'Monza',
        stadium: 'Stadio Brianteo',
        awayTeam: 'Empoli',
        homeScore: 2,
        awayScore: 0,
      },
      {
        week: 2,
        date: '2023-08-27 18:30:00',
        homeTeam: 'Fiorentina',
        stadium: 'Stadio Artemio Franchi',
        awayTeam: 'Lecce',
        homeScore: 2,
        awayScore: 2,
      },
      {
        week: 2,
        date: '2023-08-27 18:30:00',
        homeTeam: 'Juventus',
        stadium: 'Allianz Stadium (Juventus Stadium)',
        awayTeam: 'Bologna',
        homeScore: 1,
        awayScore: 1,
      },
      {
        week: 2,
        date: '2023-08-27 20:45:00',
        homeTeam: 'Lazio',
        stadium: 'Stadio Olimpico (Rome)',
        awayTeam: 'Genoa',
        homeScore: 0,
        awayScore: 1,
      },
      {
        week: 2,
        date: '2023-08-27 20:45:00',
        homeTeam: 'Napoli',
        stadium: 'Stadio Diego Armando Maradona',
        awayTeam: 'Sassuolo',
        homeScore: 2,
        awayScore: 0,
      },
      {
        week: 2,
        date: '2023-08-28 18:30:00',
        homeTeam: 'Salernitana',
        stadium: 'Stadio Arechi',
        awayTeam: 'Udinese',
        homeScore: 1,
        awayScore: 1,
      },
      {
        week: 2,
        date: '2023-08-28 20:45:00',
        homeTeam: 'Cagliari',
        stadium: 'Unipol Domus',
        awayTeam: 'Inter',
        homeScore: 0,
        awayScore: 2,
      },

      // Week 3 (1–3 Sep 2023)
      {
        week: 3,
        date: '2023-09-01 18:30:00',
        homeTeam: 'Sassuolo',
        stadium: 'Mapei Stadium – Città del Tricolore',
        awayTeam: 'Verona',
        homeScore: 3,
        awayScore: 1,
      },
      {
        week: 3,
        date: '2023-09-01 20:45:00',
        homeTeam: 'AS Roma',
        stadium: 'Stadio Olimpico (Rome)',
        awayTeam: 'AC Milan',
        homeScore: 1,
        awayScore: 2,
      },
      {
        week: 3,
        date: '2023-09-02 18:30:00',
        homeTeam: 'Udinese',
        stadium: 'Stadio Friuli',
        awayTeam: 'Frosinone',
        homeScore: 0,
        awayScore: 0,
      },
      {
        week: 3,
        date: '2023-09-02 20:45:00',
        homeTeam: 'Napoli',
        stadium: 'Stadio Diego Armando Maradona',
        awayTeam: 'Lazio',
        homeScore: 1,
        awayScore: 2,
      },
      {
        week: 3,
        date: '2023-09-02 18:30:00',
        homeTeam: 'Bologna',
        stadium: "Stadio Renato Dall'Ara",
        awayTeam: 'Cagliari',
        homeScore: 2,
        awayScore: 1,
      },
      {
        week: 3,
        date: '2023-09-02 20:45:00',
        homeTeam: 'Atalanta',
        stadium: 'Gewiss Stadium',
        awayTeam: 'Monza',
        homeScore: 3,
        awayScore: 0,
      },
      {
        week: 3,
        date: '2023-09-03 18:30:00',
        homeTeam: 'Torino',
        stadium: 'Stadio Olimpico Grande Torino',
        awayTeam: 'Genoa',
        homeScore: 1,
        awayScore: 0,
      },
      {
        week: 3,
        date: '2023-09-03 18:30:00',
        homeTeam: 'Inter',
        stadium: 'San Siro (Giuseppe Meazza)',
        awayTeam: 'Fiorentina',
        homeScore: 4,
        awayScore: 0,
      },
      {
        week: 3,
        date: '2023-09-03 20:45:00',
        homeTeam: 'Lecce',
        stadium: 'Stadio Via del Mare',
        awayTeam: 'Salernitana',
        homeScore: 2,
        awayScore: 0,
      },
      {
        week: 3,
        date: '2023-09-03 20:45:00',
        homeTeam: 'Empoli',
        stadium: 'Stadio Carlo Castellani – Computer Gross Arena',
        awayTeam: 'Juventus',
        homeScore: 0,
        awayScore: 2,
      },

      // Week 4 (16–18 Sep 2023)
      {
        week: 4,
        date: '2023-09-16 18:00:00',
        homeTeam: 'Inter',
        stadium: 'San Siro (Giuseppe Meazza)',
        awayTeam: 'AC Milan',
        homeScore: 5,
        awayScore: 1,
      },
      {
        week: 4,
        date: '2023-09-16 20:45:00',
        homeTeam: 'Genoa',
        stadium: 'Stadio Luigi Ferraris',
        awayTeam: 'Napoli',
        homeScore: 2,
        awayScore: 2,
      },
      {
        week: 4,
        date: '2023-09-16 15:00:00',
        homeTeam: 'Juventus',
        stadium: 'Allianz Stadium (Juventus Stadium)',
        awayTeam: 'Lazio',
        homeScore: 3,
        awayScore: 1,
      },
      {
        week: 4,
        date: '2023-09-17 20:45:00',
        homeTeam: 'AS Roma',
        stadium: 'Stadio Olimpico (Rome)',
        awayTeam: 'Empoli',
        homeScore: 7,
        awayScore: 0,
      },
      {
        week: 4,
        date: '2023-09-17 18:00:00',
        homeTeam: 'Fiorentina',
        stadium: 'Stadio Artemio Franchi',
        awayTeam: 'Atalanta',
        homeScore: 3,
        awayScore: 2,
      },
      {
        week: 4,
        date: '2023-09-17 15:00:00',
        homeTeam: 'Frosinone',
        stadium: 'Stadio Benito Stirpe',
        awayTeam: 'Sassuolo',
        homeScore: 4,
        awayScore: 2,
      },
      {
        week: 4,
        date: '2023-09-17 15:00:00',
        homeTeam: 'Monza',
        stadium: 'Stadio Brianteo',
        awayTeam: 'Lecce',
        homeScore: 1,
        awayScore: 1,
      },
      {
        week: 4,
        date: '2023-09-17 12:30:00',
        homeTeam: 'Cagliari',
        stadium: 'Unipol Domus',
        awayTeam: 'Udinese',
        homeScore: 0,
        awayScore: 0,
      },
      {
        week: 4,
        date: '2023-09-18 20:45:00',
        homeTeam: 'Verona',
        stadium: 'Stadio Marcantonio Bentegodi',
        awayTeam: 'Bologna',
        homeScore: 0,
        awayScore: 0,
      },
      {
        week: 4,
        date: '2023-09-18 18:30:00',
        homeTeam: 'Salernitana',
        stadium: 'Stadio Arechi',
        awayTeam: 'Torino',
        homeScore: 0,
        awayScore: 3,
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
        stadium:
          fixtureData.stadium ||
          STADIUM_BY_TEAM[String(fixtureData.homeTeam)] ||
          null,
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
