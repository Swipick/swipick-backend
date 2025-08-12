# Swipick Backend - Podman Multi-stage Build
# Optimized for Podman rootless containers and efficient layer caching

# =============================================================================
# Stage 1: Dependencies - Install and cache dependencies
# =============================================================================
FROM node:20-alpine AS dependencies

LABEL maintainer="Swipick Development Team"
LABEL description="Swipick Backend BFF Service - Dependencies Stage"

# Install dumb-init for proper signal handling in containers
RUN apk add --no-cache dumb-init

# Create app directory and set ownership for rootless operation
WORKDIR /app
RUN chown -R 1001:1001 /app

# Copy package files for dependency installation
COPY --chown=1001:1001 package*.json ./
COPY --chown=1001:1001 turbo.json ./

# Copy workspace package files
COPY --chown=1001:1001 apps/backend/bff/package*.json ./apps/backend/bff/
COPY --chown=1001:1001 packages/common/package*.json ./packages/common/

# Switch to non-root user for security
USER 1001:1001

# Install dependencies with npm ci for faster, deterministic builds
# Separate production and dev dependencies for better layer caching
RUN npm ci --only=production && \
    npm cache clean --force

# =============================================================================
# Stage 2: Builder - Compile TypeScript and build application
# =============================================================================
FROM dependencies AS builder

LABEL description="Swipick Backend BFF Service - Build Stage"

# Install dev dependencies needed for building
USER root
RUN npm ci && npm cache clean --force
USER 1001:1001

# Copy source code
COPY --chown=1001:1001 packages/common/ ./packages/common/
COPY --chown=1001:1001 apps/backend/bff/src/ ./apps/backend/bff/src/
COPY --chown=1001:1001 apps/backend/bff/tsconfig*.json ./apps/backend/bff/
COPY --chown=1001:1001 apps/backend/bff/nest-cli.json* ./apps/backend/bff/

# Build the common package first
WORKDIR /app/packages/common
RUN npm run build

# Build the BFF application
WORKDIR /app/apps/backend/bff
# Clean any existing build artifacts to avoid cache conflicts
RUN rm -rf dist/tsconfig.tsbuildinfo dist/tsconfig.build.tsbuildinfo || true
RUN npm run build

# =============================================================================
# Stage 3: Production - Minimal runtime image
# =============================================================================
FROM node:20-alpine AS production

LABEL maintainer="Swipick Development Team"
LABEL description="Swipick Backend BFF Service - Production Runtime"
LABEL version="1.0.0"

# Install dumb-init and curl for health checks
RUN apk add --no-cache dumb-init curl

# Create non-root user and group for rootless operation
RUN addgroup -g 1001 -S appgroup && \
    adduser -S appuser -u 1001 -G appgroup

# Create app directory with proper permissions
WORKDIR /app
RUN chown -R 1001:1001 /app

# Copy production dependencies from dependencies stage
COPY --from=dependencies --chown=1001:1001 /app/node_modules ./node_modules
COPY --from=dependencies --chown=1001:1001 /app/package*.json ./

# Copy built application and common package
COPY --from=builder --chown=1001:1001 /app/apps/backend/bff/dist ./dist
COPY --from=builder --chown=1001:1001 /app/apps/backend/bff/package*.json ./
COPY --from=builder --chown=1001:1001 /app/packages/common/dist ./packages/common/dist
COPY --from=builder --chown=1001:1001 /app/packages/common/package*.json ./packages/common/

# Switch to non-root user
USER 1001:1001

# Expose port (non-privileged port for rootless containers)
EXPOSE 9000

# Health check optimized for Podman
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:9000/ || exit 1

# Use dumb-init for proper signal handling
ENTRYPOINT ["dumb-init", "--"]

# Start the application
CMD ["node", "dist/src/main.js"]
