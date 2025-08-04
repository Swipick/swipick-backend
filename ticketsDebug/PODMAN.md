# 🐋 Swipick Backend - Podman Containerization Guide

This guide covers the complete Podman containerization setup for the Swipick Backend, optimized for rootless containers and modern DevOps workflows.

## 📋 Prerequisites

### Required Software

- **Podman** (v4.0+) - Install from [podman.io](https://podman.io/getting-started/installation)
- **podman-compose** (optional) - Install with `pip install podman-compose`
- **Node.js** (v20+) - For local development
- **curl** - For health checks

### Podman Installation

```bash
# macOS (via Homebrew)
brew install podman

# Linux (Ubuntu/Debian)
sudo apt-get update
sudo apt-get install podman

# Linux (RHEL/CentOS/Fedora)
sudo dnf install podman

# Initialize Podman machine (macOS/Windows)
podman machine init
podman machine start
```

## 🏗️ Container Architecture

### Multi-Stage Build Strategy

1. **Dependencies Stage**: Install and cache npm dependencies
2. **Builder Stage**: Compile TypeScript and build applications
3. **Production Stage**: Minimal runtime with only production assets

### Security Features

- ✅ **Rootless containers** (runs as user 1001:1001)
- ✅ **Read-only root filesystem**
- ✅ **No privilege escalation**
- ✅ **Minimal attack surface** with Alpine Linux
- ✅ **Security labels** for SELinux compatibility

## 🚀 Quick Start

### 1. Build and Run (Simple)

```bash
# Build the container
npm run podman:build

# Run the container
npm run podman:run

# Check status
npm run podman:status

# View logs
npm run podman:logs
```

### 2. Using the Management Script

```bash
# Make script executable (if not already)
chmod +x podman.sh

# Build and run
./podman.sh build
./podman.sh run

# Check health and status
./podman.sh status

# View real-time logs
./podman.sh logs

# Clean up everything
./podman.sh clean
```

### 3. Using Podman Compose

```bash
# Start all services
npm run podman:compose:up

# Stop all services
npm run podman:compose:down
```

## 📁 Container Files Overview

```
swipick-backend/
├── Containerfile              # Production multi-stage build
├── Containerfile.dev          # Development build with hot reload
├── .containerignore           # Files to exclude from build context
├── podman-compose.yml         # Multi-service orchestration
├── swipick-pod.yaml          # Kubernetes-style pod specification
├── podman.sh                 # Management script with all commands
└── apps/backend/bff/
    ├── Dockerfile            # Legacy Docker file (kept for compatibility)
    └── .dockerignore         # Legacy ignore file
```

## 🔧 Development Workflow

### Local Development (Recommended)

```bash
# For active development, use Node.js directly
npm run start:dev

# This provides:
# - Hot reload with nodemon
# - Direct access to source code
# - Faster feedback loop
# - Full debugging capabilities
```

### Containerized Development

```bash
# For testing containerized environment
./podman.sh dev

# This provides:
# - Volume-mounted source code
# - Container environment simulation
# - Dependency isolation
```

## 🏭 Production Deployment

### Single Container Deployment

```bash
# Build production image
./podman.sh build

# Run with production settings
podman run -d \
  --name swipick-bff-prod \
  --publish 9000:9000 \
  --env NODE_ENV=production \
  --security-opt no-new-privileges:true \
  --read-only \
  --tmpfs /tmp:noexec,nosuid,size=64m \
  swipick-bff:latest
```

### Pod Deployment (Kubernetes-style)

```bash
# Generate pod from YAML
podman play kube swipick-pod.yaml

# Stop pod
podman play kube --down swipick-pod.yaml
```

### Compose Deployment

```bash
# Start all services with compose
podman-compose -f podman-compose.yml up -d

# Scale services
podman-compose -f podman-compose.yml up -d --scale swipick-bff=3

# Stop all services
podman-compose -f podman-compose.yml down
```

## 🔍 Monitoring and Health Checks

### Health Endpoints

- **Health Check**: `GET /health` - Returns service status
- **Root Endpoint**: `GET /` - Returns "Hello World!" for basic connectivity

### Container Health Monitoring

```bash
# Check container health
podman inspect swipick-bff-container --format='{{.State.Health.Status}}'

# View health check logs
podman inspect swipick-bff-container --format='{{json .State.Health}}'

# Real-time stats
podman stats swipick-bff-container
```

### Log Management

```bash
# View logs
podman logs swipick-bff-container

# Follow logs in real-time
podman logs -f swipick-bff-container

# Export logs
podman logs swipick-bff-container > app-logs.txt
```

## 🔧 Configuration

### Environment Variables

```bash
# Production Environment
NODE_ENV=production
PORT=9000

# Development Environment
NODE_ENV=development
PORT=9000
```

### Resource Limits

The containers are configured with conservative resource limits:

- **Memory**: 512MB limit, 256MB request
- **CPU**: 0.5 cores limit, 0.25 cores request
- **Temporary Storage**: 64MB for /tmp

### Security Configuration

```yaml
Security Features:
  - Run as non-root user (1001:1001)
  - Read-only root filesystem
  - No privilege escalation
  - Dropped all capabilities
  - SELinux compatible labels
```

## 🐛 Troubleshooting

### Common Issues

#### 1. Permission Denied Errors

```bash
# Fix: Ensure proper ownership and SELinux labels
podman run --volume ./data:/app/data:Z swipick-bff:latest
```

#### 2. Port Already in Use

```bash
# Find process using port
lsof -i :9000

# Or change port
podman run -p 9001:9000 swipick-bff:latest
```

#### 3. Container Won't Start

```bash
# Check logs for errors
podman logs swipick-bff-container

# Run interactively for debugging
podman run -it --entrypoint /bin/sh swipick-bff:latest
```

#### 4. Health Check Failures

```bash
# Test health endpoint manually
curl -f http://localhost:9000/health

# Check container internal connectivity
podman exec swipick-bff-container curl -f http://localhost:9000/health
```

### Debug Commands

```bash
# Interactive shell in running container
podman exec -it swipick-bff-container /bin/sh

# Inspect container configuration
podman inspect swipick-bff-container

# View container processes
podman top swipick-bff-container

# Check resource usage
podman stats swipick-bff-container
```

## 🚀 CI/CD Integration

### GitHub Actions Example

```yaml
- name: Build with Podman
  run: |
    podman build -t swipick-bff:${{ github.sha }} .

- name: Test container
  run: |
    podman run --rm -d --name test-container swipick-bff:${{ github.sha }}
    sleep 10
    curl -f http://localhost:9000/health
    podman stop test-container
```

### Registry Push

```bash
# Tag for registry
podman tag swipick-bff:latest registry.example.com/swipick/bff:latest

# Push to registry
podman push registry.example.com/swipick/bff:latest
```

## 📊 Performance Optimization

### Build Optimization

- Multi-stage builds reduce final image size
- Layer caching speeds up rebuilds
- `.containerignore` reduces build context
- Dependencies cached in separate stage

### Runtime Optimization

- Alpine Linux base for minimal footprint
- Read-only filesystem for security
- Proper signal handling with dumb-init
- Resource limits prevent resource exhaustion

## 🔄 Migration from Docker

If migrating from Docker:

1. **Commands**: Replace `docker` with `podman` in most cases
2. **Compose**: Use `podman-compose` instead of `docker-compose`
3. **Build**: Use `Containerfile` instead of `Dockerfile` (both work)
4. **Rootless**: Podman runs rootless by default (major security improvement)
5. **Systemd**: Podman integrates better with systemd for service management

## 📚 Additional Resources

- [Podman Official Documentation](https://docs.podman.io/)
- [Podman Compose Documentation](https://github.com/containers/podman-compose)
- [Rootless Containers Guide](https://rootlesscontaine.rs/)
- [Container Security Best Practices](https://cheatsheetseries.owasp.org/cheatsheets/Docker_Security_Cheat_Sheet.html)

---

## 📝 Script Commands Reference

| Command                    | Description                          |
| -------------------------- | ------------------------------------ |
| `./podman.sh build`        | Build the production container image |
| `./podman.sh run`          | Run the container in detached mode   |
| `./podman.sh stop`         | Stop the running container           |
| `./podman.sh clean`        | Remove container and image           |
| `./podman.sh logs`         | Show container logs (follow mode)    |
| `./podman.sh status`       | Show container status and health     |
| `./podman.sh dev`          | Run in development mode with volumes |
| `./podman.sh compose-up`   | Start services with Podman Compose   |
| `./podman.sh compose-down` | Stop services with Podman Compose    |

---

_For questions or issues, please refer to the project documentation or create an issue in the repository._
