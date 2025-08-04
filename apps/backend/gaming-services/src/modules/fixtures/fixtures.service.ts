import { Injectable, Logger } from '@nestjs/common';
import { ApiFootballService } from '../api-football/api-football.service';
import {
  Fixture,
  LiveMatch,
} from '../api-football/interfaces/fixture.interface';

@Injectable()
export class FixturesService {
  private readonly logger = new Logger(FixturesService.name);

  constructor(private readonly apiFootballService: ApiFootballService) {}

  async syncFixturesForDate(date: string): Promise<Fixture[]> {
    try {
      const fixtures = await this.apiFootballService.getDailyFixtures(date);
      this.logger.log(`Synced ${fixtures.length} fixtures for ${date}`);
      return fixtures;
    } catch (error) {
      this.logger.error(`Failed to sync fixtures for ${date}`, error);
      throw error;
    }
  }

  async getLiveMatches(): Promise<LiveMatch[]> {
    try {
      const liveMatches = await this.apiFootballService.getLiveMatches();
      this.logger.debug(`Retrieved ${liveMatches.length} live matches`);
      return liveMatches;
    } catch (error) {
      this.logger.error('Failed to get live matches', error);
      throw error;
    }
  }

  async getFixtureById(fixtureId: number): Promise<Fixture | null> {
    try {
      // For now, this is a placeholder implementation
      // In a full implementation, this would check the database first
      // then fallback to API if needed
      const fixtures = await this.apiFootballService.getDailyFixtures(
        new Date().toISOString().split('T')[0],
      );

      return fixtures.find((f) => f.id === fixtureId) || null;
    } catch (error) {
      this.logger.error(`Failed to get fixture ${fixtureId}`, error);
      return null;
    }
  }

  async getFixturesForGameweek(
    gameweek: number,
    date?: Date,
  ): Promise<Fixture[]> {
    try {
      const targetDate = date || new Date();
      const dateString = targetDate.toISOString().split('T')[0];

      const fixtures =
        await this.apiFootballService.getDailyFixtures(dateString);

      // Filter by gameweek if available in fixture data
      return fixtures.filter((fixture) =>
        fixture.league.round.includes(gameweek.toString()),
      );
    } catch (error) {
      this.logger.error(
        `Failed to get fixtures for gameweek ${gameweek}`,
        error,
      );
      throw error;
    }
  }
}
