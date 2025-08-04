#!/bin/bash

# Swipick Backend - Podman Management Script
# This script provides easy commands for building and running containers with Podman

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
IMAGE_NAME="swipick-bff"
CONTAINER_NAME="swipick-bff-container"
TAG="latest"
PORT="9000"

# Helper functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if Podman is installed
check_podman() {
    if ! command -v podman &> /dev/null; then
        log_error "Podman is not installed. Please install Podman first."
        echo "Visit: https://podman.io/getting-started/installation"
        exit 1
    fi
    log_info "Using Podman version: $(podman --version)"
}

# Build the container image
build() {
    log_info "Building Swipick BFF container with Podman..."
    
    # Build with Podman (supports rootless by default)
    podman build \
        --tag $IMAGE_NAME:$TAG \
        --file Containerfile \
        --layers \
        --squash-all \
        .
    
    log_success "Container built successfully: $IMAGE_NAME:$TAG"
}

# Run the container
run() {
    log_info "Running Swipick BFF container..."
    
    # Stop existing container if running
    if podman ps -a --format "{{.Names}}" | grep -q "^$CONTAINER_NAME$"; then
        log_warning "Stopping existing container..."
        podman stop $CONTAINER_NAME || true
        podman rm $CONTAINER_NAME || true
    fi
    
    # Run container in rootless mode
    podman run \
        --name $CONTAINER_NAME \
        --detach \
        --publish $PORT:9000 \
        --env NODE_ENV=production \
        --security-opt no-new-privileges:true \
        --read-only \
        --tmpfs /tmp:noexec,nosuid,size=64m \
        --health-cmd "curl -f http://localhost:9000/ || exit 1" \
        --health-interval 30s \
        --health-timeout 10s \
        --health-retries 3 \
        --health-start-period 40s \
        $IMAGE_NAME:$TAG
    
    log_success "Container is running on http://localhost:$PORT"
    log_info "Container name: $CONTAINER_NAME"
}

# Run with compose
compose_up() {
    log_info "Starting services with Podman Compose..."
    
    if ! command -v podman-compose &> /dev/null; then
        log_error "podman-compose is not installed."
        log_info "Install with: pip install podman-compose"
        exit 1
    fi
    
    podman-compose up -d
    log_success "Services started with Podman Compose"
}

# Stop compose services
compose_down() {
    log_info "Stopping services with Podman Compose..."
    podman-compose down
    log_success "Services stopped"
}

# Stop the container
stop() {
    log_info "Stopping Swipick BFF container..."
    podman stop $CONTAINER_NAME || true
    log_success "Container stopped"
}

# Remove the container
clean() {
    log_info "Cleaning up Swipick BFF container and image..."
    podman stop $CONTAINER_NAME 2>/dev/null || true
    podman rm $CONTAINER_NAME 2>/dev/null || true
    podman rmi $IMAGE_NAME:$TAG 2>/dev/null || true
    log_success "Cleanup completed"
}

# Show logs
logs() {
    log_info "Showing container logs..."
    podman logs -f $CONTAINER_NAME
}

# Show container status
status() {
    echo -e "${BLUE}=== Container Status ===${NC}"
    podman ps -a --filter name=$CONTAINER_NAME
    
    echo -e "\n${BLUE}=== Container Health ===${NC}"
    podman inspect $CONTAINER_NAME --format='{{.State.Health.Status}}' 2>/dev/null || echo "Not available"
    
    echo -e "\n${BLUE}=== Container Stats ===${NC}"
    podman stats --no-stream $CONTAINER_NAME 2>/dev/null || echo "Container not running"
}

# Development mode with live reload
dev() {
    log_info "Starting development mode with Podman..."
    log_warning "For development, consider using npm run start:dev instead of containers"
    
    # Build development image
    podman build \
        --tag $IMAGE_NAME:dev \
        --file Containerfile \
        --target builder \
        .
    
    # Run with mounted source code for development
    podman run \
        --name "${CONTAINER_NAME}-dev" \
        --rm \
        --interactive \
        --tty \
        --publish $PORT:9000 \
        --volume "$(pwd)/apps/backend/bff/src:/app/apps/backend/bff/src:Z" \
        --volume "$(pwd)/packages/common/src:/app/packages/common/src:Z" \
        --env NODE_ENV=development \
        $IMAGE_NAME:dev \
        npm run start:dev
}

# Show help
help() {
    echo -e "${BLUE}Swipick Backend - Podman Management Script${NC}"
    echo ""
    echo "Usage: $0 <command>"
    echo ""
    echo "Commands:"
    echo "  build         Build the container image"
    echo "  run           Run the container"
    echo "  stop          Stop the container"
    echo "  clean         Remove container and image"
    echo "  logs          Show container logs"
    echo "  status        Show container status and health"
    echo "  dev           Run in development mode with volume mounts"
    echo "  compose-up    Start services with Podman Compose"
    echo "  compose-down  Stop services with Podman Compose"
    echo "  help          Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 build       # Build the image"
    echo "  $0 run         # Run the container"
    echo "  $0 logs        # View logs"
    echo "  $0 clean       # Clean up everything"
}

# Main script logic
main() {
    check_podman
    
    case "${1:-help}" in
        build)
            build
            ;;
        run)
            run
            ;;
        stop)
            stop
            ;;
        clean)
            clean
            ;;
        logs)
            logs
            ;;
        status)
            status
            ;;
        dev)
            dev
            ;;
        compose-up)
            compose_up
            ;;
        compose-down)
            compose_down
            ;;
        help|--help|-h)
            help
            ;;
        *)
            log_error "Unknown command: $1"
            help
            exit 1
            ;;
    esac
}

# Run main function
main "$@"
