# 🏈 Implementation Ticket - Gaming Services Container (API-FOOTBALL Integration)

**Ticket Number:** IMP-20250804-001  
**Priority:** P0 - Critical (Core Application Feature)  
**Estimated Effort:** 40-60 hours  
**Target Completion:** 2025-08-18  
**Assignee:** Development Team

---

## 📋 **Executive Summary**

Implement the **Gaming Services Container** - the core microservice responsible for integrating with API-FOOTBALL to provide real-time football data, match fixtures, team information, and live updates to the Swipick prediction game platform.

This service will handle:

- 📅 **Daily fixture management** with caching
- ⚡ **Real-time match updates** via WebSocket streaming
- 👥 **Teams & players metadata** persistence
- 🎯 **Future odds & predictions** integration
- 🔄 **Robust API client** with retry logic and circuit breaker

---

## 🎯 **Business Requirements**

### **Core Functionality**

1. **Pre-match Data**: Daily fixture lists with 24h caching
2. **Live Updates**: 15-second interval live match data streaming
3. **Metadata Management**: Teams and players information persistence
4. **Future Extensibility**: Odds and predictions integration capability
5. **Real-time Communication**: WebSocket gateway for client updates

### **Performance Requirements**

- ⚡ **API Response Time**: < 500ms for cached data
- 🔄 **Live Update Frequency**: 15 seconds (API limit compliance)
- 💾 **Cache Hit Ratio**: > 90% for fixture data
- 🌐 **WebSocket Concurrency**: Support 1000+ concurrent connections
- 📊 **Uptime**: 99.9% availability target

### **Compliance Requirements (MVP)**

- 🔐 **API Key Security**: Environment variables with optional backup key
- 📋 **Rate Limiting**: Simple in-memory quota tracking
- 🛡️ **Circuit Breaker**: Prevent API overload and quota exhaustion
- 📝 **Basic Logging**: Essential API usage tracking

---

## 🏗️ **Technical Architecture**

### **Service Structure**

```
apps/backend/gaming-services/
├── src/
│   ├── main.ts                     # Application bootstrap
│   ├── app.module.ts               # Root module
│   ├── config/
│   │   ├── api-football.config.ts  # API-FOOTBALL configuration
│   │   ├── database.config.ts      # Database connection config
│   │   └── websocket.config.ts     # WebSocket gateway config
│   ├── modules/
│   │   ├── api-football/           # API-FOOTBALL integration
│   │   │   ├── api-football.module.ts
│   │   │   ├── api-football.service.ts
│   │   │   ├── api-football.client.ts
│   │   │   ├── interfaces/
│   │   │   │   ├── fixture.interface.ts
│   │   │   │   ├── team.interface.ts
│   │   │   │   ├── player.interface.ts
│   │   │   │   └── live-match.interface.ts
│   │   │   └── dto/
│   │   │       ├── fixture.dto.ts
│   │   │       ├── team.dto.ts
│   │   │       └── live-match.dto.ts
│   │   ├── fixtures/               # Fixture management
│   │   │   ├── fixtures.module.ts
│   │   │   ├── fixtures.service.ts
│   │   │   ├── fixtures.controller.ts
│   │   │   ├── fixtures.repository.ts
│   │   │   └── entities/fixture.entity.ts
│   │   ├── teams/                  # Teams & players
│   │   │   ├── teams.module.ts
│   │   │   ├── teams.service.ts
│   │   │   ├── teams.controller.ts
│   │   │   ├── teams.repository.ts
│   │   │   ├── entities/
│   │   │   │   ├── team.entity.ts
│   │   │   │   └── player.entity.ts
│   │   │   └── dto/
│   │   │       ├── team.dto.ts
│   │   │       └── player.dto.ts
│   │   ├── live-updates/           # Real-time updates
│   │   │   ├── live-updates.module.ts
│   │   │   ├── live-updates.service.ts
│   │   │   ├── live-updates.gateway.ts
│   │   │   └── live-updates.scheduler.ts
│   │   ├── cache/                  # Caching layer
│   │   │   ├── cache.module.ts
│   │   │   ├── cache.service.ts
│   │   │   └── cache.decorator.ts
│   │   └── health/                 # Health checks
│   │       ├── health.module.ts
│   │       ├── health.controller.ts
│   │       └── health.service.ts
│   ├── common/
│   │   ├── decorators/
│   │   │   ├── circuit-breaker.decorator.ts
│   │   │   └── retry.decorator.ts
│   │   ├── interceptors/
│   │   │   ├── logging.interceptor.ts
│   │   │   └── rate-limit.interceptor.ts
│   │   ├── guards/
│   │   │   └── api-key.guard.ts
│   │   └── middleware/
│   │       └── request-id.middleware.ts
│   └── database/
│       ├── migrations/
│       └── seeds/
├── test/                           # E2E tests
├── Containerfile                   # Production container
├── Containerfile.dev               # Development container
├── package.json
├── tsconfig.json
└── nest-cli.json
```

### **External Dependencies**

- 🏈 **API-FOOTBALL**: Primary data source (v3.football.api-sports.io)
- 🗄️ **PostgreSQL**: Primary database for persistence
- 🚀 **Redis**: Caching layer and session storage
- 🔐 **Environment Variables**: API key management (MVP approach)
- 📡 **WebSocket**: Real-time client communication
- 📊 **Prometheus**: Metrics collection (optional for MVP)

---

## 📊 **API-FOOTBALL Integration Strategy**

### **Endpoint Mapping & Usage**

| **Function**         | **API Endpoint**                          | **Frequency**           | **Caching Strategy**    | **Frontend Data**             | **Priority** |
| -------------------- | ----------------------------------------- | ----------------------- | ----------------------- | ----------------------------- | ------------ |
| **Daily Fixtures**   | `/fixtures?date=YYYY-MM-DD`               | Daily (cron: 00:00 UTC) | 24h cache in DB + Redis | Match cards, countdown timers | P0           |
| **Live Matches**     | `/fixtures?live=all`                      | 15s intervals           | 15s TTL in Redis        | Live scores, match events     | P0           |
| **Team Data**        | `/teams?league={id}&season={year}`        | On-demand/nightly       | Persistent in DB        | Logos, names, colors, stats   | P0           |
| **Team Statistics**  | `/teams/statistics?team={id}&league={id}` | Daily                   | 24h cache in DB         | Win %, form, position         | P0           |
| **Head-to-Head**     | `/fixtures?h2h={team1}-{team2}`           | On-demand               | 7d cache in DB          | Historical results            | P1           |
| **League Standings** | `/standings?league={id}&season={year}`    | Daily                   | 24h cache in DB         | Current positions             | P1           |
| **Team Logos**       | `/teams/{id}` (logo field)                | On-demand               | Persistent storage      | High-res team logos           | P0           |
| **Player Data**      | `/players?team={id}&season={year}`        | On-demand/nightly       | Persistent in DB        | Player info, photos           | P2           |
| **Venue Info**       | `/venues?id={id}`                         | Weekly                  | 7d cache in DB          | Stadium names, images         | P2           |
| **Odds**             | `/odds?fixture={id}`                      | Future feature          | Feature toggle          | Betting odds display          | P3           |
| **Predictions**      | `/predictions?fixture={id}`               | Future feature          | Feature toggle          | AI predictions                | P3           |

### **Frontend Data Requirements Analysis**

Based on the mobile app interface, the following data points are required:

#### **Match Prediction Interface**

- 🏆 **Match Header**: Date, time, venue, round/gameweek
- 🏟️ **Team Information**: Team names, logos, current league position
- 📊 **Team Statistics**: Win percentage, recent form (last 5 results)
- ⚽ **Head-to-Head**: Historical results between teams
- 🎯 **Prediction Options**: Home win (1), Draw (X), Away win (2)
- ⏰ **Match Countdown**: Days, hours, minutes, seconds until kickoff
- 📈 **League Context**: Current standings position for both teams

#### **Visual Assets Required**

- 🏠 **Team Logos**: High-resolution PNG/SVG (minimum 256x256px)
- 🏟️ **Stadium Images**: Venue photos for atmosphere
- 🏆 **League Badges**: Competition logos and branding
- 🎨 **Team Colors**: Primary and secondary colors for UI theming
- 📱 **Icons**: Match status indicators, result symbols

### **API Client Architecture (MVP Approach)**

```typescript
// API-FOOTBALL Client - MVP version with environment variables
export class ApiFootballClient {
  private readonly httpService: HttpService;
  private readonly circuitBreaker: CircuitBreaker;
  private readonly retryConfig: RetryConfig;
  private readonly apiKey: string;

  constructor(httpService: HttpService, configService: ConfigService) {
    this.httpService = httpService;
    this.apiKey = configService.get("API_FOOTBALL_KEY");

    if (!this.apiKey) {
      throw new Error("API_FOOTBALL_KEY environment variable is required");
    }
  }

  // Exponential backoff retry logic
  async makeRequest<T>(endpoint: string, params?: any): Promise<T> {
    return this.retryWithBackoff(async () => {
      return this.circuitBreaker.execute(() =>
        this.httpService.get(endpoint, {
          headers: {
            "x-apisports-key": this.apiKey,
            "x-rapidapi-host": "v3.football.api-sports.io",
          },
          params,
        })
      );
    });
  }

  // Circuit breaker implementation
  private circuitBreaker = new CircuitBreaker({
    failureThreshold: 5,
    resetTimeout: 30000,
    monitoringPeriod: 10000,
  });
}
```

### **Rate Limiting & Quota Management (MVP)**

```typescript
// Rate limiter configuration for MVP
export const API_FOOTBALL_LIMITS = {
  FREE_TIER: {
    requestsPerDay: 100,
    requestsPerMinute: 10,
    concurrentRequests: 1,
  },
  BASIC_TIER: {
    requestsPerDay: 1000,
    requestsPerMinute: 30,
    concurrentRequests: 2,
  },
};

// Simple quota tracking service
@Injectable()
export class QuotaTracker {
  private dailyCount = 0;
  private minuteCount = 0;
  private lastReset = new Date();

  canMakeRequest(): boolean {
    this.resetCountersIfNeeded();

    const limits = this.getCurrentTierLimits();
    return (
      this.dailyCount < limits.requestsPerDay &&
      this.minuteCount < limits.requestsPerMinute
    );
  }

  recordRequest(): void {
    this.dailyCount++;
    this.minuteCount++;
  }

  private resetCountersIfNeeded(): void {
    const now = new Date();

    // Reset daily counter at midnight
    if (now.getDate() !== this.lastReset.getDate()) {
      this.dailyCount = 0;
      this.lastReset = now;
    }

    // Reset minute counter every minute
    if (now.getMinutes() !== this.lastReset.getMinutes()) {
      this.minuteCount = 0;
    }
  }
}

// Circuit breaker states
enum CircuitState {
  CLOSED = "closed", // Normal operation
  OPEN = "open", // All requests fail fast
  HALF_OPEN = "half_open", // Testing if service recovered
}
```

---

## 🗄️ **Database Schema Design**

### **Core Entities**

```sql
-- Leagues table
CREATE TABLE leagues (
    id SERIAL PRIMARY KEY,
    api_league_id INTEGER UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    country VARCHAR(100),
    logo VARCHAR(500),
    season_start DATE,
    season_end DATE,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Teams table (enhanced for frontend requirements)
CREATE TABLE teams (
    id SERIAL PRIMARY KEY,
    api_team_id INTEGER UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    code VARCHAR(10),
    country VARCHAR(100),
    logo VARCHAR(500) NOT NULL,
    logo_high_res VARCHAR(500),
    primary_color VARCHAR(7), -- Hex color code
    secondary_color VARCHAR(7), -- Hex color code
    venue_name VARCHAR(255),
    venue_capacity INTEGER,
    venue_image VARCHAR(500),
    founded INTEGER,
    national BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Team statistics table (for win percentages and form)
CREATE TABLE team_statistics (
    id SERIAL PRIMARY KEY,
    team_id INTEGER REFERENCES teams(id),
    league_id INTEGER REFERENCES leagues(id),
    season INTEGER NOT NULL,
    matches_played INTEGER DEFAULT 0,
    wins INTEGER DEFAULT 0,
    draws INTEGER DEFAULT 0,
    losses INTEGER DEFAULT 0,
    goals_for INTEGER DEFAULT 0,
    goals_against INTEGER DEFAULT 0,
    win_percentage DECIMAL(5,2) DEFAULT 0.00,
    home_wins INTEGER DEFAULT 0,
    home_draws INTEGER DEFAULT 0,
    home_losses INTEGER DEFAULT 0,
    away_wins INTEGER DEFAULT 0,
    away_draws INTEGER DEFAULT 0,
    away_losses INTEGER DEFAULT 0,
    current_position INTEGER,
    points INTEGER DEFAULT 0,
    form VARCHAR(10), -- Last 5 results: "WWDLW"
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    UNIQUE KEY uk_team_league_season (team_id, league_id, season),
    INDEX idx_team_stats_position (current_position),
    INDEX idx_team_stats_form (form)
);

-- Head-to-head records
CREATE TABLE head_to_head (
    id SERIAL PRIMARY KEY,
    team1_id INTEGER REFERENCES teams(id),
    team2_id INTEGER REFERENCES teams(id),
    total_matches INTEGER DEFAULT 0,
    team1_wins INTEGER DEFAULT 0,
    team2_wins INTEGER DEFAULT 0,
    draws INTEGER DEFAULT 0,
    last_match_date DATE,
    last_match_result VARCHAR(10), -- "1-2", "0-0", etc.
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    UNIQUE KEY uk_h2h_teams (team1_id, team2_id),
    INDEX idx_h2h_lookup (team1_id, team2_id)
);

-- Venues table (for stadium information)
CREATE TABLE venues (
    id SERIAL PRIMARY KEY,
    api_venue_id INTEGER UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    city VARCHAR(100),
    country VARCHAR(100),
    capacity INTEGER,
    surface VARCHAR(50), -- grass, artificial, etc.
    image VARCHAR(500),
    address TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Enhanced fixtures table
CREATE TABLE fixtures (
    id SERIAL PRIMARY KEY,
    api_fixture_id INTEGER UNIQUE NOT NULL,
    league_id INTEGER REFERENCES leagues(id),
    home_team_id INTEGER REFERENCES teams(id),
    away_team_id INTEGER REFERENCES teams(id),
    venue_id INTEGER REFERENCES venues(id),
    match_date TIMESTAMP NOT NULL,
    status VARCHAR(50) NOT NULL, -- NS, 1H, HT, 2H, FT, AET, PEN, etc.
    status_long VARCHAR(100), -- "Not Started", "First Half", etc.
    minute INTEGER,
    home_score INTEGER DEFAULT 0,
    away_score INTEGER DEFAULT 0,
    home_score_halftime INTEGER DEFAULT 0,
    away_score_halftime INTEGER DEFAULT 0,
    referee VARCHAR(255),
    round VARCHAR(50),
    season INTEGER,
    week INTEGER, -- Gameweek number
    is_live BOOLEAN DEFAULT false,
    timezone VARCHAR(50) DEFAULT 'UTC',
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    INDEX idx_fixtures_date (match_date),
    INDEX idx_fixtures_status (status),
    INDEX idx_fixtures_live (is_live),
    INDEX idx_fixtures_teams (home_team_id, away_team_id),
    INDEX idx_fixtures_week (week, season)
);

-- Live match events
CREATE TABLE match_events (
    id SERIAL PRIMARY KEY,
    fixture_id INTEGER REFERENCES fixtures(id),
    minute INTEGER,
    team_id INTEGER REFERENCES teams(id),
    player_id INTEGER REFERENCES players(id),
    event_type VARCHAR(50) NOT NULL, -- Goal, Card, Substitution, etc.
    detail VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- API usage tracking
CREATE TABLE api_usage_logs (
    id SERIAL PRIMARY KEY,
    endpoint VARCHAR(255) NOT NULL,
    response_time_ms INTEGER,
    status_code INTEGER,
    quota_remaining INTEGER,
    error_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    INDEX idx_api_logs_endpoint (endpoint),
    INDEX idx_api_logs_date (created_at)
);
```

### **Caching Strategy**

```typescript
// Redis cache configuration
export const CACHE_KEYS = {
  DAILY_FIXTURES: 'fixtures:daily:{date}',      // TTL: 24h
  LIVE_MATCHES: 'fixtures:live',                // TTL: 15s
  TEAM_DATA: 'teams:{id}',                      // TTL: 7d
  LEAGUE_DATA: 'leagues:{id}',                  // TTL: 7d
  API_QUOTA: 'api:quota:{date}',                // TTL: 24h
};

// Cache decorators
@CacheResult('fixtures:daily:{date}', 24 * 60 * 60) // 24 hours
async getDailyFixtures(date: string): Promise<Fixture[]> {
  return this.apiFootballClient.getFixtures({ date });
}

@CacheResult('fixtures:live', 15) // 15 seconds
async getLiveMatches(): Promise<LiveMatch[]> {
  return this.apiFootballClient.getLiveFixtures();
}
```

---

## � **Frontend API Endpoints**

### **Match Prediction Data Endpoint**

```typescript
// GET /api/matches/{id}/prediction-data
interface MatchPredictionResponse {
  match: {
    id: number;
    date: string; // ISO timestamp
    venue: {
      name: string;
      city: string;
      image?: string;
    };
    round: string; // "Giornata 7"
    week: number; // 7
    status: "NS" | "1H" | "HT" | "2H" | "FT";
    countdown: {
      days: number;
      hours: number;
      minutes: number;
      seconds: number;
    };
  };
  homeTeam: {
    id: number;
    name: string; // "Napoli"
    logo: string; // High-res logo URL
    primaryColor: string; // "#87CEEB"
    position: number; // 1
    stats: {
      homeWinPercentage: number; // 82
      form: string; // "WWDWW" (last 5 results)
      recentResults: Array<{
        result: "1" | "X" | "2";
        color: "green" | "yellow" | "red";
      }>;
    };
  };
  awayTeam: {
    id: number;
    name: string; // "Como"
    logo: string; // High-res logo URL
    primaryColor: string; // "#004B87"
    position: number; // 14
    stats: {
      awayWinPercentage: number; // 34
      form: string; // "LDWLL"
      recentResults: Array<{
        result: "1" | "X" | "2";
        color: "green" | "yellow" | "red";
      }>;
    };
  };
  headToHead: {
    totalMatches: number;
    homeTeamWins: number;
    awayTeamWins: number;
    draws: number;
    lastMatch?: {
      date: string;
      result: string; // "2-1"
      winner: "home" | "away" | "draw";
    };
  };
  predictions?: {
    homeWin: number; // Probability percentage
    draw: number;
    awayWin: number;
    confidence: "low" | "medium" | "high";
  };
}
```

### **Live Match Updates WebSocket**

```typescript
// WebSocket events for live updates
interface LiveMatchUpdate {
  fixtureId: number;
  status: string;
  minute: number;
  score: {
    home: number;
    away: number;
  };
  events: Array<{
    minute: number;
    type: "goal" | "card" | "substitution" | "var";
    team: "home" | "away";
    player: string;
    detail?: string;
  }>;
  timestamp: string;
}

// Client subscription
socket.emit("subscribe_match", { fixtureId: 12345 });
socket.on("match_update", (update: LiveMatchUpdate) => {
  // Update UI with live data
});
```

### **Match List Endpoint**

```typescript
// GET /api/matches?date=2025-08-04&gameweek=7
interface MatchListResponse {
  gameweek: {
    number: number; // 7
    period: string; // "dal 4/10 al 6/10"
    progress: number; // 0-10 (matches completed)
  };
  matches: Array<{
    id: number;
    date: string;
    time: string; // "18:30"
    homeTeam: {
      name: string;
      logo: string;
      position: number;
    };
    awayTeam: {
      name: string;
      logo: string;
      position: number;
    };
    venue: string;
    status: "upcoming" | "live" | "finished";
    score?: {
      home: number;
      away: number;
    };
    userPrediction?: "1" | "X" | "2";
  }>;
}
```

## 🎨 **Asset Management Strategy**

## 🎨 **Asset Management Strategy**

### **Logo and Image Processing**

```typescript
// Asset service for handling team logos and images
@Injectable()
export class AssetService {
  // Download and process team logos
  async processTeamLogo(team: Team): Promise<string> {
    const originalUrl = team.logo;

    // Download original image
    const imageBuffer = await this.downloadImage(originalUrl);

    // Generate multiple sizes for different use cases
    const sizes = [64, 128, 256, 512]; // pixels
    const processedImages = await Promise.all(
      sizes.map((size) => this.resizeImage(imageBuffer, size))
    );

    // Upload to CDN/S3 with organized structure
    const cdnUrls = await this.uploadToStorage(processedImages, {
      team: team.name.toLowerCase().replace(/\s+/g, "-"),
      sizes: sizes,
    });

    return cdnUrls["256"]; // Default size for mobile
  }

  // Extract team colors from logo
  async extractTeamColors(logoUrl: string): Promise<TeamColors> {
    const imageBuffer = await this.downloadImage(logoUrl);
    const colors = await this.extractDominantColors(imageBuffer);

    return {
      primary: colors[0], // Most dominant color
      secondary: colors[1], // Secondary color
      accent: colors[2], // Accent color for highlights
    };
  }
}

interface TeamColors {
  primary: string; // "#1E40AF" (hex)
  secondary: string; // "#3B82F6"
  accent: string; // "#60A5FA"
}
```

### **CDN Structure for Assets**

```
cdn.swipick.com/
├── teams/
│   ├── napoli/
│   │   ├── logo-64.png
│   │   ├── logo-128.png
│   │   ├── logo-256.png
│   │   └── logo-512.png
│   ├── como/
│   │   ├── logo-64.png
│   │   ├── logo-128.png
│   │   ├── logo-256.png
│   │   └── logo-512.png
├── leagues/
│   ├── serie-a/
│   │   ├── badge-128.png
│   │   └── badge-256.png
├── venues/
│   ├── stadio-diego-armando-maradona/
│   │   ├── exterior.jpg
│   │   └── interior.jpg
└── flags/
    ├── italy.png
    └── england.png
```

---

## 🔄 **Real-time Updates Architecture**

### **WebSocket Gateway Implementation**

```typescript
@WebSocketGateway(3001, {
  cors: { origin: "*" },
  transports: ["websocket", "polling"],
})
export class LiveUpdatesGateway {
  @WebSocketServer() server: Server;

  // Client subscribes to specific match updates
  @SubscribeMessage("subscribe_match")
  handleMatchSubscription(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { fixtureId: number }
  ) {
    client.join(`match_${payload.fixtureId}`);
    return { status: "subscribed", fixtureId: payload.fixtureId };
  }

  // Broadcast live updates to subscribed clients
  broadcastMatchUpdate(fixtureId: number, update: LiveMatchUpdate) {
    this.server.to(`match_${fixtureId}`).emit("match_update", update);
  }

  // Broadcast general fixture list updates
  broadcastFixtureUpdate(fixtures: Fixture[]) {
    this.server.emit("fixtures_update", fixtures);
  }
}
```

### **Live Update Scheduler**

```typescript
@Injectable()
export class LiveUpdatesScheduler {
  private readonly logger = new Logger(LiveUpdatesScheduler.name);

  // Every 15 seconds during match hours (typically 12:00-23:00 UTC)
  @Cron("*/15 * 12-23 * * *", { timeZone: "UTC" })
  async updateLiveMatches() {
    try {
      const liveMatches = await this.apiFootballService.getLiveMatches();

      for (const match of liveMatches) {
        await this.processLiveMatch(match);
        await this.broadcastUpdate(match);
      }

      this.logger.log(`Updated ${liveMatches.length} live matches`);
    } catch (error) {
      this.logger.error("Failed to update live matches", error);
    }
  }

  // Daily fixture sync at midnight UTC
  @Cron("0 0 * * *", { timeZone: "UTC" })
  async syncDailyFixtures() {
    const today = new Date().toISOString().split("T")[0];
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[0];

    await Promise.all([
      this.fixturesService.syncFixturesForDate(today),
      this.fixturesService.syncFixturesForDate(tomorrow),
    ]);
  }
}
```

---

## 🛡️ **Security & Reliability Features (MVP)**

### **Environment-Based API Key Management**

```typescript
@Injectable()
export class ApiKeyService {
  private readonly apiKey: string;
  private readonly backupApiKey?: string;

  constructor(private readonly configService: ConfigService) {
    this.apiKey = this.configService.get("API_FOOTBALL_KEY");
    this.backupApiKey = this.configService.get("API_FOOTBALL_BACKUP_KEY"); // Optional

    if (!this.apiKey) {
      throw new Error("API_FOOTBALL_KEY is required");
    }
  }

  getCurrentKey(): string {
    return this.apiKey;
  }

  // Simple fallback mechanism for MVP
  getBackupKey(): string | null {
    return this.backupApiKey || null;
  }

  // Basic health check for API key
  async validateApiKey(): Promise<boolean> {
    try {
      const response = await this.httpService
        .get("https://v3.football.api-sports.io/status", {
          headers: { "x-apisports-key": this.apiKey },
        })
        .toPromise();

      return response.status === 200;
    } catch (error) {
      return false;
    }
  }
}
```

### **Circuit Breaker Implementation**

```typescript
export class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failureCount = 0;
  private lastFailureTime?: Date;

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === CircuitState.OPEN) {
      if (this.shouldAttemptReset()) {
        this.state = CircuitState.HALF_OPEN;
      } else {
        throw new Error("Circuit breaker is OPEN");
      }
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess() {
    this.failureCount = 0;
    this.state = CircuitState.CLOSED;
  }

  private onFailure() {
    this.failureCount++;
    this.lastFailureTime = new Date();

    if (this.failureCount >= this.failureThreshold) {
      this.state = CircuitState.OPEN;
    }
  }
}
```

---

## 📋 **Implementation Phases**

### **Phase 1: Core Infrastructure (Week 1)**

- ✅ **Setup**: Project structure and basic NestJS application
- ✅ **Database**: PostgreSQL schema creation and migrations
- ✅ **Redis**: Caching layer setup
- ✅ **Config**: Environment configuration and secrets management
- ✅ **Health**: Health check endpoints and monitoring

**Deliverables:**

- Gaming services container structure
- Database migrations
- Basic health check endpoint
- Development environment setup

### **Phase 2: API-FOOTBALL Integration (Week 1-2)**

- ✅ **Client**: HTTP client with retry logic and circuit breaker
- ✅ **Authentication**: API key management and rotation
- ✅ **Rate Limiting**: Quota tracking and management
- ✅ **Fixtures**: Daily fixture sync and caching
- ✅ **Teams**: Team and player data management

**Deliverables:**

- Functional API-FOOTBALL client
- Daily fixture synchronization
- Teams and players data management
- Circuit breaker and retry mechanisms

### **Phase 3: Real-time Features (Week 2)**

- ✅ **WebSocket**: Gateway setup and client management
- ✅ **Live Updates**: 15-second match update scheduler
- ✅ **Broadcasting**: Real-time update distribution
- ✅ **Event Handling**: Match events and score updates
- ✅ **Connection Management**: Client subscription handling

**Deliverables:**

- WebSocket gateway for real-time updates
- Live match update scheduler
- Client subscription management
- Real-time event broadcasting

### **Phase 4: Advanced Features (Week 3)**

- ✅ **Monitoring**: Metrics collection and alerting
- ✅ **Logging**: Structured logging and audit trails
- ✅ **Performance**: Query optimization and caching improvements
- ✅ **Error Handling**: Comprehensive error management
- ✅ **Documentation**: API documentation and integration guides

**Deliverables:**

- Comprehensive monitoring setup
- Performance optimizations
- Complete error handling
- API documentation

---

## 🧪 **Testing Strategy**

### **Unit Tests**

```typescript
// Example: API Football service tests
describe("ApiFootballService", () => {
  it("should fetch daily fixtures with caching", async () => {
    const mockFixtures = [
      /* mock data */
    ];
    jest.spyOn(httpService, "get").mockResolvedValue({ data: mockFixtures });

    const result = await service.getDailyFixtures("2025-08-04");

    expect(result).toEqual(mockFixtures);
    expect(cacheService.set).toHaveBeenCalledWith(
      "fixtures:daily:2025-08-04",
      mockFixtures
    );
  });

  it("should handle API rate limit errors", async () => {
    jest
      .spyOn(httpService, "get")
      .mockRejectedValue(new Error("Rate limit exceeded"));

    await expect(service.getDailyFixtures("2025-08-04")).rejects.toThrow(
      "Rate limit exceeded"
    );
    expect(circuitBreaker.state).toBe(CircuitState.OPEN);
  });
});
```

### **Integration Tests**

```typescript
// Example: E2E fixture sync test
describe("Fixtures E2E", () => {
  it("should sync fixtures from API-FOOTBALL", async () => {
    return request(app.getHttpServer())
      .post("/fixtures/sync")
      .send({ date: "2025-08-04" })
      .expect(201)
      .expect((res) => {
        expect(res.body.syncedCount).toBeGreaterThan(0);
      });
  });
});
```

### **Load Testing**

- 🚀 **WebSocket Connections**: Test 1000+ concurrent connections
- 📊 **API Throughput**: Test API response times under load
- 💾 **Database Performance**: Test query performance with large datasets
- 🔄 **Cache Performance**: Test Redis performance under high load

---

## � **Frontend Data Service Implementation**

### **Match Prediction Controller**

```typescript
@Controller("api/matches")
export class MatchesController {
  @Get(":id/prediction-data")
  async getMatchPredictionData(
    @Param("id") fixtureId: number
  ): Promise<MatchPredictionResponse> {
    // Get complete match data optimized for mobile prediction UI
    const fixture = await this.fixturesService.getFixtureWithTeams(fixtureId);
    const homeStats = await this.teamStatsService.getTeamStats(
      fixture.homeTeamId
    );
    const awayStats = await this.teamStatsService.getTeamStats(
      fixture.awayTeamId
    );
    const headToHead = await this.headToHeadService.getH2H(
      fixture.homeTeamId,
      fixture.awayTeamId
    );

    return {
      match: {
        id: fixture.id,
        date: fixture.matchDate.toISOString(),
        venue: {
          name: fixture.venue.name,
          city: fixture.venue.city,
          image: fixture.venue.image,
        },
        round: `Giornata ${fixture.week}`,
        week: fixture.week,
        status: fixture.status,
        countdown: this.calculateCountdown(fixture.matchDate),
      },
      homeTeam: {
        id: fixture.homeTeam.id,
        name: fixture.homeTeam.name,
        logo: this.assetService.getTeamLogo(fixture.homeTeam.id, 256),
        primaryColor: fixture.homeTeam.primaryColor,
        position: homeStats.currentPosition,
        stats: {
          homeWinPercentage: Math.round(
            (homeStats.homeWins / homeStats.matchesPlayed) * 100
          ),
          form: homeStats.form,
          recentResults: this.parseFormToResults(homeStats.form),
        },
      },
      awayTeam: {
        id: fixture.awayTeam.id,
        name: fixture.awayTeam.name,
        logo: this.assetService.getTeamLogo(fixture.awayTeam.id, 256),
        primaryColor: fixture.awayTeam.primaryColor,
        position: awayStats.currentPosition,
        stats: {
          awayWinPercentage: Math.round(
            (awayStats.awayWins / awayStats.matchesPlayed) * 100
          ),
          form: awayStats.form,
          recentResults: this.parseFormToResults(awayStats.form),
        },
      },
      headToHead: {
        totalMatches: headToHead.totalMatches,
        homeTeamWins: headToHead.team1Wins,
        awayTeamWins: headToHead.team2Wins,
        draws: headToHead.draws,
        lastMatch: headToHead.lastMatchDate
          ? {
              date: headToHead.lastMatchDate.toISOString(),
              result: headToHead.lastMatchResult,
              winner: this.determineWinner(headToHead.lastMatchResult),
            }
          : undefined,
      },
    };
  }

  @Get()
  async getMatchList(
    @Query("date") date?: string,
    @Query("gameweek") gameweek?: number
  ): Promise<MatchListResponse> {
    const targetDate = date ? new Date(date) : new Date();
    const matches = await this.fixturesService.getMatchesForGameweek(
      gameweek,
      targetDate
    );

    return {
      gameweek: {
        number: gameweek,
        period: this.formatGameweekPeriod(matches),
        progress: this.calculateGameweekProgress(matches),
      },
      matches: matches.map((match) => ({
        id: match.id,
        date: match.matchDate.toISOString().split("T")[0],
        time: match.matchDate.toTimeString().substring(0, 5),
        homeTeam: {
          name: match.homeTeam.name,
          logo: this.assetService.getTeamLogo(match.homeTeam.id, 128),
          position: match.homeTeamStats?.currentPosition || 0,
        },
        awayTeam: {
          name: match.awayTeam.name,
          logo: this.assetService.getTeamLogo(match.awayTeam.id, 128),
          position: match.awayTeamStats?.currentPosition || 0,
        },
        venue: match.venue.name,
        status: this.mapMatchStatus(match.status),
        score:
          match.status === "FT"
            ? {
                home: match.homeScore,
                away: match.awayScore,
              }
            : undefined,
        userPrediction: match.userPrediction?.prediction, // From user service
      })),
    };
  }

  // Helper methods for data transformation
  private parseFormToResults(
    form: string
  ): Array<{ result: "1" | "X" | "2"; color: string }> {
    return form.split("").map((char) => ({
      result: char === "W" ? "1" : char === "D" ? "X" : "2",
      color: char === "W" ? "green" : char === "D" ? "yellow" : "red",
    }));
  }

  private calculateCountdown(matchDate: Date): {
    days: number;
    hours: number;
    minutes: number;
    seconds: number;
  } {
    const now = new Date();
    const diff = matchDate.getTime() - now.getTime();

    if (diff <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0 };

    return {
      days: Math.floor(diff / (1000 * 60 * 60 * 24)),
      hours: Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
      minutes: Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)),
      seconds: Math.floor((diff % (1000 * 60)) / 1000),
    };
  }
}
```

### **Team Statistics Service**

```typescript
@Injectable()
export class TeamStatsService {
  async calculateTeamStats(
    teamId: number,
    leagueId: number,
    season: number
  ): Promise<TeamStatistics> {
    // Get all matches for the team in current season
    const matches = await this.fixturesRepository.find({
      where: [
        { homeTeamId: teamId, leagueId, season, status: "FT" },
        { awayTeamId: teamId, leagueId, season, status: "FT" },
      ],
      order: { matchDate: "DESC" },
    });

    const stats = {
      matchesPlayed: matches.length,
      wins: 0,
      draws: 0,
      losses: 0,
      homeWins: 0,
      homeDraws: 0,
      homeLosses: 0,
      awayWins: 0,
      awayDraws: 0,
      awayLosses: 0,
      goalsFor: 0,
      goalsAgainst: 0,
      form: "", // Last 5 results
    };

    // Calculate statistics from matches
    const recentForm = [];

    for (const match of matches) {
      const isHome = match.homeTeamId === teamId;
      const teamScore = isHome ? match.homeScore : match.awayScore;
      const opponentScore = isHome ? match.awayScore : match.homeScore;

      stats.goalsFor += teamScore;
      stats.goalsAgainst += opponentScore;

      let result: "W" | "D" | "L";
      if (teamScore > opponentScore) {
        stats.wins++;
        if (isHome) stats.homeWins++;
        else stats.awayWins++;
        result = "W";
      } else if (teamScore === opponentScore) {
        stats.draws++;
        if (isHome) stats.homeDraws++;
        else stats.awayDraws++;
        result = "D";
      } else {
        stats.losses++;
        if (isHome) stats.homeLosses++;
        else stats.awayLosses++;
        result = "L";
      }

      if (recentForm.length < 5) {
        recentForm.push(result);
      }
    }

    stats.form = recentForm.join("");
    stats.winPercentage =
      stats.matchesPlayed > 0
        ? Math.round((stats.wins / stats.matchesPlayed) * 100)
        : 0;

    return stats;
  }
}
```

### **Asset CDN Integration**

```typescript
@Injectable()
export class AssetService {
  private readonly cdnBaseUrl = "https://cdn.swipick.com";

  getTeamLogo(teamId: number, size: 64 | 128 | 256 | 512 = 256): string {
    const team = this.getTeamById(teamId);
    const teamSlug = team.name.toLowerCase().replace(/\s+/g, "-");
    return `${this.cdnBaseUrl}/teams/${teamSlug}/logo-${size}.png`;
  }

  getLeagueBadge(leagueId: number, size: 128 | 256 = 128): string {
    const league = this.getLeagueById(leagueId);
    const leagueSlug = league.name.toLowerCase().replace(/\s+/g, "-");
    return `${this.cdnBaseUrl}/leagues/${leagueSlug}/badge-${size}.png`;
  }

  getVenueImage(venueId: number): string {
    const venue = this.getVenueById(venueId);
    const venueSlug = venue.name.toLowerCase().replace(/\s+/g, "-");
    return `${this.cdnBaseUrl}/venues/${venueSlug}/exterior.jpg`;
  }
}
```

### **Implementation Priority for Frontend**

**Phase 1: Core Match Data (Week 1)**

- ✅ Daily fixtures with team information
- ✅ Team logos and basic statistics
- ✅ Match countdown functionality
- ✅ Current league positions

**Phase 2: Enhanced Match Data (Week 2)**

- ✅ Win percentages and form calculation
- ✅ Head-to-head historical data
- ✅ Venue information and images
- ✅ Team color extraction from logos

**Phase 3: Real-time Features (Week 2)**

- ✅ Live match updates via WebSocket
- ✅ Real-time score and event streaming
- ✅ Match status indicators
- ✅ Live countdown updates

**Phase 4: Asset Optimization (Week 3)**

- ✅ CDN integration for fast asset delivery
- ✅ Multiple logo sizes for different screens
- ✅ Image processing and optimization
- ✅ Fallback assets for missing images

---

## 📊 **Data Quality Assurance**

### **Key Metrics**

```typescript
// Prometheus metrics
const apiRequestDuration = new Histogram({
  name: "api_football_request_duration_seconds",
  help: "API-FOOTBALL request duration",
  labelNames: ["endpoint", "status"],
});

const liveMatchesCount = new Gauge({
  name: "live_matches_count",
  help: "Number of currently live matches",
});

const websocketConnections = new Gauge({
  name: "websocket_connections_total",
  help: "Number of active WebSocket connections",
});

const dailyQuotaUsage = new Gauge({
  name: "api_football_quota_used",
  help: "Daily API quota usage",
});
```

### **Alerting Rules**

- 🚨 **High Error Rate**: > 5% API errors in 5 minutes
- 🐌 **Slow Response**: API response time > 2 seconds
- 📈 **Quota Usage**: > 90% daily quota consumed
- 🔌 **Connection Issues**: WebSocket connections drop > 50%
- 💾 **Database Issues**: Query time > 1 second

---

## 🚀 **Deployment Configuration**

### **Container Configuration**

```dockerfile
# Gaming Services Containerfile
FROM node:20-alpine AS production

LABEL maintainer="Swipick Development Team"
LABEL description="Swipick Gaming Services - API-FOOTBALL Integration"

# Create non-root user
RUN addgroup -g 1001 -S appgroup && \
    adduser -S appuser -u 1001 -G appgroup

WORKDIR /app
RUN chown -R 1001:1001 /app

# Copy application files
COPY --chown=1001:1001 dist ./dist
COPY --chown=1001:1001 node_modules ./node_modules
COPY --chown=1001:1001 package*.json ./

USER 1001:1001

# Expose ports
EXPOSE 3000 3001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:3000/health || exit 1

# Start application
CMD ["node", "dist/main.js"]
```

### **Environment Configuration (MVP)**

```bash
# Gaming Services Environment Variables (MVP)
NODE_ENV=production
PORT=3000
WEBSOCKET_PORT=3001

# Database
DATABASE_HOST=postgres
DATABASE_PORT=5432
DATABASE_NAME=swipick_gaming
DATABASE_USER=gaming_user
DATABASE_PASSWORD=${DB_PASSWORD}

# Redis
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=${REDIS_PASSWORD}

# API-FOOTBALL (MVP - Simple approach)
API_FOOTBALL_BASE_URL=https://v3.football.api-sports.io
API_FOOTBALL_KEY=${API_FOOTBALL_KEY}
API_FOOTBALL_BACKUP_KEY=${API_FOOTBALL_BACKUP_KEY} # Optional fallback
API_FOOTBALL_TIER=basic # basic or free

# Monitoring (Optional for MVP)
PROMETHEUS_ENABLED=false
LOG_LEVEL=info
HEALTH_CHECK_INTERVAL=30000
```

---

## ✅ **Acceptance Criteria**

### **Functional Requirements**

- ✅ **Daily Fixtures**: System fetches and caches daily fixtures at midnight UTC
- ✅ **Live Updates**: System updates live matches every 15 seconds during match hours
- ✅ **WebSocket**: Clients can subscribe to match updates and receive real-time data
- ✅ **Team Data**: System maintains current team and player information
- ✅ **Error Handling**: System gracefully handles API failures and quota limits
- ✅ **Caching**: 90%+ cache hit rate for frequently accessed data

### **Non-Functional Requirements**

- ✅ **Performance**: API responses < 500ms for cached data
- ✅ **Reliability**: 99.9% uptime with circuit breaker protection
- ✅ **Scalability**: Support 1000+ concurrent WebSocket connections
- ✅ **Security**: API keys rotated and stored securely in AWS Secrets Manager
- ✅ **Monitoring**: Comprehensive metrics and alerting in place
- ✅ **Documentation**: Complete API documentation and integration guides

### **Testing Requirements**

- ✅ **Unit Tests**: 85%+ code coverage
- ✅ **Integration Tests**: All API endpoints tested
- ✅ **E2E Tests**: Complete user workflows tested
- ✅ **Load Tests**: Performance validated under expected load
- ✅ **Chaos Engineering**: System resilience validated

---

## 🔄 **Integration Points**

### **Internal Services**

- **BFF Service**: Provides gaming data to frontend applications
- **User Service**: Links match predictions to user profiles (future)
- **Notification Service**: Basic alerts for match events (future)

### **External Services**

- **API-FOOTBALL**: Primary data source for match information
- **PostgreSQL**: Primary data persistence
- **Redis**: Caching and session storage

---

## 📅 **Timeline & Milestones**

| **Week**   | **Phase**            | **Key Deliverables**                          | **Success Criteria**                       |
| ---------- | -------------------- | --------------------------------------------- | ------------------------------------------ |
| **Week 1** | Infrastructure       | Project setup, DB schema, basic API client    | Health checks pass, DB migrations complete |
| **Week 2** | Core Features        | Fixture sync, live updates, WebSocket gateway | Daily fixtures sync, live updates working  |
| **Week 3** | Advanced Features    | Monitoring, optimization, documentation       | Performance targets met, docs complete     |
| **Week 4** | Testing & Deployment | Load testing, production deployment           | All tests pass, production ready           |

---

## 🚨 **Risk Assessment**

### **High Risk**

- **API Rate Limits**: API-FOOTBALL quota exhaustion
  - _Mitigation_: Circuit breaker, simple quota tracking, backup API key (optional)
- **Live Data Accuracy**: 15-second update frequency may miss rapid events
  - _Mitigation_: Event reconciliation, manual override capability

### **Medium Risk**

- **Database Performance**: Large dataset queries may be slow
  - _Mitigation_: Basic query optimization, proper indexing
- **WebSocket Scalability**: High concurrent connection load
  - _Mitigation_: Connection pooling, basic load balancing

### **Low Risk**

- **Third-party Dependencies**: NPM package vulnerabilities
  - _Mitigation_: Regular dependency updates
- **Configuration Management**: Environment variable security
  - _Mitigation_: Secure environment variable handling, .env files not committed

---

## 📚 **Resources & References**

### **Documentation**

- [API-FOOTBALL Documentation](https://www.api-football.com/documentation-v3)
- [NestJS WebSocket Documentation](https://docs.nestjs.com/websockets/gateways)
- [PostgreSQL Performance Tuning](https://wiki.postgresql.org/wiki/Performance_Optimization)
- [Redis Caching Best Practices](https://redis.io/docs/manual/patterns/)

### **Code Examples**

- [Circuit Breaker Pattern](https://github.com/nodeshift/opossum)
- [WebSocket with NestJS](https://github.com/nestjs/nest/tree/master/sample/02-gateways)
- [AWS Secrets Manager SDK](https://docs.aws.amazon.com/secretsmanager/latest/userguide/retrieving-secrets_lambda.html)

### **Tools & Libraries**

- **HTTP Client**: `@nestjs/axios`
- **WebSocket**: `@nestjs/websockets`
- **Database**: `@nestjs/typeorm`, `pg`
- **Caching**: `@nestjs/cache-manager`, `cache-manager-redis-store`
- **Monitoring**: `@prometheus-prom/client`
- **Testing**: `@nestjs/testing`, `supertest`

---

## 👥 **Team & Responsibilities**

### **Development Team**

- **Lead Developer**: Architecture design, core API integration
- **Backend Developer**: Database design, caching implementation
- **DevOps Engineer**: Container setup, monitoring, deployment
- **QA Engineer**: Testing strategy, load testing, validation

### **Stakeholders**

- **Product Manager**: Requirements validation, acceptance criteria
- **Frontend Team**: API contract definition, real-time integration
- **Infrastructure Team**: Database setup, monitoring configuration

---

## 📝 **Notes & Assumptions**

### **Technical Assumptions**

- API-FOOTBALL service availability > 99%
- Database can handle 10,000+ fixtures per day
- Redis cluster can support 15-second TTL caching
- WebSocket can maintain 1000+ concurrent connections

### **Business Assumptions**

- Users primarily interested in major European leagues
- Peak usage during match hours (weekends, evenings)
- Real-time updates more critical than historical data accuracy
- Future expansion to include betting odds and predictions

### **Infrastructure Assumptions (MVP)**

- Container deployment with basic orchestration
- Single database instance (PostgreSQL)
- Single Redis instance for caching
- Environment variable-based configuration
- Basic monitoring and logging

---

**📅 Created:** 2025-08-04  
**👤 Created By:** Development Team  
**🏷️ Tags:** gaming-services, api-football, real-time, websocket, core-feature  
**🔗 Related Tickets:** DBG-20250801-002 (resolved)

---

_This implementation ticket serves as the comprehensive guide for building the core gaming services container that will power the Swipick football prediction platform._
