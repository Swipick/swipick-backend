import { registerAs } from "@nestjs/config";

export interface ApiFootballConfig {
  baseUrl: string;
  apiKey: string;
  backupApiKey?: string;
  tier: "free" | "basic" | "pro";
  rateLimits: {
    requestsPerDay: number;
    requestsPerMinute: number;
    concurrentRequests: number;
  };
}

export const ApiFootballConfig = registerAs(
  "apiFootball",
  (): ApiFootballConfig => {
    const tier = (process.env.API_FOOTBALL_TIER || "free") as
      | "free"
      | "basic"
      | "pro";

    const rateLimits = {
      free: {
        requestsPerDay: 100,
        requestsPerMinute: 10,
        concurrentRequests: 1,
      },
      basic: {
        requestsPerDay: 1000,
        requestsPerMinute: 30,
        concurrentRequests: 2,
      },
      pro: {
        requestsPerDay: 10000,
        requestsPerMinute: 100,
        concurrentRequests: 5,
      },
    };

    return {
      baseUrl:
        process.env.API_FOOTBALL_BASE_URL ||
        "https://v3.football.api-sports.io",
      apiKey: process.env.API_FOOTBALL_KEY,
      backupApiKey: process.env.API_FOOTBALL_BACKUP_KEY,
      tier,
      rateLimits: rateLimits[tier],
    };
  }
);
