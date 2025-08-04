#!/bin/bash

# Swipick Backend - Production Deployment Script
set -e

echo "🚀 Starting Swipick Backend Services (Production)"

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

echo "📦 Building containers..."
podman-compose -f compose.yml build

echo "🌐 Starting services..."
podman-compose -f compose.yml up -d

echo "⏳ Waiting for services to be healthy..."
sleep 10

# Check service health
echo "🔍 Checking service status..."
podman-compose -f compose.yml ps

echo "✅ Services started successfully!"
echo ""
echo "🌍 Service URLs:"
echo "  - BFF Service: http://localhost:9000"
echo "  - Gaming Services: http://localhost:3000"
echo "  - WebSocket: ws://localhost:3001"
echo "  - PostgreSQL: localhost:5432"
echo "  - Redis: localhost:6379"
echo ""
echo "📊 Health Checks:"
echo "  - BFF: http://localhost:9000/health"
echo "  - Gaming: http://localhost:3000/health"
echo ""
echo "📋 Useful commands:"
echo "  podman-compose -f compose.yml logs -f          # View logs"
echo "  podman-compose -f compose.yml stop             # Stop services"
echo "  podman-compose -f compose.yml down             # Stop and remove"
echo "  podman-compose -f compose.yml down -v          # Stop, remove, and delete volumes"
