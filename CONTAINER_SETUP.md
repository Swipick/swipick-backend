# Swipick Backend - Podman Container Setup

## Overview

The Swipick backend now uses **Podman** for containerization with a **BFF (Backend-for-Frontend)** architecture to support both mobile and web frontends.

## Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │────│   BFF Service   │────│ Gaming Services │
│ (Mobile/Web)    │    │   Port: 9000    │    │   Port: 3000    │
│                 │    │                 │    │ WebSocket: 3001 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                              │                        │
                    ┌─────────────────┐    ┌─────────────────┐
                    │   PostgreSQL    │    │  API-FOOTBALL   │
                    │   Port: 5432    │    │    Service      │
                    └─────────────────┘    └─────────────────┘
                              │
                    ┌─────────────────┐
                    │     Redis       │
                    │   Port: 6379    │
                    └─────────────────┘
```

## Services

### BFF Service (Backend-for-Frontend)
- **Purpose**: Aggregates data from multiple services for frontend consumption
- **Port**: 9000
- **Container**: `swipick-bff`
- **No Authentication**: Firebase handles all auth on frontend

### Gaming Services
- **Purpose**: API-FOOTBALL integration and real-time match data
- **Ports**: 3000 (HTTP), 3001 (WebSocket)
- **Container**: `swipick-gaming-services`
- **Features**: Real-time updates, caching, API integration

### PostgreSQL Database
- **Purpose**: Persistent data storage
- **Port**: 5432 (production), 5433 (development)
- **Container**: `swipick-postgres`

### Redis Cache
- **Purpose**: Caching and session management
- **Port**: 6379 (production), 6380 (development)
- **Container**: `swipick-redis`

## Container Files

### Production Containers
- `apps/backend/bff/Containerfile` - BFF production container
- `apps/backend/gaming-services/Containerfile` - Gaming services production container

### Development Containers  
- `apps/backend/bff/Containerfile.dev` - BFF development with hot reload
- `apps/backend/gaming-services/Containerfile.dev` - Gaming services development with hot reload

### Compose Files
- `compose.yml` - Production orchestration
- `compose.dev.yml` - Development orchestration with hot reload

## Quick Start

### 1. Environment Setup
```bash
# Copy environment template
cp .env.example .env

# Edit .env with your values
nano .env
```

### 2. Production Deployment
```bash
# Start all services
./start-production.sh

# Or manually
podman-compose -f compose.yml up -d
```

### 3. Development Environment
```bash
# Start with hot reload
./start-development.sh

# Or manually
podman-compose -f compose.dev.yml up -d
```

## Environment Variables

### Required Variables
```bash
POSTGRES_PASSWORD=your_secure_postgres_password_here
API_FOOTBALL_KEY=your_api_football_key_here
```

### Optional Variables
```bash
REDIS_PASSWORD=your_secure_redis_password_here
NODE_ENV=production
LOG_LEVEL=info
```

## Service URLs

### Production
- BFF: http://localhost:9000
- Gaming Services: http://localhost:3000
- WebSocket: ws://localhost:3001
- Database: localhost:5432
- Redis: localhost:6379

### Development
- BFF: http://localhost:9000 (hot reload)
- Gaming Services: http://localhost:3000 (hot reload)
- WebSocket: ws://localhost:3001
- Database: localhost:5433
- Redis: localhost:6380

## Health Checks

- BFF Health: http://localhost:9000/health
- Gaming Services Health: http://localhost:3000/health

## Common Commands

### View Logs
```bash
# All services
podman-compose -f compose.yml logs -f

# Specific service
podman-compose -f compose.yml logs -f bff
```

### Stop Services
```bash
# Stop (containers remain)
podman-compose -f compose.yml stop

# Stop and remove containers
podman-compose -f compose.yml down

# Stop, remove containers and volumes
podman-compose -f compose.yml down -v
```

### Rebuild Containers
```bash
# Rebuild all
podman-compose -f compose.yml build

# Rebuild specific service
podman-compose -f compose.yml build bff
```

## Firebase Authentication

The BFF service **does not handle authentication**. All authentication is handled by Firebase on the frontend. The BFF service trusts that the frontend has properly authenticated users before making requests.

## API-FOOTBALL Integration

The Gaming Services container handles all API-FOOTBALL integration:
- Fixture data fetching
- Team information
- Live match updates
- Real-time WebSocket notifications

## Database Migrations

Database migrations are handled automatically when containers start. The init script will create the necessary tables and relationships.

## Troubleshooting

### Container Build Issues
```bash
# Clear build cache
podman system prune -f

# Rebuild from scratch
podman-compose -f compose.yml build --no-cache
```

### Service Connection Issues
```bash
# Check network connectivity
podman network ls
podman network inspect swipick-network
```

### Database Issues
```bash
# Connect to database
podman exec -it swipick-postgres psql -U postgres -d swipick_gaming
```

### Redis Issues
```bash
# Connect to Redis
podman exec -it swipick-redis redis-cli
```
