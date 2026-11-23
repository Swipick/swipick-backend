import { Injectable, Logger } from '@nestjs/common';
import { ApiFootballService } from '../api-football/api-football.service';
import {
  Team,
  TeamStatistics,
} from '../api-football/interfaces/team.interface';
import { GetTeamsDto } from '../api-football/dto/team.dto';
import { headToHeadSummary } from './head-to-head';

@Injectable()
export class TeamsService {
  private readonly logger = new Logger(TeamsService.name);

  constructor(private readonly apiFootballService: ApiFootballService) {}

  async getTeams(params: GetTeamsDto): Promise<Team[]> {
    try {
      const teams = await this.apiFootballService.getTeams(params);
      this.logger.debug(`Retrieved ${teams.length} teams`);
      return teams;
    } catch (error) {
      this.logger.error('Failed to get teams', error);
      throw error;
    }
  }

  async getTeamById(teamId: number): Promise<Team | null> {
    try {
      const teams = await this.apiFootballService.getTeams({ id: teamId });
      return teams.length > 0 ? teams[0] : null;
    } catch (error) {
      this.logger.error(`Failed to get team ${teamId}`, error);
      return null;
    }
  }

  async getTeamStatistics(
    teamId: number,
    leagueId: number,
    season: number,
  ): Promise<TeamStatistics> {
    try {
      const stats = await this.apiFootballService.getTeamStatistics(
        teamId,
        leagueId,
        season,
      );
      this.logger.debug(`Retrieved statistics for team ${teamId}`);
      return stats;
    } catch (error) {
      this.logger.error(
        `Failed to get team statistics for team ${teamId}`,
        error,
      );
      throw error;
    }
  }

  async getHeadToHead(team1Id: number, team2Id: number) {
    try {
      const fixtures = await this.apiFootballService.getHeadToHead(
        team1Id,
        team2Id,
      );

      return headToHeadSummary(fixtures, team1Id);
    } catch (error) {
      this.logger.error(
        `Failed to get head-to-head for teams ${team1Id} vs ${team2Id}`,
        error,
      );
      throw error;
    }
  }
}
