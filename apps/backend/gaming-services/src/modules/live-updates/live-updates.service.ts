import { Injectable, Logger } from '@nestjs/common';
import { FixturesService } from '../fixtures/fixtures.service';
import { LiveMatch } from '../api-football/interfaces/fixture.interface';

@Injectable()
export class LiveUpdatesService {
  private readonly logger = new Logger(LiveUpdatesService.name);

  constructor(private readonly fixturesService: FixturesService) {}

  async processLiveMatches(): Promise<LiveMatch[]> {
    try {
      const liveMatches = await this.fixturesService.getLiveMatches();

      this.logger.debug(`Processing ${liveMatches.length} live matches`);

      // Process each live match
      for (const match of liveMatches) {
        await this.processLiveMatch(match);
      }

      return liveMatches;
    } catch (error) {
      this.logger.error('Failed to process live matches', error);
      throw error;
    }
  }

  async processLiveMatch(match: LiveMatch): Promise<void> {
    try {
      // Here we would typically:
      // 1. Update database with latest match data
      // 2. Check for new events
      // 3. Calculate any derived data
      // 4. Prepare data for WebSocket broadcast

      this.logger.debug(
        `Processing live match ${match.id}: ${match.teams.home.name} vs ${match.teams.away.name}`,
      );

      // For MVP, we'll just log the processing
      // In full implementation, this would include database updates
    } catch (error) {
      this.logger.error(`Failed to process live match ${match.id}`, error);
    }
  }

  formatMatchUpdate(match: LiveMatch) {
    return {
      fixtureId: match.id,
      status: match.status.short,
      minute: match.status.elapsed || 0,
      score: {
        home: match.goals.home,
        away: match.goals.away,
      },
      events:
        match.events?.map((event) => ({
          minute: event.time.elapsed,
          type: this.mapEventType(event.type),
          team: match.teams.home.id === event.team.id ? 'home' : 'away',
          player: event.player.name,
          detail: event.detail,
        })) || [],
      timestamp: new Date().toISOString(),
    };
  }

  private mapEventType(type: string): 'goal' | 'card' | 'substitution' | 'var' {
    const lowerType = type.toLowerCase();

    if (lowerType.includes('goal')) return 'goal';
    if (lowerType.includes('card')) return 'card';
    if (lowerType.includes('subst')) return 'substitution';
    if (lowerType.includes('var')) return 'var';

    return 'goal'; // default fallback
  }
}
