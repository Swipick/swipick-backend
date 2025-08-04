#!/bin/bash

# Swipick Backend - Development Script
set -e

echo "🛠️  Starting Swipick Backend Services (Development)"

# Check if .env exists
if [ ! -f .env ]; then
    echo "❌ .env file not found. Please copy .env.example to .env and configure it."
    exit 1
fi

# Source environment variables
source .env

# Check required variables
if [ -z "$POSTGRES_PASSWORD" ] || [ -z "$API_FOOTBALL_KEY" ]; then
    echo "❌ Missing required environment variables. Please check your .env file."
    echo "Required: POSTGRES_PASSWORD, API_FOOTBALL_KEY"
    exit 1
fi

echo "📦 Building development containers..."
podman-compose -f compose.dev.yml build

echo "🌐 Starting development services with hot reload..."
podman-compose -f compose.dev.yml up -d

echo "⏳ Waiting for services to start..."
sleep 10

# Check service health
echo "🔍 Checking service status..."
podman-compose -f compose.dev.yml ps

echo "✅ Development services started successfully!"
echo ""
echo "🌍 Service URLs:"
echo "  - BFF Service: http://localhost:9000 (Hot Reload)"
echo "  - Gaming Services: http://localhost:3000 (Hot Reload)"
echo "  - WebSocket: ws://localhost:3001"
echo "  - PostgreSQL: localhost:5433 (Dev DB)"
echo "  - Redis: localhost:6380 (Dev Cache)"
echo ""
echo "📊 Health Checks:"
echo "  - BFF: http://localhost:9000/health"
echo "  - Gaming: http://localhost:3000/health"
echo ""
echo "🔥 Hot Reload Active:"
echo "  - Changes to /src folders will auto-restart services"
echo ""
echo "📋 Useful commands:"
echo "  podman-compose -f compose.dev.yml logs -f      # View logs"
echo "  podman-compose -f compose.dev.yml stop         # Stop services"
echo "  podman-compose -f compose.dev.yml down         # Stop and remove"
