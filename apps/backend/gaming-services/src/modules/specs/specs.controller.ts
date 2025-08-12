import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  UsePipes,
  ValidationPipe,
  ParseUUIDPipe,
  ParseIntPipe,
} from '@nestjs/common';
import { SpecsService } from './specs.service';
import {
  CreateSpecDto,
  SpecResponseDto,
  WeeklyStatsResponseDto,
  UserSummaryResponseDto,
} from './dto/specs.dto';

@Controller('predictions')
@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
export class SpecsController {
  constructor(private readonly specsService: SpecsService) {}

  /**
   * Create a new prediction
   * POST /api/predictions
   */
  @Post()
  async createPrediction(
    @Body() createSpecDto: CreateSpecDto,
  ): Promise<SpecResponseDto> {
    return this.specsService.createPrediction(createSpecDto);
  }

  /**
   * Get weekly stats for a user
   * GET /api/predictions/user/:userId/week/:week
   */
  @Get('user/:userId/week/:week')
  async getWeeklyStats(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Param('week', ParseIntPipe) week: number,
  ): Promise<WeeklyStatsResponseDto> {
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
}
