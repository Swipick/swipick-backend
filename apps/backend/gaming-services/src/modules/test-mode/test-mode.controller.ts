import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  ParseIntPipe,
  Logger,
  Query,
} from '@nestjs/common';
import { TestModeService } from './test-mode.service';
import { CreateTestPredictionDto } from './dto/test-mode.dto';

// NOTE: Global prefix 'api' is already applied in main.ts; use just 'test-mode' here.
@Controller('test-mode')
export class TestModeController {
  private readonly logger = new Logger(TestModeController.name);

  constructor(private readonly testModeService: TestModeService) {}

  @Post('predictions')
  async createTestPrediction(@Body() dto: CreateTestPredictionDto) {
    this.logger.log(
      `Creating test prediction: User ${dto.userId}, Fixture ${dto.fixtureId}, Choice: ${dto.choice}`,
    );

    const result = await this.testModeService.createTestPrediction(
      dto.userId,
      dto.fixtureId,
      dto.choice,
    );

    return {
      success: true,
      data: result,
      message: 'Test prediction created successfully',
    };
  }

  @Get('predictions/user/:userId/week/:week')
  async getTestWeeklyStats(
    @Param('userId') userId: string,
    @Param('week', ParseIntPipe) week: number,
  ) {
    this.logger.log(`Getting test weekly stats: User ${userId}, Week ${week}`);

    const stats = await this.testModeService.getTestWeeklyStats(userId, week);

    return {
      success: true,
      data: stats,
      message: `Test weekly stats retrieved for user ${userId}, week ${week}`,
    };
  }

  @Get('predictions/user/:userId/summary')
  async getTestUserSummary(@Param('userId') userId: string) {
    this.logger.log(`Getting test user summary: User ${userId}`);

    const summary = await this.testModeService.getTestUserSummary(userId);

    return {
      success: true,
      data: summary,
      message: `Test user summary retrieved for user ${userId}`,
    };
  }

  @Get('fixtures/week/:week')
  async getTestFixturesByWeek(@Param('week', ParseIntPipe) week: number) {
    try {
      this.logger.log(`Getting test fixtures for week ${week}`);

      const fixtures = await this.testModeService.getTestFixturesByWeek(week);

      this.logger.log(
        `Successfully retrieved ${fixtures.length} test fixtures for week ${week}`,
      );

      return {
        success: true,
        data: fixtures,
        message: `Test fixtures retrieved for week ${week}`,
      };
    } catch (error) {
      this.logger.error(`Failed to get test fixtures for week ${week}:`, error);
      throw error;
    }
  }

  @Get('match-cards/week/:week')
  async getMatchCardsByWeek(
    @Param('week', ParseIntPipe) week: number,
    @Query('userId') userId?: string,
  ) {
    try {
      this.logger.log(
        `Getting match cards for week ${week}${userId ? ` (userId=${userId})` : ''}`,
      );

      const cards = await this.testModeService.getMatchCardsByWeek(
        week,
        userId,
      );

      this.logger.log(
        `Successfully retrieved ${cards.length} match cards for week ${week}`,
      );

      return {
        success: true,
        data: cards,
        message: `Match cards retrieved for week ${week}`,
      };
    } catch (error) {
      this.logger.error(`Failed to get match cards for week ${week}:`, error);
      throw error;
    }
  }

  @Get('weeks')
  async getAllTestWeeks() {
    this.logger.log('Getting all available test weeks');

    const weeks = await this.testModeService.getAllTestWeeks();

    return {
      success: true,
      data: weeks,
      message: 'All test weeks retrieved successfully',
    };
  }

  @Post('seed')
  async seedTestData(@Query('force') force?: string) {
    const forceReplace = force === 'true' || force === '1';
    this.logger.log(`Seeding test data (force=${forceReplace})`);

    await this.testModeService.seedTestData(forceReplace);

    return {
      success: true,
      message: `Test data seeded successfully${forceReplace ? ' (force replace)' : ''}`,
    };
  }

  @Delete('reset/:userId')
  async resetUserTestData(@Param('userId') userId: string) {
    this.logger.log(`Resetting test data for user ${userId}`);

    await this.testModeService.resetUserTestData(userId);

    return {
      success: true,
      message: `Test data reset successfully for user ${userId}`,
    };
  }

  @Get('health')
  getHealth() {
    return {
      status: 'ok',
      service: 'test-mode',
      timestamp: new Date().toISOString(),
    };
  }
}
