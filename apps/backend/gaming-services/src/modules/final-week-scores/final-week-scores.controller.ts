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
  constructor(
    private readonly finalWeekScoresService: FinalWeekScoresService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createOrUpdateFinalWeekScore(
    @Body(ValidationPipe) createFinalWeekScoreDto: CreateFinalWeekScoreDto,
  ): Promise<FinalWeekScoreResponseDto> {
    return this.finalWeekScoresService.createOrUpdateFinalWeekScore(
      createFinalWeekScoreDto,
    );
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
}
