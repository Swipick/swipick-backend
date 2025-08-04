import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Query,
  Body,
  Req,
  Logger,
} from '@nestjs/common';
import { AppService } from './app.service';
import { Request } from 'express';

@Controller()
export class AppController {
  private readonly logger = new Logger(AppController.name);

  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('health')
  getHealth(): { status: string; timestamp: string; service: string } {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: 'swipick-bff',
    };
  }

  @Get('health/full')
  async getFullHealth() {
    const bffHealth = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: 'swipick-bff',
    };

    const gamingServicesHealth =
      await this.appService.checkGamingServicesHealth();

    return {
      bff: bffHealth,
      gamingServices: gamingServicesHealth,
      overall: {
        status: gamingServicesHealth.status === 'ok' ? 'ok' : 'degraded',
        timestamp: new Date().toISOString(),
      },
    };
  }

  // Gaming Services API Routes
  @Get('api/fixtures')
  async getFixtures() {
    this.logger.log('Forwarding fixtures request to Gaming Services');
    return this.appService.forwardToGamingServices('/api/fixtures');
  }

  @Get('api/fixtures/live')
  async getLiveFixtures() {
    this.logger.log('Forwarding live fixtures request to Gaming Services');
    return this.appService.forwardToGamingServices('/api/fixtures/live');
  }

  @Get('api/fixtures/upcoming/serie-a')
  async getUpcomingSerieAFixtures(@Req() req: Request) {
    this.logger.log('Forwarding Serie A fixtures request to Gaming Services');
    const queryString = req.url.split('?')[1] || '';
    const endpoint = `/api/fixtures/upcoming/serie-a${queryString ? `?${queryString}` : ''}`;
    return this.appService.forwardToGamingServices(endpoint);
  }

  @Get('api/fixtures/:id')
  async getFixtureById(@Param('id') id: string) {
    this.logger.log(`Forwarding fixture ${id} request to Gaming Services`);
    return this.appService.forwardToGamingServices(`/api/fixtures/${id}`);
  }

  @Post('api/fixtures/sync')
  async syncFixtures(@Body() body: any) {
    this.logger.log('Forwarding fixtures sync request to Gaming Services');
    return this.appService.forwardToGamingServices(
      '/api/fixtures/sync',
      'POST',
      body,
    );
  }

  @Get('api/teams')
  async getTeams() {
    this.logger.log('Forwarding teams request to Gaming Services');
    return this.appService.forwardToGamingServices('/api/teams');
  }

  @Get('api/teams/:id')
  async getTeamById(@Param('id') id: string) {
    this.logger.log(`Forwarding team ${id} request to Gaming Services`);
    return this.appService.forwardToGamingServices(`/api/teams/${id}`);
  }

  @Get('api/teams/:id/statistics')
  async getTeamStatistics(@Param('id') id: string) {
    this.logger.log(
      `Forwarding team ${id} statistics request to Gaming Services`,
    );
    return this.appService.forwardToGamingServices(
      `/api/teams/${id}/statistics`,
    );
  }

  @Get('api/teams/:id1/vs/:id2')
  async getTeamVsTeam(@Param('id1') id1: string, @Param('id2') id2: string) {
    this.logger.log(
      `Forwarding team ${id1} vs ${id2} request to Gaming Services`,
    );
    return this.appService.forwardToGamingServices(
      `/api/teams/${id1}/vs/${id2}`,
    );
  }

  @Get('api/health')
  async getGamingServicesHealth() {
    this.logger.log('Forwarding health check to Gaming Services');
    return this.appService.forwardToGamingServices('/api/health');
  }
}
