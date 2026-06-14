import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Spec } from '../../entities/spec.entity';
import { Fixture } from '../../entities/fixture.entity';
import { SeasonConfigService } from '../season/season-config.service';
import {
  CreateSpecDto,
  SpecResponseDto,
  WeeklyStatsResponseDto,
  UserSummaryResponseDto,
} from './dto/specs.dto';

@Injectable()
export class SpecsService {
  private readonly logger = new Logger(SpecsService.name);

  constructor(
    @InjectRepository(Spec)
    private specRepository: Repository<Spec>,
    @InjectRepository(Fixture)
    private fixtureRepository: Repository<Fixture>,
    private readonly seasonConfig: SeasonConfigService,
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
      this.logger.debug(
        `🔄 [SPECS_SERVICE] Updating existing prediction for user ${user_id} on fixture ${fixture_id}`,
      );
      existingSpec.choice = choice;
      existingSpec.week = fixture.week; // Update week to match fixture if it was wrong
      existingSpec.season = fixture.season;
      existingSpec.timestamp = new Date();

      const savedSpec = await this.specRepository.save(existingSpec);

      // Return response with match display
      return this.mapSpecToResponse(savedSpec, fixture);
    }

    // Create new prediction for live mode - use week from fixture
    this.logger.debug(
      `📝 [SPECS_SERVICE] Creating new spec with fixture week: ${fixture.week} (not controller week: ${week})`,
    );
    const spec = this.specRepository.create({
      user_id,
      fixture_id,
      choice,
      week: fixture.week, // Use the actual week from the fixture
      season: fixture.season, // Denormalized from the fixture (like week)
      mode: 'live',
    });

    const savedSpec = await this.specRepository.save(spec);
    this.logger.debug(
      `✅ [SPECS_SERVICE] Spec saved with week ${savedSpec.week}`,
    );

    // Return response with match display
    return this.mapSpecToResponse(savedSpec, fixture);
  }

  async getWeeklyStats(
    userId: string,
    week: number,
    mode: 'live' | 'test' = 'live',
    season?: number,
  ): Promise<WeeklyStatsResponseDto> {
    const targetSeason = season ?? this.seasonConfig.getCurrentSeason();
    this.logger.debug('🟢 [SPECS_SERVICE] ='.repeat(50));
    this.logger.debug('🟢 [SPECS_SERVICE] getWeeklyStats called');
    this.logger.debug(
      '🟢 [SPECS_SERVICE] Timestamp:',
      new Date().toISOString(),
    );
    this.logger.debug('🟢 [SPECS_SERVICE] Parameters:');
    this.logger.debug('🟢 [SPECS_SERVICE] - userId:', {
      value: userId,
      type: typeof userId,
      length: userId?.length,
      isString: typeof userId === 'string',
    });
    this.logger.debug('🟢 [SPECS_SERVICE] - week:', {
      value: week,
      type: typeof week,
      isNumber: typeof week === 'number',
    });
    this.logger.debug('🟢 [SPECS_SERVICE] - mode:', {
      value: mode,
      type: typeof mode,
    });

    try {
      this.logger.debug('🟢 [SPECS_SERVICE] Preparing database query...');
      this.logger.debug('🟢 [SPECS_SERVICE] Query params:', {
        where: { user_id: userId, week, mode },
        relations: ['fixture'],
        order: { timestamp: 'ASC' },
      });

      // Get all predictions for the user in the specified week, season and mode
      this.logger.debug('🟢 [SPECS_SERVICE] Executing database query...');
      const specs = await this.specRepository.find({
        where: { user_id: userId, week, season: targetSeason, mode },
        relations: ['fixture'],
        order: { timestamp: 'ASC' },
      });

      this.logger.debug(
        '🟢 [SPECS_SERVICE] Database query completed successfully',
      );
      this.logger.debug('🟢 [SPECS_SERVICE] Found specs count:', specs.length);

      if (specs.length > 0) {
        this.logger.debug('🟢 [SPECS_SERVICE] Sample spec:', {
          id: specs[0].id,
          user_id: specs[0].user_id,
          fixture_id: specs[0].fixture_id,
          choice: specs[0].choice,
          week: specs[0].week,
          fixture_exists: !!specs[0].fixture,
        });
      }

      this.logger.debug('🟢 [SPECS_SERVICE] Mapping specs to responses...');
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

      this.logger.debug('🟢 [SPECS_SERVICE] Result computed successfully:', {
        week: result.week,
        total_predictions: result.total_predictions,
        correct_predictions: result.correct_predictions,
        success_rate: result.success_rate,
        predictions_count: result.predictions.length,
      });
      this.logger.debug('🟢 [SPECS_SERVICE] ='.repeat(50));

      return result;
    } catch (error) {
      this.logger.debug('🔴 [SPECS_SERVICE] ERROR in getWeeklyStats:');
      this.logger.debug('🔴 [SPECS_SERVICE] Error details:', {
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
      this.logger.debug(
        '🔴 [SPECS_SERVICE] Full error object:',
        JSON.stringify(error, Object.getOwnPropertyNames(error), 2),
      );
      this.logger.debug('🔴 [SPECS_SERVICE] Error stack:', error?.stack);
      this.logger.debug('🟢 [SPECS_SERVICE] ='.repeat(50));
      throw error;
    }
  }

  async getUserSummary(
    userId: string,
    mode: 'live' | 'test' = 'live',
    season?: number,
  ): Promise<UserSummaryResponseDto> {
    const targetSeason = season ?? this.seasonConfig.getCurrentSeason();
    // Get all predictions for the user in the specified mode and season
    const allSpecs = await this.specRepository.find({
      where: { user_id: userId, season: targetSeason, mode },
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
    // Use fixture's result as source of truth (dynamically calculated)
    const actualResult = fixture?.result ?? spec.result;

    // Calculate correctness dynamically from fixture result
    let isCorrect: boolean | undefined = undefined;
    if (actualResult && spec.choice !== 'SKIP') {
      isCorrect = spec.choice === actualResult;
    }

    return {
      id: spec.id,
      user_id: spec.user_id,
      fixture_id: spec.fixture_id,
      choice: spec.choice as '1' | 'X' | '2', // Filter out SKIP choices
      result: actualResult as '1' | 'X' | '2' | undefined,
      is_correct: isCorrect,
      week: spec.week,
      timestamp: spec.timestamp,
      match_display: fixture
        ? fixture.getMatchDisplay()
        : `Fixture ${spec.fixture_id}`,
      choice_display: spec.getChoiceDisplay(),
      homeScore: fixture?.home_score ?? null,
      awayScore: fixture?.away_score ?? null,
    };
  }

  /** Delete all live predictions for a user (hard delete) */
  async deleteUserPredictions(
    userId: string,
    mode?: 'live' | 'test',
    week?: number,
  ): Promise<number> {
    this.logger.debug('🗑️ [DELETE_PREDICTIONS] Delete request received');
    this.logger.debug('🗑️ [DELETE_PREDICTIONS] Parameters:', {
      userId,
      mode,
      week,
    });

    const whereConditions: any = { user_id: userId };

    if (mode) {
      whereConditions.mode = mode;
    }

    if (week !== undefined) {
      whereConditions.week = week;
    }

    this.logger.debug(
      '🗑️ [DELETE_PREDICTIONS] Where conditions:',
      whereConditions,
    );

    // Check what exists before delete
    const existingSpecs = await this.specRepository.find({
      where: whereConditions,
    });
    this.logger.debug(
      '🗑️ [DELETE_PREDICTIONS] Found existing specs:',
      existingSpecs.length,
    );
    if (existingSpecs.length > 0) {
      this.logger.debug('🗑️ [DELETE_PREDICTIONS] Sample spec to delete:', {
        id: existingSpecs[0].id,
        user_id: existingSpecs[0].user_id,
        fixture_id: existingSpecs[0].fixture_id,
        choice: existingSpecs[0].choice,
        week: existingSpecs[0].week,
        mode: existingSpecs[0].mode,
      });
    }

    const res = await this.specRepository.delete(whereConditions);
    this.logger.debug('🗑️ [DELETE_PREDICTIONS] Delete result:', {
      affected: res.affected,
      raw: res.raw,
    });
    this.logger.debug('🗑️ [DELETE_PREDICTIONS] Delete operation complete');

    return res.affected || 0;
  }
}
