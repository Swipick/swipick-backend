# Swipick Backend

This is the backend service for **Swipick**, a speculative football game. It is designed as a microservice architecture built using **NestJS**, with support for GraphQL or REST, and hosted on **AWS Fargate**.

## Features

- Firebase Authentication (JWT-based)
- Backend-for-Frontend (BFF) API Gateway
- Match Service integration with API-FOOTBALL
- User predictions and scoring engine
- Redis caching and leaderboard
- PostgreSQL transactional data store
- Notifications via Firebase Cloud Messaging (FCM)

## Tech Stack

- **Language**: TypeScript
- **Framework**: NestJS
- **Database**: PostgreSQL (via Supabase or AWS RDS)
- **Cache**: Redis (via AWS Elasticache)
- **Auth**: Firebase Admin SDK
- **Deployment**: AWS Fargate + Docker + Terraform
- **Queue/Jobs**: BullMQ or AWS SQS

## Project Structure

```
apps/
  backend/
    bff/                  # Backend-for-Frontend gateway
    match-service/        # Fetch & cache fixtures from API-FOOTBALL
    user-service/         # User profiles & preferences
    game-engine/          # Prediction recording & point scoring
    notification-service/ # FCM push notifications
packages/
  common/                 # Shared DTOs, types, utilities
```

## Setup Instructions

1. Clone the repo from the GitHub organization:

   ```bash
   git clone https://github.com/swipick-org/swipick-backend.git
   cd swipick-backend
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Configure environment variables:

   ```bash
   cp .env.example .env
   # Update the values for Firebase, DB, Redis, API keys
   ```

4. Run development server:

   ```bash
   npm run start:dev bff
   ```

## Development

- Follow modular NestJS architecture
- Use DTOs and guards for validation & security
- Run unit tests with Jest

## Commands

```bash
npm run start:dev <service>      # Start specific service
npm run test                     # Run unit tests
npm run lint                     # Lint all packages
npm run format                   # Prettify codebase
```

## Deployment

- Built with Docker and deployed via GitHub Actions
- Infrastructure is provisioned using Terraform
- Secrets are managed using AWS Secrets Manager

## License

This project is owned by the client and maintained under a private GitHub organization. All contributions are governed by a license agreement.

