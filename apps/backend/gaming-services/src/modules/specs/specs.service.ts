import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Spec } from '../../entities/spec.entity';
import { Fixture } from '../../entities/fixture.entity';
import {
  CreateSpecDto,
  SpecResponseDto,
  WeeklyStatsResponseDto,
  UserSummaryResponseDto,
} from './dto/specs.dto';

@Injectable()
export class SpecsService {
  constructor(
    @InjectRepository(Spec)
    private specRepository: Repository<Spec>,
    @InjectRepository(Fixture)
    private fixtureRepository: Repository<Fixture>,
  ) {}

  async createPrediction(
    createSpecDto: CreateSpecDto,
  ): Promise<SpecResponseDto> {
    const { user_id, fixture_id, choice, week } = createSpecDto;

    // Check if fixture exists
    const fixture = await this.fixtureRepository.findOne({
      where: { id: fixture_id },
    });

    if (!fixture) {
      throw new NotFoundException(`Fixture with ID ${fixture_id} not found`);
    }

    // Check if fixture is still open for predictions
    if (fixture.status !== 'SCHEDULED') {
      throw new BadRequestException(
        `Cannot predict on fixture with status: ${fixture.status}`,
      );
    }

    // Check if prediction deadline has passed (match started)
    const now = new Date();
    if (fixture.match_date <= now) {
      throw new BadRequestException(
        'Cannot predict on a fixture that has already started',
      );
    }

    // Check if user already has a prediction for this fixture
    const existingSpec = await this.specRepository.findOne({
      where: { user_id, fixture_id },
    });

    if (existingSpec) {
      throw new ConflictException(
        'User already has a prediction for this fixture',
      );
    }

    // Create the prediction
    const spec = this.specRepository.create({
      user_id,
      fixture_id,
      choice,
      week,
    });

    const savedSpec = await this.specRepository.save(spec);

    // Return response with match display
    return this.mapSpecToResponse(savedSpec, fixture);
  }

  async getWeeklyStats(
    userId: string,
    week: number,
  ): Promise<WeeklyStatsResponseDto> {
    // Get all predictions for the user in the specified week
    const specs = await this.specRepository.find({
      where: { user_id: userId, week },
      relations: ['fixture'],
      order: { timestamp: 'ASC' },
    });

    const predictions = specs.map((spec) =>
      this.mapSpecToResponse(spec, spec.fixture),
    );

    const correctPredictions = specs.filter(
      (spec) => spec.isCorrect() === true,
    );
    const totalPredictions = specs.filter((spec) =>
      spec.countsTowardPercentage(),
    );

    const successRate =
      totalPredictions.length > 0
        ? (correctPredictions.length / totalPredictions.length) * 100
        : 0;

    return {
      week,
      total_predictions: totalPredictions.length,
      correct_predictions: correctPredictions.length,
      success_rate: Math.round(successRate * 100) / 100, // Round to 2 decimal places
      predictions,
    };
  }

  async getUserSummary(userId: string): Promise<UserSummaryResponseDto> {
    // Get all predictions for the user
    const allSpecs = await this.specRepository.find({
      where: { user_id: userId },
      relations: ['fixture'],
      order: { week: 'ASC', timestamp: 'ASC' },
    });

    if (allSpecs.length === 0) {
      return {
        user_id: userId,
        total_predictions: 0,
        correct_predictions: 0,
        overall_success_rate: 0,
        weekly_stats: [],
      };
    }

    // Calculate overall stats
    const totalCorrect = allSpecs.filter((spec) => spec.isCorrect() === true);
    const totalCounted = allSpecs.filter((spec) =>
      spec.countsTowardPercentage(),
    );

    const overallSuccessRate =
      totalCounted.length > 0
        ? (totalCorrect.length / totalCounted.length) * 100
        : 0;

    // Group by week for weekly stats
    const weekGroups = allSpecs.reduce(
      (groups, spec) => {
        const week = spec.week;
        if (!groups[week]) {
          groups[week] = [];
        }
        groups[week].push(spec);
        return groups;
      },
      {} as Record<number, Spec[]>,
    );

    const weeklyStats = Object.entries(weekGroups).map(([weekStr, specs]) => {
      const week = parseInt(weekStr, 10);
      const predictions = specs.map((spec) =>
        this.mapSpecToResponse(spec, spec.fixture),
      );

      const correctPredictions = specs.filter(
        (spec) => spec.isCorrect() === true,
      );
      const totalPredictions = specs.filter((spec) =>
        spec.countsTowardPercentage(),
      );

      const successRate =
        totalPredictions.length > 0
          ? (correctPredictions.length / totalPredictions.length) * 100
          : 0;

      return {
        week,
        total_predictions: totalPredictions.length,
        correct_predictions: correctPredictions.length,
        success_rate: Math.round(successRate * 100) / 100,
        predictions,
      };
    });

    return {
      user_id: userId,
      total_predictions: totalCounted.length,
      correct_predictions: totalCorrect.length,
      overall_success_rate: Math.round(overallSuccessRate * 100) / 100,
      weekly_stats: weeklyStats,
    };
  }

  private mapSpecToResponse(spec: Spec, fixture: Fixture): SpecResponseDto {
    return {
      id: spec.id,
      user_id: spec.user_id,
      fixture_id: spec.fixture_id,
      choice: spec.choice as '1' | 'X' | '2', // Filter out SKIP choices
      result: spec.result as '1' | 'X' | '2' | undefined,
      is_correct: spec.isCorrect(),
      week: spec.week,
      timestamp: spec.timestamp,
      match_display: fixture.getMatchDisplay(),
      choice_display: spec.getChoiceDisplay(),
    };
  }

  /** Delete all live predictions for a user (hard delete) */
  async deleteUserPredictions(userId: string): Promise<number> {
    const res = await this.specRepository.delete({ user_id: userId });
    return res.affected || 0;
  }
}
