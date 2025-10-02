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

    // Check if user already has a prediction for this fixture in live mode
    const existingSpec = await this.specRepository.findOne({
      where: { user_id, fixture_id, mode: 'live' },
    });

    if (existingSpec) {
      // Allow updating the prediction if match hasn't started yet
      console.log(`🔄 [SPECS_SERVICE] Updating existing prediction for user ${user_id} on fixture ${fixture_id}`);
      existingSpec.choice = choice;
      existingSpec.timestamp = new Date();

      const savedSpec = await this.specRepository.save(existingSpec);

      // Return response with match display
      return this.mapSpecToResponse(savedSpec, fixture);
    }

    // Create new prediction for live mode
    const spec = this.specRepository.create({
      user_id,
      fixture_id,
      choice,
      week,
      mode: 'live',
    });

    const savedSpec = await this.specRepository.save(spec);

    // Return response with match display
    return this.mapSpecToResponse(savedSpec, fixture);
  }

  async getWeeklyStats(
    userId: string,
    week: number,
    mode: 'live' | 'test' = 'live',
  ): Promise<WeeklyStatsResponseDto> {
    console.log('🟢 [SPECS_SERVICE] ='.repeat(50));
    console.log('🟢 [SPECS_SERVICE] getWeeklyStats called');
    console.log('🟢 [SPECS_SERVICE] Timestamp:', new Date().toISOString());
    console.log('🟢 [SPECS_SERVICE] Parameters:');
    console.log('🟢 [SPECS_SERVICE] - userId:', {
      value: userId,
      type: typeof userId,
      length: userId?.length,
      isString: typeof userId === 'string',
    });
    console.log('🟢 [SPECS_SERVICE] - week:', {
      value: week,
      type: typeof week,
      isNumber: typeof week === 'number',
    });
    console.log('🟢 [SPECS_SERVICE] - mode:', {
      value: mode,
      type: typeof mode,
    });

    try {
      console.log('🟢 [SPECS_SERVICE] Preparing database query...');
      console.log('🟢 [SPECS_SERVICE] Query params:', {
        where: { user_id: userId, week, mode },
        relations: ['fixture'],
        order: { timestamp: 'ASC' },
      });

      // Get all predictions for the user in the specified week and mode
      console.log('🟢 [SPECS_SERVICE] Executing database query...');
      const specs = await this.specRepository.find({
        where: { user_id: userId, week, mode },
        relations: ['fixture'],
        order: { timestamp: 'ASC' },
      });

      console.log('🟢 [SPECS_SERVICE] Database query completed successfully');
      console.log('🟢 [SPECS_SERVICE] Found specs count:', specs.length);

      if (specs.length > 0) {
        console.log('🟢 [SPECS_SERVICE] Sample spec:', {
          id: specs[0].id,
          user_id: specs[0].user_id,
          fixture_id: specs[0].fixture_id,
          choice: specs[0].choice,
          week: specs[0].week,
          fixture_exists: !!specs[0].fixture,
        });
      }

      console.log('🟢 [SPECS_SERVICE] Mapping specs to responses...');
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

      const result = {
        week,
        total_predictions: totalPredictions.length,
        correct_predictions: correctPredictions.length,
        success_rate: Math.round(successRate * 100) / 100, // Round to 2 decimal places
        predictions,
      };

      console.log('🟢 [SPECS_SERVICE] Result computed successfully:', {
        week: result.week,
        total_predictions: result.total_predictions,
        correct_predictions: result.correct_predictions,
        success_rate: result.success_rate,
        predictions_count: result.predictions.length,
      });
      console.log('🟢 [SPECS_SERVICE] ='.repeat(50));

      return result;
    } catch (error) {
      console.log('🔴 [SPECS_SERVICE] ERROR in getWeeklyStats:');
      console.log('🔴 [SPECS_SERVICE] Error details:', {
        userId,
        week,
        errorType: typeof error,
        errorConstructor: error?.constructor?.name,
        errorMessage: error?.message,
        errorCode: error?.code,
        errorSeverity: error?.severity,
        errorDetail: error?.detail,
        errorConstraint: error?.constraint,
        errorTable: error?.table,
        errorColumn: error?.column,
      });
      console.log(
        '🔴 [SPECS_SERVICE] Full error object:',
        JSON.stringify(error, Object.getOwnPropertyNames(error), 2),
      );
      console.log('🔴 [SPECS_SERVICE] Error stack:', error?.stack);
      console.log('🟢 [SPECS_SERVICE] ='.repeat(50));
      throw error;
    }
  }

  async getUserSummary(
    userId: string,
    mode: 'live' | 'test' = 'live',
  ): Promise<UserSummaryResponseDto> {
    // Get all predictions for the user in the specified mode
    const allSpecs = await this.specRepository.find({
      where: { user_id: userId, mode },
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

  private mapSpecToResponse(
    spec: Spec,
    fixture: Fixture | null,
  ): SpecResponseDto {
    return {
      id: spec.id,
      user_id: spec.user_id,
      fixture_id: spec.fixture_id,
      choice: spec.choice as '1' | 'X' | '2', // Filter out SKIP choices
      result: spec.result as '1' | 'X' | '2' | undefined,
      is_correct: spec.isCorrect(),
      week: spec.week,
      timestamp: spec.timestamp,
      match_display: fixture
        ? fixture.getMatchDisplay()
        : `Fixture ${spec.fixture_id}`,
      choice_display: spec.getChoiceDisplay(),
    };
  }

  /** Delete all live predictions for a user (hard delete) */
  async deleteUserPredictions(userId: string, mode?: 'live' | 'test', week?: number): Promise<number> {
    const whereConditions: any = { user_id: userId };

    if (mode) {
      whereConditions.mode = mode;
    }

    if (week !== undefined) {
      whereConditions.week = week;
    }

    const res = await this.specRepository.delete(whereConditions);
    return res.affected || 0;
  }
}
