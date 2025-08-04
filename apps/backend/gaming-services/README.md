# 🏈 Gaming Services Container

The Gaming Services Container is the core microservice responsible for integrating with API-FOOTBALL to provide real-time football data, match fixtures, team information, and live updates to the Swipick prediction game platform.

## 🚀 Quick Start

### Prerequisites

- Node.js 20+
- PostgreSQL 14+
- Redis 7+
- API-FOOTBALL API key

### Environment Variables

Create a `.env` file in the root directory:

```bash
# Application
NODE_ENV=development
PORT=3000
WEBSOCKET_PORT=3001

# Database
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_NAME=swipick_gaming
DATABASE_USER=gaming_user
DATABASE_PASSWORD=your_password

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=your_redis_password

# API-FOOTBALL
API_FOOTBALL_BASE_URL=https://v3.football.api-sports.io
API_FOOTBALL_KEY=your_api_key
API_FOOTBALL_BACKUP_KEY=backup_key_optional
API_FOOTBALL_TIER=basic

# Monitoring (Optional for MVP)
PROMETHEUS_ENABLED=false
LOG_LEVEL=info
HEALTH_CHECK_INTERVAL=30000
```

### Development

```bash
# Install dependencies
npm install

# Start in development mode
npm run start:dev

# Run tests
npm run test

# Run e2e tests
npm run test:e2e
```

### Production with Containers

```bash
# Build production container
podman build -f Containerfile -t gaming-services:latest .

# Run container
podman run -d \
  --name gaming-services \
  --env-file .env \
  -p 3000:3000 \
  -p 3001:3001 \
  gaming-services:latest
```

## 📊 API Endpoints

### Health Checks

- `GET /api/health` - Overall health status
- `GET /api/health/ready` - Readiness check
- `GET /api/health/live` - Liveness check

### Fixtures

- `GET /api/fixtures` - Get fixtures (query: date, gameweek)
- `GET /api/fixtures/live` - Get live matches
- `GET /api/fixtures/:id` - Get specific fixture
- `POST /api/fixtures/sync` - Sync fixtures for date

### Teams

- `GET /api/teams` - Get teams (query: id, name, league, season)
- `GET /api/teams/:id` - Get specific team
- `GET /api/teams/:id/statistics` - Get team statistics
- `GET /api/teams/:id1/vs/:id2` - Get head-to-head data

## 🔄 WebSocket Events

### Client → Server

- `subscribe_match` - Subscribe to match updates
- `unsubscribe_match` - Unsubscribe from match updates
- `get_live_matches` - Get current live matches

### Server → Client

- `match_update` - Live match update
- `fixtures_update` - Fixture list update
- `live_matches` - Current live matches response

## 🛡️ Security Features

- Non-root container execution
- API rate limiting and circuit breaker
- Environment variable-based configuration
- Health check endpoints
- Request timeout handling

## 📈 Monitoring

- Health check endpoints for container orchestration
- Structured logging with configurable levels
- WebSocket connection tracking
- API usage tracking and quota management

## 🧪 Testing

```bash
# Unit tests
npm run test

# E2E tests
npm run test:e2e

# Test coverage
npm run test:cov
```

## 🔧 Configuration

The service uses environment-based configuration with the following key areas:

- **Database**: PostgreSQL connection settings
- **Cache**: Redis configuration for caching layer
- **API-FOOTBALL**: External API configuration and rate limits
- **WebSocket**: Real-time communication settings
- **Monitoring**: Health checks and logging configuration

## 📝 Development Notes

This is an MVP implementation with the following characteristics:

- Simple in-memory rate limiting (production would use Redis)
- Environment variable-based API key management
- Basic caching strategy
- Health checks for container orchestration
- WebSocket support for real-time updates

For production deployment beyond MVP, consider:

- Redis-based rate limiting
- Database migrations and connection pooling
- Advanced monitoring with Prometheus
- API key rotation mechanisms
- Horizontal scaling considerations

## 🏗️ Architecture

The service follows a modular architecture with:

- **API-FOOTBALL Module**: External API integration
- **Fixtures Module**: Match fixture management
- **Teams Module**: Team and player data
- **Live Updates Module**: Real-time WebSocket updates
- **Cache Module**: Caching layer abstraction
- **Health Module**: Health check endpoints

Each module is independently testable and follows NestJS best practices.
