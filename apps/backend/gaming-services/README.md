# ⚽ Gaming Services (1 × 2 Speculation Game Backend)

Gaming Services powers Swipick’s football speculation game using the classic “1 × 2” system. This is not gambling; it’s pure predictions and engagement. The service integrates with API-FOOTBALL for fixtures/results and exposes both live-mode and test-mode APIs.

## 🎯 Game Concept: "1 × 2"

Each match has three outcomes:

- 1 → Home win
- X → Draw (pareggio)
- 2 → Away win

Frontend inputs:

- Swipe left or press 1 → Home Win
- Swipe up or press X → Draw
- Swipe right or press 2 → Away Win
- Swipe down or press Skip → Defer this match (send card to back of deck; does not consume a turn)

Rules: outcomes are based on the final score at 90' (+stoppage), no extra time or penalties.

## 📊 Core Mechanics

- 10 turns per week (one per match in the Serie A matchday)
- All cards must ultimately get a 1 / X / 2 selection; Skip only defers the card (it goes to the back of the deck and resurfaces later)
- Scoring:
  - Correct → 1 point
  - Incorrect → 0 points
  - Skip → not stored as a choice and does not consume a turn (pure defer)
- Weekly and cumulative success are based only on answered matches; by the end of the week the denominator is 10

Example: 38 games, 22 correct → success_rate = 22 / 38 = 57.89%

## 🧱 Data Model (Neon Postgres)

Production uses Neon for managed Postgres. Core tables:

- fixtures: API-FOOTBALL fixtures (live mode)
- specs: live-mode user speculations (UUID ids)
- test_fixtures: historical Serie A fixtures (test mode)
- test_specs: test-mode speculations with numeric user ids

Key fields:

- specs: id (UUID), user_id (UUID), fixture_id (UUID), choice ENUM('1','X','2','SKIP'), result ENUM('1','X','2'), correct BOOL, week INT, created_at
- test_specs: id SERIAL, userId INT, fixtureId INT, week INT, choice ENUM('1','X','2','SKIP'), isCorrect BOOL, countsTowardPercentage BOOL, createdAt/updatedAt

Notes:

- Skip is a defer action, not a stored choice, and does not count as a turn; the card returns to the back of the deck until the user selects 1 / X / 2.
- Unique(user, fixture) is enforced to prevent duplicates. Test-mode create is idempotent.

## 🔌 REST API

Health:

- GET /api/health

Fixtures:

- GET /api/fixtures
- GET /api/fixtures/live
- GET /api/fixtures/:id
- POST /api/fixtures/sync

Live Predictions (specs):

- POST /api/predictions
- GET /api/predictions/user/:userId/week/:week
- GET /api/predictions/user/:userId/summary

Test Mode:

- POST /api/test-mode/predictions
- GET /api/test-mode/fixtures/week/:week
- GET /api/test-mode/weeks
- GET /api/test-mode/predictions/user/:userId/week/:week
- GET /api/test-mode/predictions/user/:userId/summary
- POST /api/test-mode/seed
- DELETE /api/test-mode/reset/:userId

Match Cards (test-mode):

- GET /api/test-mode/match-cards/week/:week — returns the 10 fixtures for the requested week, pre-ordered by kickoff and ready to be rendered as a stacked deck (Skip on the client defers and re-queues the card)

Behavioral guarantees:

- One speculation per (user, fixture) → DB unique index
- Idempotent create in test-mode
- Skip is not persisted as a prediction; clients may defer cards, and the backend only records a prediction once 1 / X / 2 is chosen

## 🚀 Quick Start

### Prerequisites

- Node.js 20+
- PostgreSQL 14+
- Redis 7+
- API-FOOTBALL API key
- Neon PostgreSQL (production)

### Environment Variables

Create a `.env` file in this folder:

```
NODE_ENV=development
PORT=3000
WEBSOCKET_PORT=3001

DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_NAME=swipick_gaming
DATABASE_USER=gaming_user
DATABASE_PASSWORD=your_password

REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=your_redis_password

API_FOOTBALL_BASE_URL=https://v3.football.api-sports.io
API_FOOTBALL_KEY=your_api_key
API_FOOTBALL_BACKUP_KEY=backup_key_optional
API_FOOTBALL_TIER=basic

PROMETHEUS_ENABLED=false
LOG_LEVEL=info
HEALTH_CHECK_INTERVAL=30000
```

### Development

```
npm install
npm run start:dev
```

### Production with Containers

```
podman build -f Containerfile -t gaming-services:latest .
podman run -d --name gaming-services --env-file .env -p 3000:3000 -p 3001:3001 gaming-services:latest
```

## 🧪 Tests

```
npm run test
npm run test:e2e
npm run test:cov
```

## 🧩 Modules

- fixtures: Live fixtures and API-FOOTBALL sync
- teams: Team info and stats
- specs: Live-mode speculation CRUD and stats
- test-mode: Historical fixtures, predictions, weekly stats, user summaries
- health: Liveness/readiness

## � WebSocket

A live updates gateway exists for future use; not required for test mode.

## Notes & Ops

- Neon hosts production Postgres with branching for safe test-mode data and migrations.
- Tables are split between live (`fixtures`, `specs`) and test mode (`test_fixtures`, `test_specs`).
- The separation isolates historical test data while reusing logic.
