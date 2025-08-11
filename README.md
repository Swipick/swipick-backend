# Swipick Backend

> **A microservice architecture for speculative football gaming**

[![Infrastructure](https://img.shields.io/badge/Infrastructure-Cloud%20Ready-green)](https://github.com/Swipick/swipick-backend)
[![Database](https://img.shields.io/badge/Database-Neon%20PostgreSQL-blue)](https://neon.tech)
[![Cache](https://img.shields.io/badge/Cache-Upstash%20Redis-red)](https://upstash.com)
[![Container](https://img.shields.io/badge/Container-Podman-orange)](https://podman.io)

Swipick Backend is a scalable, cloud-native backend service built with **NestJS** and **TypeScript**, providing APIs for a speculative football game where users predict match outcomes and compete on leaderboards.

---

## 🏗️ **Current Architecture**

### **Services Overview**

| Service                        | Status         | Port | Description                                       |
| ------------------------------ | -------------- | ---- | ------------------------------------------------- |
| **BFF (Backend-for-Frontend)** | ✅ **Active**  | 9000 | API Gateway and request orchestration             |
| **Gaming Services**            | ✅ **Active**  | 3000 | Match data, predictions, API-FOOTBALL integration |
| **User Services**              | 🚧 **Next**    | 4000 | User profiles, authentication, preferences        |
| **Notification Services**      | 📋 **Planned** | 5000 | Push notifications via Firebase FCM               |
| **Game Engine**                | 📋 **Planned** | 6000 | Scoring algorithms and leaderboards               |

### **Infrastructure Stack**

```
┌─────────────────────────────────────────────────────────────┐
│                     SWIPICK BACKEND                        │
├─────────────────────────────────────────────────────────────┤
│  Frontend Apps (iOS, Android, Web) → Firebase Auth         │
├─────────────────────────────────────────────────────────────┤
│  BFF Service (Port 9000) - API Gateway & Request Router    │
├─────────────────────────────────────────────────────────────┤
│  Microservices Layer:                                      │
│  ├─ Gaming Services (3000) ✅ LIVE                         │
│  ├─ User Services (4000) 🚧 NEXT                          │
│  ├─ Notification Services (5000) 📋 PLANNED               │
│  └─ Game Engine (6000) 📋 PLANNED                         │
├─────────────────────────────────────────────────────────────┤
│  External APIs:                                            │
│  └─ API-FOOTBALL (Rapid API) - Match data & fixtures       │
├─────────────────────────────────────────────────────────────┤
│  Cloud Databases:                                          │
│  ├─ Neon PostgreSQL - Primary data store (10 GB free)     │
│  └─ Upstash Redis - Caching & sessions (10K cmds/day)     │
└─────────────────────────────────────────────────────────────┘
```

### **Technology Stack**

- **🚀 Runtime:** Node.js 24.x with TypeScript
- **🏛️ Framework:** NestJS (Express-based)
- **🗄️ Database:** Neon PostgreSQL (Cloud-hosted)
- **⚡ Cache:** Upstash Redis (TLS-secured)
- **🔐 Auth:** Firebase Authentication (JWT-based)
- **📦 Containers:** Podman with container orchestration
- **🏗️ Build:** Turbo for monorepo management
- **🧪 Testing:** Jest with ts-jest configuration

---

## 🚀 **Quick Start**

### **Prerequisites**

- Node.js 18+ (recommended: 24.x)
- npm 10+
- Podman (for containerized deployment)
- Git

### **Installation**

```bash
# Clone the repository
git clone https://github.com/Swipick/swipick-backend.git
cd swipick-backend

# Install dependencies
npm install

# Configure environment variables
cp .env.example .env
# Edit .env with your credentials (see Configuration section)
```

---

## 🎮 **Running the Services**

### **Development Mode (Recommended)**

```bash
# Start BFF service only (API Gateway)
npm run start:dev

# Start BFF service explicitly
npm run start:dev:bff

# Start gaming services (API-FOOTBALL integration)
cd apps/backend/gaming-services && npm run start:dev
```

### **Individual Service Commands**

```bash
# BFF Service (Backend-for-Frontend)
npm run start:dev:bff                    # Port 9000

# Gaming Services (when ready)
npm run start:dev:gaming-services        # Port 3000

# User Services (coming next)
npm run start:dev:user-service          # Port 4000

# Future services
npm run start:dev:game-engine           # Port 6000
npm run start:dev:notification-service  # Port 5000
```

### **Container Deployment with Podman**

```bash
# Development containers (uses compose.dev.yml)
podman-compose -f compose.dev.yml up -d

# Production containers (uses compose.yml)
podman-compose -f compose.yml up -d

# Using the Podman management script
./podman.sh build                       # Build all containers
./podman.sh start                       # Start services
./podman.sh stop                        # Stop services
./podman.sh logs                        # View logs
./podman.sh clean                       # Clean up containers
```

### **Quick Development Setup**

```bash
# One-command development start
./start-development.sh                  # Starts all development services

# Production deployment
./start-production.sh                   # Starts production containers
```

---

## ⚙️ **Configuration**

### **Environment Variables**

Create a `.env` file in the root directory:

```env
# === CLOUD DATABASES ===
# Neon PostgreSQL (10 GB free)
DATABASE_URL=postgresql://username:password@host/database?sslmode=require

# Upstash Redis (10K commands/day free)
REDIS_URL=rediss://username:password@host:6379

# === API INTEGRATIONS ===
# API-FOOTBALL (RapidAPI) - 100 requests/day free
API_FOOTBALL_KEY=your_rapidapi_key_here
API_FOOTBALL_URL=https://api-football-v1.p.rapidapi.com/v3

# === SERVICE CONFIGURATION ===
NODE_ENV=development
LOG_LEVEL=info

# Service URLs (for local development)
GAMING_SERVICES_URL=http://localhost:3000
BFF_URL=http://localhost:9000
USER_SERVICES_URL=http://localhost:4000

# === FIREBASE (Frontend Auth) ===
FIREBASE_PROJECT_ID=swipick-dev
```

### **Database Setup**

The application uses cloud databases for zero-maintenance operation:

- **PostgreSQL:** [Neon Database](https://neon.tech) - 10 GB free tier
- **Redis:** [Upstash Redis](https://upstash.com) - 10K commands/day free

See `ticketsDebug/DBG-20250804-003-cloud-database-setup.md` for detailed setup instructions.

---

## 🧪 **Development Commands**

### **Building & Testing**

```bash
# Build all services
npm run build

# Run tests
npm run test                            # All tests
npm run test:watch                      # Watch mode
npm run test:e2e                       # End-to-end tests
npm run test:cov                       # Coverage report

# Code quality
npm run lint                           # Lint all code
npm run lint:fix                      # Fix linting issues
npm run format                        # Format code
npm run type-check                    # TypeScript checking
```

### **Database Operations**

```bash
# Test database connections
node test-db-connections.js

# Run database migrations (when available)
npm run migration:run

# Generate new migration
npm run migration:generate -- --name=MigrationName
```

---

## 📊 **Service Status & Health Checks**

### **Health Endpoints**

| Service         | Health Check URL             | Status         |
| --------------- | ---------------------------- | -------------- |
| BFF             | http://localhost:9000/health | ✅ Active      |
| Gaming Services | http://localhost:3000/health | ✅ Active      |
| User Services   | http://localhost:4000/health | 🚧 Coming Next |

### **API Documentation**

- **BFF Service:** http://localhost:9000/api (Swagger UI)
- **Gaming Services:** http://localhost:3000/api (Swagger UI)

---

## 🗂️ **Project Structure**

```
swipick-backend/
├── apps/
│   └── backend/
│       ├── bff/                    # ✅ Backend-for-Frontend service
│       ├── gaming-services/        # ✅ Gaming & API-FOOTBALL integration
│       ├── user-service/          # 🚧 User management (next)
│       ├── game-engine/           # 📋 Scoring & leaderboards (planned)
│       └── notification-service/  # 📋 Push notifications (planned)
├── packages/
│   └── common/                    # Shared DTOs, types, utilities
├── ticketsDebug/                  # Development documentation
├── compose.yml                    # Production containers
├── compose.dev.yml               # Development containers
├── podman.sh                     # Container management script
├── start-development.sh          # Quick dev start
├── start-production.sh           # Quick prod start
└── .env                          # Environment configuration
```

---

## 🔄 **Development Workflow**

### **Adding a New Service**

1. **Create Service Directory:**

   ```bash
   mkdir -p apps/backend/new-service
   cd apps/backend/new-service
   ```

2. **Initialize NestJS Service:**

   ```bash
   npx nest new . --package-manager npm
   ```

3. **Update Root Configuration:**
   - Add to `package.json` workspaces
   - Add npm script: `"start:dev:new-service"`
   - Update `compose.dev.yml` with new service

4. **Configure Service:**
   - Add database connection using `DATABASE_URL`
   - Add Redis connection using `REDIS_URL`
   - Add health check endpoint
   - Update BFF routing if needed

### **Next Service: User Services**

The next planned service is **User Services** which will handle:

- User profile management
- Firebase authentication integration
- User preferences and settings
- Social features preparation

---

## 🐳 **Container Management**

### **Podman Commands**

```bash
# List running containers
podman ps

# View container logs
podman logs swipick-bff-dev
podman logs swipick-gaming-services-dev

# Execute commands in containers
podman exec -it swipick-bff-dev /bin/bash

# Stop all Swipick containers
podman stop $(podman ps -q --filter label=com.swipick.service)

# Remove all Swipick containers
podman rm $(podman ps -aq --filter label=com.swipick.service)
```

### **Pod Management**

```bash
# Create and start the Swipick pod
podman play kube swipick-pod.yaml

# Stop the pod
podman pod stop swipick-pod

# Remove the pod
podman pod rm swipick-pod
```

---

## 📈 **Performance & Monitoring**

### **Resource Usage**

- **Memory:** ~200MB per service in development
- **CPU:** Low usage during development, scales with API requests
- **Database:** Current usage <1 GB (10 GB free tier limit)
- **Redis:** Current usage <10 MB (256 MB free tier limit)

### **Rate Limiting Strategy**

- **API-FOOTBALL:** 100 requests/day → Cache responses for 24 hours
- **Redis Caching:** Reduces API calls by ~95% after initial data load
- **Database Queries:** Connection pooling handles concurrent requests

---

## 🔒 **Security**

### **Authentication Flow**

```
Client App → Firebase Auth → JWT Token → BFF → Microservices
```

### **Security Features**

- ✅ TLS encryption for all database connections
- ✅ Environment variable configuration (no secrets in code)
- ✅ JWT token validation via Firebase Admin SDK
- ✅ CORS configuration for frontend domains
- ✅ Rate limiting on API endpoints

---

## 🚀 **Deployment**

### **Development Deployment**

```bash
# Local development with hot reload
npm run start:dev

# Containerized development
podman-compose -f compose.dev.yml up -d
```

### **Production Deployment**

```bash
# Build production containers
podman-compose -f compose.yml build

# Start production services
podman-compose -f compose.yml up -d

# Using management script
./start-production.sh
```

---

## 📚 **Documentation**

- **[Cloud Database Setup](ticketsDebug/DBG-20250804-003-cloud-database-setup.md)** - Neon & Upstash configuration
- **[NestJS Startup Issues](ticketsDebug/DBG-20250801-002-nestjs-startup-failure.md)** - Troubleshooting guide
- **[Initialization Setup](ticketsDebug/DBG-20250724-001-initialization.md)** - Project setup history

---

## 🤝 **Contributing**

This is a private project under development. All contributions are managed through the development team.

### **Development Standards**

- ✅ TypeScript strict mode
- ✅ Jest testing for all services
- ✅ ESLint + Prettier formatting
- ✅ Conventional commit messages
- ✅ NestJS architecture patterns

---

## 📄 **License**

Private project - All rights reserved.

---

## 📞 **Support**

For technical issues or questions:

- Check `ticketsDebug/` folder for troubleshooting guides
- Review container logs: `podman logs <container-name>`
- Test database connections: `node test-db-connections.js`

---

**🎯 Ready to build the next great football prediction game!**
