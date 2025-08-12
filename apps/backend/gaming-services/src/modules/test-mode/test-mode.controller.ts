import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  ParseIntPipe,
  Logger,
} from '@nestjs/common';
import { TestModeService } from './test-mode.service';
import { CreateTestPredictionDto } from './dto/test-mode.dto';

@Controller('api/test-mode')
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
    @Param('userId', ParseIntPipe) userId: number,
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
  async getTestUserSummary(@Param('userId', ParseIntPipe) userId: number) {
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
    this.logger.log(`Getting test fixtures for week ${week}`);

    const fixtures = await this.testModeService.getTestFixturesByWeek(week);

    return {
      success: true,
      data: fixtures,
      message: `Test fixtures retrieved for week ${week}`,
    };
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
  async seedTestData() {
    this.logger.log('Seeding test data');

    await this.testModeService.seedTestData();

    return {
      success: true,
      message: 'Test data seeded successfully',
    };
  }

  @Delete('reset/:userId')
  async resetUserTestData(@Param('userId', ParseIntPipe) userId: number) {
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
