# Live Match Polling Mechanics

## Overview
The Swipick backend uses an intelligent checkpoint-based polling system to monitor live football matches and update fixture data. This system is designed to be efficient with API calls while providing timely updates for match start times and final results.

## System Architecture

### Core Components
- **`LiveUpdatesScheduler`** - Main cron job orchestrator
- **`SimpleMatchPollingService`** - Smart checkpoint-based polling logic
- **`LiveUpdatesService`** - Processes live match data updates
- **`ApiFootballService`** - External API integration (api-sports.io)
- **`DatabasePersistenceService`** - Handles fixture table updates
- **`FixturesService`** - Manages fixture data operations

## Polling Strategy: Smart Checkpoints

### Core Concept
Instead of continuous polling, the system uses **strategic checkpoints** to minimize API usage while ensuring accurate data.

### Checkpoint Timeline
```
Match Scheduled: 15:00
├─ 15:05 (Kickoff+5min) → Check if match started
├─ 16:45 (Kickoff+105min) → Check if match finished
└─ Done → No more polling for this match
```

### Configuration Constants
```typescript
KICKOFF_BUFFER_MINUTES = 5    // Check start 5 minutes after scheduled time
MATCH_DURATION_MINUTES = 105  // Check end after 105 minutes (90min + 15min stoppage)
```

## Match Checkpoint System

### Checkpoint Structure
Each match maintains a checkpoint object:
```typescript
interface MatchCheckpoint {
  id: string;
  homeTeam: string;
  awayTeam: string;
  scheduledTime: Date;
  kickoffChecked: boolean;    // Has kickoff verification been completed?
  endChecked: boolean;        // Has final whistle check been completed?
  status: 'SCHEDULED' | 'LIVE' | 'FINISHED';
}
```

### Status Progression
1. **`SCHEDULED`** → Match created, awaiting kickoff checkpoint
2. **`LIVE`** → Kickoff confirmed, awaiting final whistle checkpoint
3. **`FINISHED`** → Final whistle confirmed, polling complete

## Scheduling System

### Cron Jobs
```typescript
// Main checkpoint checker - runs every 5 minutes
@Cron('*/5 * * * *')
async checkMatchCheckpoints()

// Live updates during match hours - every 5 minutes (12:00-23:00 UTC)
@Cron('*/5 * 12-23 * * *')
async handleLiveUpdates()

// Daily fixture sync - midnight UTC
@Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
async syncDailyFixtures()

// Health monitoring - every minute
@Cron(CronExpression.EVERY_MINUTE)
async healthCheck()
```

## API Budget Management

### Daily Limits
- **Maximum API Calls**: 50 per day
- **Efficiency Target**: ~2 calls per match
- **Typical Usage**: 10 matches = ~20 calls (40% of quota)

### Budget Status Levels
- **HEALTHY**: < 50% quota used (< 25 calls)
- **MODERATE**: 50-80% quota used (25-40 calls)
- **HIGH**: 80-95% quota used (40-47 calls)
- **CRITICAL**: > 95% quota used (> 47 calls)

### Budget Protection
- **Circuit Breaker**: Blocks API calls after 5 consecutive failures
- **Fallback Strategy**: Uses cached/database data when quota exceeded
- **Smart Queuing**: Only makes calls when checkpoints are reached

## Database Updates

### Fixture Entity Updates
When checkpoints are reached, the system updates:
```sql
-- Kickoff Detection
UPDATE fixtures SET
  status = 'LIVE',
  updated_at = NOW()
WHERE id = ?

-- Final Whistle Detection
UPDATE fixtures SET
  home_score = ?,
  away_score = ?,
  status = 'FINISHED',
  result = ?, -- '1', 'X', or '2'
  updated_at = NOW()
WHERE id = ?
```

### Result Calculation Logic
```typescript
// Determine match result based on final scores
const result = homeScore > awayScore ? '1' :
               homeScore < awayScore ? '2' : 'X';
```

## Caching Strategy

### Multi-Layer Caching
1. **Redis Cache** (Primary):
   - Live matches: 2 minutes TTL
   - Daily fixtures: 15 minutes TTL
   - Serie A fixtures: 4 hours TTL

2. **In-Memory Cache** (Fallback):
   - Used when Redis unavailable
   - Configurable TTL per data type

3. **Database Persistence** (Final Fallback):
   - Long-term storage for all fixtures
   - 30-day data retention policy

## Error Handling & Resilience

### Fault Tolerance
- **Circuit Breaker Pattern**: Prevents cascading API failures
- **Exponential Backoff**: Progressive retry delays (max 3 attempts)
- **Graceful Degradation**: Falls back to stale data when APIs fail
- **Health Monitoring**: Continuous system status checks

### Failure Recovery
```typescript
// Retry logic with exponential backoff
const maxRetries = 3;
const baseDelay = 1000; // 1 second
const backoffFactor = 2;

for (let attempt = 1; attempt <= maxRetries; attempt++) {
  try {
    return await apiCall();
  } catch (error) {
    if (attempt === maxRetries) throw error;
    await delay(baseDelay * Math.pow(backoffFactor, attempt - 1));
  }
}
```

## Real-time Communication

### WebSocket Integration
- **Gateway**: `LiveUpdatesGateway` manages connections
- **Room-based Updates**: Clients subscribe to specific matches
- **Event Types**:
  - `match_update`: Individual match status/score changes
  - `fixtures_update`: Bulk fixture updates

### Broadcasting Flow
```
API Update → Database → Cache → WebSocket Broadcast → Frontend
```

## Environment Configuration

### Required Environment Variables
```bash
# Core Settings
DISABLE_LIVE_UPDATES=false           # Enable/disable entire system
API_FOOTBALL_KEY=your_api_key        # API-Football authentication
API_FOOTBALL_URL=https://api-football-v1.p.rapidapi.com/v3

# Database
DATABASE_URL=postgresql://...        # Primary database connection

# Cache (Optional)
REDIS_URL=redis://...               # Redis cache connection

# System
NODE_ENV=production                 # Environment mode
PORT=3002                          # Service port
```

### Toggle Controls
- **Complete Disable**: `DISABLE_LIVE_UPDATES=true`
- **API Disable**: Remove `API_FOOTBALL_KEY`
- **Cache Disable**: Remove `REDIS_URL` (falls back to memory)

## Monitoring & Debugging

### Key Log Messages
```
[LiveUpdatesScheduler] Starting live matches update...
[SimpleMatchPollingService] Checking match checkpoints for 2025-09-20
[SimpleMatchPollingService] Kickoff checkpoint reached for match [ID]
[ApiFootballService] Fetching live matches from API-Football
[DatabasePersistenceService] Updated fixture [ID] with final score H:A
[LiveUpdatesGateway] Broadcasting match_update to room [matchId]
```

### Debug Flags
```bash
# Enable detailed logging
DEBUG=live-updates:*
NODE_ENV=development
```

## Performance Characteristics

### Efficiency Metrics
- **API Calls per Match**: ~2 (kickoff + final whistle)
- **Response Time**: < 2 seconds for checkpoint checks
- **Memory Usage**: ~50MB for checkpoint cache
- **Database Impact**: Minimal (only updates on status changes)

### Scalability
- **Concurrent Matches**: Up to 25 matches per day (within 50-call budget)
- **Peak Load**: 10 Serie A matches = 20 API calls
- **Off-peak**: Zero API calls when no checkpoints due

## Troubleshooting

### Common Issues

1. **No Updates Occurring**
   - Check: `DISABLE_LIVE_UPDATES` environment variable
   - Verify: API key validity and quota remaining
   - Monitor: Circuit breaker status

2. **Missing Score Updates**
   - Check: Match kickoff times in database
   - Verify: Checkpoint calculation logic
   - Review: API response format changes

3. **High API Usage**
   - Monitor: Checkpoint efficiency ratios
   - Review: Failed call retry patterns
   - Adjust: Buffer timing if needed

### Health Check Endpoints
```
GET /health              # Basic service health
GET /health/full         # Detailed system status
GET /fixtures/quota/status # API quota and usage stats
```

---

## Summary

This intelligent polling system provides efficient live match monitoring with:
- **Minimal API Usage**: 2 calls per match vs. continuous polling
- **Smart Timing**: Checkpoints at kickoff+5min and final whistle+105min
- **Robust Fallbacks**: Multi-layer caching and graceful degradation
- **Real-time Updates**: WebSocket broadcasting to connected clients
- **Budget Awareness**: Stays well within 50-call daily limits

The system balances timeliness with efficiency, ensuring accurate match data while respecting external API constraints.