import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { LiveUpdatesService } from "./live-updates.service";
import { LiveUpdatesGateway } from "./live-updates.gateway";
import { FixturesService } from "../fixtures/fixtures.service";

@Injectable()
export class LiveUpdatesScheduler {
  private readonly logger = new Logger(LiveUpdatesScheduler.name);

  constructor(
    private readonly liveUpdatesService: LiveUpdatesService,
    private readonly liveUpdatesGateway: LiveUpdatesGateway,
    private readonly fixturesService: FixturesService
  ) {}

  // Every 15 seconds during match hours (12:00-23:00 UTC)
  @Cron("*/15 * 12-23 * * *", {
    name: "updateLiveMatches",
    timeZone: "UTC",
  })
  async updateLiveMatches() {
    try {
      this.logger.debug("Starting live matches update...");

      const liveMatches = await this.liveUpdatesService.processLiveMatches();

      if (liveMatches.length === 0) {
        this.logger.debug("No live matches found");
        return;
      }

      // Process and broadcast each live match
      for (const match of liveMatches) {
        const update = this.liveUpdatesService.formatMatchUpdate(match);
        this.liveUpdatesGateway.broadcastMatchUpdate(match.id, update);
      }

      this.logger.log(
        `Updated and broadcasted ${liveMatches.length} live matches`
      );
    } catch (error) {
      this.logger.error("Failed to update live matches", error);
    }
  }

  // Daily fixture sync at midnight UTC
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT, {
    name: "syncDailyFixtures",
    timeZone: "UTC",
  })
  async syncDailyFixtures() {
    try {
      this.logger.log("Starting daily fixtures sync...");

      const today = new Date().toISOString().split("T")[0];
      const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0];

      // Sync today and tomorrow's fixtures
      const [todayFixtures, tomorrowFixtures] = await Promise.all([
        this.fixturesService.syncFixturesForDate(today),
        this.fixturesService.syncFixturesForDate(tomorrow),
      ]);

      const totalSynced = todayFixtures.length + tomorrowFixtures.length;

      // Broadcast fixture updates to all connected clients
      this.liveUpdatesGateway.broadcastFixtureUpdate([
        ...todayFixtures,
        ...tomorrowFixtures,
      ]);

      this.logger.log(
        `Synced ${totalSynced} fixtures (Today: ${todayFixtures.length}, Tomorrow: ${tomorrowFixtures.length})`
      );
    } catch (error) {
      this.logger.error("Failed to sync daily fixtures", error);
    }
  }

  // Health check for live updates - runs every minute
  @Cron(CronExpression.EVERY_MINUTE, {
    name: "liveUpdatesHealthCheck",
  })
  async healthCheck() {
    try {
      const stats = this.liveUpdatesGateway.getConnectionStats();

      if (stats.totalConnections > 0) {
        this.logger.debug(
          `Live updates health check - Connections: ${stats.totalConnections}, Rooms: ${stats.rooms}`
        );
      }
    } catch (error) {
      this.logger.error("Live updates health check failed", error);
    }
  }
}
