import { Injectable, Logger } from '@nestjs/common';
import { ApiFootballService } from '../api-football/api-football.service';
import {
  Team,
  TeamStatistics,
} from '../api-football/interfaces/team.interface';
import { GetTeamsDto } from '../api-football/dto/team.dto';

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

      // Process head-to-head data
      const totalMatches = fixtures.length;
      let team1Wins = 0;
      let team2Wins = 0;
      let draws = 0;

      fixtures.forEach((fixture) => {
        if (fixture.teams.home.winner === true) {
          if (fixture.teams.home.id === team1Id) {
            team1Wins++;
          } else {
            team2Wins++;
          }
        } else if (fixture.teams.away.winner === true) {
          if (fixture.teams.away.id === team1Id) {
            team1Wins++;
          } else {
            team2Wins++;
          }
        } else {
          draws++;
        }
      });

      const lastMatch = fixtures.length > 0 ? fixtures[0] : null;

      return {
        totalMatches,
        team1Wins,
        team2Wins,
        draws,
        lastMatch: lastMatch
          ? {
              date: lastMatch.date,
              result: `${lastMatch.goals.home}-${lastMatch.goals.away}`,
              winner:
                lastMatch.teams.home.winner === true
                  ? 'home'
                  : lastMatch.teams.away.winner === true
                    ? 'away'
                    : 'draw',
            }
          : null,
        fixtures,
      };
    } catch (error) {
      this.logger.error(
        `Failed to get head-to-head for teams ${team1Id} vs ${team2Id}`,
        error,
      );
      throw error;
    }
  }
}
