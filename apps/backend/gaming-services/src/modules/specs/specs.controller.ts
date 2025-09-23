import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  Query,
  UsePipes,
  ValidationPipe,
  ParseIntPipe,
  BadRequestException,
} from '@nestjs/common';
import { SpecsService } from './specs.service';
import { TestModeService } from '../test-mode/test-mode.service';
import {
  CreateSpecDto,
  CreateUnifiedPredictionDto,
  SpecResponseDto,
  WeeklyStatsResponseDto,
  UserSummaryResponseDto,
} from './dto/specs.dto';

@Controller('predictions')
@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
export class SpecsController {
  constructor(
    private readonly specsService: SpecsService,
    private readonly testModeService: TestModeService,
  ) {}

  /**
   * Create a new prediction (unified endpoint for live and test modes)
   * POST /api/predictions
   */
  @Post()
  async createPrediction(
    @Body() data: CreateUnifiedPredictionDto,
  ): Promise<SpecResponseDto> {
    console.log('='.repeat(80));
    console.log(
      '🚀 [SPECS_CONTROLLER] *** UNIFIED PREDICTION ENDPOINT HIT ***',
    );
    console.log('🚀 [SPECS_CONTROLLER] Timestamp:', new Date().toISOString());
    console.log('🚀 [SPECS_CONTROLLER] Full request body received:');
    console.log('🚀 [SPECS_CONTROLLER] Raw object:', data);
    console.log(
      '🚀 [SPECS_CONTROLLER] JSON stringified:',
      JSON.stringify(data, null, 2),
    );
    console.log('🚀 [SPECS_CONTROLLER] Object keys:', Object.keys(data));
    console.log('🚀 [SPECS_CONTROLLER] userId:', {
      value: data.userId,
      type: typeof data.userId,
      length: data.userId?.length,
      isUUID:
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
          data.userId || '',
        ),
      isFirebaseUID: typeof data.userId === 'string' && data.userId.length > 20,
    });
    console.log('🚀 [SPECS_CONTROLLER] fixtureId:', {
      value: data.fixtureId,
      type: typeof data.fixtureId,
      isNumber: typeof data.fixtureId === 'number',
    });
    console.log('🚀 [SPECS_CONTROLLER] choice:', {
      value: data.choice,
      type: typeof data.choice,
    });
    console.log('🚀 [SPECS_CONTROLLER] mode:', {
      value: data.mode,
      type: typeof data.mode,
    });
    console.log('='.repeat(80));

    try {
      console.log(
        '🚀 [SPECS_CONTROLLER] Starting validation and processing...',
      );

      if (data.mode === 'test') {
        // Route to test mode service
        // Convert fixtureId from string to number for test mode
        const fixtureIdNumber = parseInt(data.fixtureId, 10);
        if (isNaN(fixtureIdNumber)) {
          throw new BadRequestException(
            `Invalid fixtureId for test mode: ${data.fixtureId} - must be convertible to number`,
          );
        }

        const testSpec = await this.testModeService.createTestPrediction(
          data.userId,
          fixtureIdNumber,
          data.choice,
        );

        // Convert TestSpec to SpecResponseDto format
        return {
          id: testSpec.id.toString(),
          user_id: testSpec.userId,
          fixture_id: testSpec.fixtureId.toString(),
          choice: testSpec.choice as '1' | 'X' | '2',
          result: undefined, // Will be populated when fixture is completed
          is_correct: testSpec.isCorrect,
          week: testSpec.week,
          timestamp: testSpec.createdAt,
          match_display: testSpec.fixture
            ? testSpec.fixture.getMatchDisplay()
            : `Test Match ${testSpec.fixtureId}`,
          choice_display: testSpec.getChoiceDisplay(),
        };
      } else {
        // Route to live mode service - convert to expected format
        const createSpecDto: CreateSpecDto = {
          user_id: data.userId,
          fixture_id: data.fixtureId, // fixtureId is already a string
          choice: data.choice,
          week: 1, // TODO: Determine current week for live mode
        };
        return this.specsService.createPrediction(createSpecDto);
      }
    } catch (error) {
      console.log('❌ [SPECS_CONTROLLER] ERROR occurred:');
      console.log('❌ [SPECS_CONTROLLER] Error type:', typeof error);
      console.log(
        '❌ [SPECS_CONTROLLER] Error constructor:',
        error?.constructor?.name,
      );
      console.log('❌ [SPECS_CONTROLLER] Error message:', error?.message);
      console.log('❌ [SPECS_CONTROLLER] Error stack:', error?.stack);
      console.log(
        '❌ [SPECS_CONTROLLER] Full error object:',
        JSON.stringify(error, Object.getOwnPropertyNames(error), 2),
      );
      console.log('='.repeat(80));

      // Re-throw the error so it's handled by NestJS
      throw error;
    }
  }

  /**
   * Get weekly stats for a user
   * GET /api/predictions/user/:userId/week/:week?mode=live|test
   */
  @Get('user/:userId/week/:week')
  async getWeeklyStats(
    @Param('userId') userId: string,
    @Param('week', ParseIntPipe) week: number,
    @Query('mode') mode?: 'live' | 'test',
  ): Promise<WeeklyStatsResponseDto> {
    console.log('🟡 [SPECS_CONTROLLER] ='.repeat(50));
    console.log('🟡 [SPECS_CONTROLLER] getWeeklyStats endpoint hit');
    console.log('🟡 [SPECS_CONTROLLER] Timestamp:', new Date().toISOString());
    console.log('🟡 [SPECS_CONTROLLER] Raw params received:');
    console.log('🟡 [SPECS_CONTROLLER] - userId:', {
      value: userId,
      type: typeof userId,
      length: userId?.length,
      isString: typeof userId === 'string',
      isValidFirebaseUID: typeof userId === 'string' && userId.length > 20,
    });
    console.log('🟡 [SPECS_CONTROLLER] - week:', {
      value: week,
      type: typeof week,
      isNumber: typeof week === 'number',
    });
    console.log('🟡 [SPECS_CONTROLLER] - mode:', {
      value: mode,
      type: typeof mode,
      isLive: mode === 'live',
      isTest: mode === 'test',
    });

    try {
      if (mode === 'test') {
        console.log('🟡 [SPECS_CONTROLLER] Routing to TEST mode service');
        const testStats = await this.testModeService.getTestWeeklyStats(
          userId,
          week,
        );
        console.log(
          '🟡 [SPECS_CONTROLLER] Test mode service completed successfully',
        );
        // Convert test mode format to unified format
        return {
          week: testStats.week,
          total_predictions: testStats.totalPredictions,
          correct_predictions: testStats.correctPredictions,
          success_rate: testStats.weeklyPercentage,
          predictions: testStats.predictions.map((pred) => ({
            id: `test-${pred.fixtureId}`, // Generate a temporary ID
            user_id: userId,
            fixture_id: pred.fixtureId.toString(),
            choice: pred.userChoice as '1' | 'X' | '2',
            result: pred.actualResult as '1' | 'X' | '2',
            is_correct: pred.isCorrect,
            week: testStats.week,
            timestamp: new Date(), // Use current timestamp as placeholder
            match_display: `${pred.homeTeam} vs ${pred.awayTeam}`,
            choice_display: pred.userChoice,
          })),
        };
      }

      console.log(
        '🟡 [SPECS_CONTROLLER] Routing to LIVE mode service (specs.service.getWeeklyStats)',
      );
      const result = await this.specsService.getWeeklyStats(userId, week);
      console.log(
        '🟡 [SPECS_CONTROLLER] Live mode service completed successfully',
      );
      console.log('🟡 [SPECS_CONTROLLER] Result preview:', {
        week: result.week,
        total_predictions: result.total_predictions,
        correct_predictions: result.correct_predictions,
        success_rate: result.success_rate,
        predictions_count: result.predictions?.length || 0,
      });
      return result;
    } catch (error) {
      console.log('🔴 [SPECS_CONTROLLER] ERROR in getWeeklyStats:');
      console.log('🔴 [SPECS_CONTROLLER] Error details:', {
        userId,
        week,
        mode,
        errorType: typeof error,
        errorConstructor: error?.constructor?.name,
        errorMessage: error?.message,
        errorStack: error?.stack,
      });
      console.log(
        '🔴 [SPECS_CONTROLLER] Full error object:',
        JSON.stringify(error, Object.getOwnPropertyNames(error), 2),
      );
      console.log('🟡 [SPECS_CONTROLLER] ='.repeat(50));
      throw error;
    }
  }

  /**
   * Get user summary (all weeks)
   * GET /api/predictions/user/:userId/summary
   */
  @Get('user/:userId/summary')
  async getUserSummary(
    @Param('userId') userId: string,
  ): Promise<UserSummaryResponseDto> {
    return this.specsService.getUserSummary(userId);
  }

  /**
   * Purge all live predictions for a user
   * DELETE /api/predictions/user/:userId
   */
  @Delete('user/:userId')
  async deleteUserPredictions(
    @Param('userId') userId: string,
  ): Promise<{ success: boolean; deleted: number; message: string }> {
    const deleted = await this.specsService.deleteUserPredictions(userId);
    return {
      success: true,
      deleted,
      message: `Deleted ${deleted} predictions for user ${userId}`,
    };
  }
}
