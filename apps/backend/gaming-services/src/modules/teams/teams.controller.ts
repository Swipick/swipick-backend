import { Controller, Get, Query, Param } from "@nestjs/common";
import { TeamsService } from "./teams.service";
import { GetTeamsDto } from "../api-football/dto/team.dto";

@Controller("teams")
export class TeamsController {
  constructor(private readonly teamsService: TeamsService) {}

  @Get()
  async getTeams(@Query() query: GetTeamsDto) {
    return this.teamsService.getTeams(query);
  }

  @Get(":id")
  async getTeam(@Param("id") id: number) {
    return this.teamsService.getTeamById(id);
  }

  @Get(":id/statistics")
  async getTeamStatistics(
    @Param("id") id: number,
    @Query("league") leagueId: number,
    @Query("season") season: number
  ) {
    return this.teamsService.getTeamStatistics(id, leagueId, season);
  }

  @Get(":id1/vs/:id2")
  async getHeadToHead(
    @Param("id1") team1Id: number,
    @Param("id2") team2Id: number
  ) {
    return this.teamsService.getHeadToHead(team1Id, team2Id);
  }
}
