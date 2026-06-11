import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  Logger,
  ValidationPipe,
} from '@nestjs/common';
import { FinalWeekScoresService } from './final-week-scores.service';
import {
  CreateFinalWeekScoreDto,
  FinalWeekScoreResponseDto,
  UserFinalScoresResponseDto,
} from './dto/final-week-scores.dto';

@Controller('final-week-scores')
export class FinalWeekScoresController {
  private readonly logger = new Logger(FinalWeekScoresController.name);

  constructor(
    private readonly finalWeekScoresService: FinalWeekScoresService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createOrUpdateFinalWeekScore(
    @Body(ValidationPipe) createFinalWeekScoreDto: CreateFinalWeekScoreDto,
  ): Promise<FinalWeekScoreResponseDto> {
    this.logger.debug(
      '🎯 [FINAL_WEEK_SCORES] POST /api/final-week-scores called with:',
      createFinalWeekScoreDto,
    );
    this.logger.debug(
      '🎯 [FINAL_WEEK_SCORES] Request timestamp:',
      new Date().toISOString(),
    );

    try {
      const result =
        await this.finalWeekScoresService.createOrUpdateFinalWeekScore(
          createFinalWeekScoreDto,
        );
      this.logger.debug('🎯 [FINAL_WEEK_SCORES] POST success, result:', result);
      return result;
    } catch (error) {
      this.logger.error('🎯 [FINAL_WEEK_SCORES] POST error:', error);
      throw error;
    }
  }

  @Get(':userId/week/:week')
  async getFinalWeekScore(
    @Param('userId') userId: string,
    @Param('week') week: string,
    @Query('mode') mode: 'live' | 'test' = 'live',
  ): Promise<FinalWeekScoreResponseDto> {
    const weekNumber = parseInt(week, 10);
    if (isNaN(weekNumber) || weekNumber < 1 || weekNumber > 38) {
      throw new Error('Week must be a number between 1 and 38');
    }
    return this.finalWeekScoresService.getFinalWeekScore(
      userId,
      weekNumber,
      mode,
    );
  }

  @Get(':userId')
  async getAllFinalWeekScores(
    @Param('userId') userId: string,
    @Query('mode') mode?: 'live' | 'test',
  ): Promise<UserFinalScoresResponseDto> {
    return this.finalWeekScoresService.getAllFinalWeekScores(userId, mode);
  }

  @Delete(':userId/week/:week')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteFinalWeekScore(
    @Param('userId') userId: string,
    @Param('week') week: string,
    @Query('mode') mode: 'live' | 'test' = 'live',
  ): Promise<void> {
    const weekNumber = parseInt(week, 10);
    if (isNaN(weekNumber) || weekNumber < 1 || weekNumber > 38) {
      throw new Error('Week must be a number between 1 and 38');
    }
    return this.finalWeekScoresService.deleteFinalWeekScore(
      userId,
      weekNumber,
      mode,
    );
  }

  @Get(':userId/week/:week/percentile')
  async getUserPercentile(
    @Param('userId') userId: string,
    @Param('week') week: string,
    @Query('mode') mode: 'live' | 'test' = 'live',
  ): Promise<{
    percentile: number;
    totalPlayers: number;
    betterThanPercent: number;
  }> {
    const weekNumber = parseInt(week, 10);
    if (isNaN(weekNumber) || weekNumber < 1 || weekNumber > 38) {
      throw new Error('Week must be a number between 1 and 38');
    }
    return this.finalWeekScoresService.getUserPercentile(
      userId,
      weekNumber,
      mode,
    );
  }

  @Get(':userId/statistics')
  async getUserStatistics(
    @Param('userId') userId: string,
    @Query('mode') mode: 'live' | 'test' = 'live',
  ): Promise<{
    averageScore: number;
    bestScore: number;
    weeksPlayed: number;
    bestWeek: number | null;
  }> {
    return this.finalWeekScoresService.getUserStatistics(userId, mode);
  }
}
