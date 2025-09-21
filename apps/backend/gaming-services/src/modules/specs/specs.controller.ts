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
  ParseUUIDPipe,
  ParseIntPipe,
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
    if (data.mode === 'test') {
      // Route to test mode service
      const testSpec = await this.testModeService.createTestPrediction(
        data.userId,
        data.fixtureId,
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
        fixture_id: data.fixtureId.toString(), // Convert number to string
        choice: data.choice,
        week: 1, // TODO: Determine current week for live mode
      };
      return this.specsService.createPrediction(createSpecDto);
    }
  }

  /**
   * Get weekly stats for a user
   * GET /api/predictions/user/:userId/week/:week?mode=live|test
   */
  @Get('user/:userId/week/:week')
  async getWeeklyStats(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Param('week', ParseIntPipe) week: number,
    @Query('mode') mode?: 'live' | 'test',
  ): Promise<WeeklyStatsResponseDto> {
    if (mode === 'test') {
      const testStats = await this.testModeService.getTestWeeklyStats(
        userId,
        week,
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
    return this.specsService.getWeeklyStats(userId, week);
  }

  /**
   * Get user summary (all weeks)
   * GET /api/predictions/user/:userId/summary
   */
  @Get('user/:userId/summary')
  async getUserSummary(
    @Param('userId', ParseUUIDPipe) userId: string,
  ): Promise<UserSummaryResponseDto> {
    return this.specsService.getUserSummary(userId);
  }

  /**
   * Purge all live predictions for a user
   * DELETE /api/predictions/user/:userId
   */
  @Delete('user/:userId')
  async deleteUserPredictions(
    @Param('userId', ParseUUIDPipe) userId: string,
  ): Promise<{ success: boolean; deleted: number; message: string }> {
    const deleted = await this.specsService.deleteUserPredictions(userId);
    return {
      success: true,
      deleted,
      message: `Deleted ${deleted} predictions for user ${userId}`,
    };
  }
}
