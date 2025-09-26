# API-Football Integration Documentation

## Overview
This document maps the complete API-Football integration for the Swipick live mode gaming system. The integration uses API-Football Pro account to fetch Serie A fixtures, teams, and live match data.

## API-Football Endpoints Used

### 1. Fixtures Endpoint
**Endpoint**: `https://v3.football.api-sports.io/fixtures`
**Purpose**: Fetch Serie A fixtures for specific dates
**Implementation**: `apps/backend/gaming-services/src/modules/api-football/api-football.service.ts:getDailyFixtures()`
**Parameters**:
- `league`: 135 (Serie A)
- `season`: 2024
- `date`: YYYY-MM-DD format
**Cache**: 24 hours TTL
**Rate Limit**: Tracked in circuit breaker

### 2. Live Fixtures Endpoint
**Endpoint**: `https://v3.football.api-sports.io/fixtures`
**Purpose**: Fetch live/in-progress Serie A matches
**Implementation**: `apps/backend/gaming-services/src/modules/api-football/api-football.service.ts:getLiveMatches()`
**Parameters**:
- `league`: 135 (Serie A)
- `season`: 2024
- `live`: all
**Cache**: 15 seconds TTL (frequent updates for live data)

### 3. Teams Endpoint
**Endpoint**: `https://v3.football.api-sports.io/teams`
**Purpose**: Fetch Serie A team information and logos
**Implementation**: `apps/backend/gaming-services/src/modules/api-football/api-football.service.ts:getTeams()`
**Parameters**:
- `league`: 135 (Serie A)
- `season`: 2024
**Cache**: 7 days TTL (team data changes infrequently)

### 4. Team Statistics Endpoint
**Endpoint**: `https://v3.football.api-sports.io/teams/statistics`
**Purpose**: Fetch detailed team statistics
**Implementation**: `apps/backend/gaming-services/src/modules/api-football/api-football.client.ts`
**Parameters**:
- `league`: 135 (Serie A)
- `season`: 2024
- `team`: {team_id}
**Cache**: Configurable TTL

### 5. API Status Endpoint
**Endpoint**: `https://v3.football.api-sports.io/status`
**Purpose**: Check API quota and account status
**Implementation**: `apps/backend/gaming-services/src/modules/api-football/api-football.client.ts:checkApiStatus()`
**Cache**: None (real-time quota monitoring)

## Database Tables

### 1. Fixtures Table (`fixtures`)
**Entity**: `apps/backend/gaming-services/src/entities/fixture.entity.ts`
**Purpose**: Store Serie A match fixtures from API-Football
**Key Fields**:
- `id`: Primary key (auto-increment)
- `external_api_id`: API-Football fixture ID
- `home_team`: Home team name
- `away_team`: Away team name
- `match_date`: Match timestamp
- `week`: Serie A week number (1-38)
- `result`: Match result ('1', 'X', '2', or null)
- `home_score`: Home team score
- `away_score`: Away team score
- `status`: Match status from API-Football
- `created_at`: Record creation timestamp
- `updated_at`: Record update timestamp

### 2. Predictions Table (`specs`)
**Entity**: `apps/backend/gaming-services/src/entities/spec.entity.ts`
**Purpose**: Store user predictions for live mode fixtures
**Key Fields**:
- `id`: Primary key (auto-increment)
- `user_id`: Firebase UID (string)
- `fixture_id`: Foreign key to fixtures table
- `choice`: User prediction ('1', 'X', '2', 'SKIP')
- `result`: Actual match result
- `correct`: Boolean - prediction correctness
- `week`: Serie A week number
- `mode`: Always 'live' for this flow
- `created_at`: Prediction timestamp
- `updated_at`: Update timestamp

**Unique Constraint**: (user_id, fixture_id) - prevents duplicate predictions

## Live Mode Prediction Storage Flow

### Frontend Flow (`/gioca` page)
1. **Page Load**: `apps/frontend/frontend-service/app/gioca/page.tsx`
   - Uses `useLiveWeek()` hook to determine current Serie A week
   - Uses `useFixtures()` hook to load fixtures for current week
   - Uses `usePredictions()` hook to manage prediction state

2. **Fixture Loading**: `apps/frontend/frontend-service/app/gioca/hooks/useFixtures.ts`
   - Calls `apiClient.getFixturesByWeek(targetWeek)`
   - Maps database fixtures to frontend Fixture interface
   - Handles loading states and error handling

3. **Prediction Submission**: `apps/frontend/frontend-service/app/gioca/hooks/usePredictions.ts`
   - User swipes card to make prediction
   - Calls `apiClient.savePrediction()` with:
     ```javascript
     {
       userId: string,      // Firebase UID
       fixtureId: number,   // Fixture ID from database
       choice: '1'|'X'|'2', // User's prediction
     }
     ```
   - Mode parameter: 'live'
   - Persists to localStorage for offline resilience

### API Client Layer
**File**: `apps/frontend/frontend-service/lib/api-client.ts`
- `savePrediction()` method calls BFF endpoint
- Converts fixtureId to string for backend compatibility
- Adds comprehensive logging for debugging
- Handles 30-second request timeout

### BFF Layer (Backend For Frontend)
**File**: `apps/backend/bff/src/app.controller.ts`
- Endpoint: `POST /api/predictions`
- Interface: `CreatePredictionDto`
  ```typescript
  {
    userId: number,
    mode: 'live' | 'test',
    fixtureId: number,
    choice: '1' | 'X' | '2' | 'SKIP'
  }
  ```
- Routes to Gaming Services via `appService.forwardToGamingServices()`

### Gaming Services Layer
**File**: `apps/backend/gaming-services/src/modules/specs/specs.controller.ts`
- Endpoint: `POST /api/predictions`
- Routes to `SpecsService.createPrediction()` based on mode
- Live mode: calls `createLivePrediction()`
- Handles unified prediction creation for both modes

**Service**: `apps/backend/gaming-services/src/modules/specs/specs.service.ts`
- `createLivePrediction()` method:
  1. Validates fixture exists in database
  2. Checks for duplicate predictions (user_id + fixture_id unique constraint)
  3. Creates new spec record in database
  4. Returns created prediction with fixture details

## Circuit Breaker & Rate Limiting

### Circuit Breaker Implementation
**File**: `apps/backend/gaming-services/src/modules/api-football/api-football.client.ts`
- Tracks request counts (daily and per-minute)
- Implements exponential backoff on failures
- Automatic circuit opening on repeated failures
- Health check recovery mechanism

### Rate Limiting Strategy
- **Daily Limit**: Configurable based on Pro account quota
- **Per-Minute Limit**: Prevents burst traffic issues
- **Request Tracking**: In-memory counters with TTL
- **Graceful Degradation**: Returns cached data when limits approached

### Caching Strategy
- **Live Fixtures**: 15 seconds (frequent updates needed)
- **Daily Fixtures**: 24 hours (daily schedule changes)
- **Teams**: 7 days (static team information)
- **Statistics**: Configurable based on data volatility

## Pro Account Activation Checklist

### 1. Environment Configuration ✅ COMPLETED
- [x] Update `API_FOOTBALL_KEY` with Pro account key (`8b6eae1b729c38e5c9104fd622723236`)
- [x] Verify `API_FOOTBALL_BASE_URL` endpoint (`https://v3.football.api-sports.io`)
- [x] Configure rate limits for Pro quota levels (`API_FOOTBALL_TIER=pro`)
- [x] Update circuit breaker thresholds (automatic via tier configuration)

### 2. Rate Limit Adjustments ✅ COMPLETED
- [x] Increase daily request limit (10,000 requests/day)
- [x] Adjust per-minute request ceiling (100 requests/minute)
- [x] Update circuit breaker failure thresholds (5 concurrent requests)
- [ ] Configure quota monitoring alerts

### 3. Monitoring Setup
- [x] Enable API quota tracking (built into client)
- [x] Set up rate limit monitoring (automatic counters)
- [x] Configure circuit breaker alerts (logger integration)
- [ ] Monitor cache hit ratios

### 4. Testing Protocol
- [ ] Test fixture synchronization
- [ ] Verify live match updates
- [ ] Test prediction submission flow
- [ ] Validate error handling scenarios
- [ ] Load test with Pro rate limits

## API Call Flow Diagram

```
Frontend (/gioca)
    ↓ getFixturesByWeek()
BFF (/api/fixtures/week/:week)
    ↓ forwardToGamingServices()
Gaming Services (/api/fixtures/week/:week)
    ↓ Database Query
PostgreSQL (fixtures table)
    ↑ Return fixtures
    ↓ User makes prediction
Frontend (savePrediction)
    ↓ POST /api/predictions
BFF (/api/predictions)
    ↓ forwardToGamingServices()
Gaming Services (/api/predictions)
    ↓ createLivePrediction()
PostgreSQL (specs table)
```

## Key Integration Points

1. **Fixture Sync**: Daily cron job syncs API-Football data to local database
2. **Live Updates**: Real-time polling of live matches every 15 seconds
3. **User Predictions**: Immediate storage in local database with conflict prevention
4. **Result Processing**: Batch processing of match results to update prediction accuracy
5. **Cache Management**: Multi-tier caching strategy balances performance and data freshness

This integration provides a robust, scalable foundation for the live mode gaming experience while efficiently managing API quota usage through the Pro account.