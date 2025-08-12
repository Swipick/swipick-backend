# Multi-stage build for BFF service
FROM node:20-alpine AS builder

# Set working directory to repo root for workspace access
WORKDIR /app

# Copy package files for workspace
COPY ../../../package*.json ./
COPY ../../../turbo.json ./

# Copy workspace package files
COPY ../../../apps/backend/bff/package*.json ./apps/backend/bff/
COPY ../../../packages/common/package*.json ./packages/common/

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY ../../../packages/common/ ./packages/common/
COPY ../../../apps/backend/bff/src/ ./apps/backend/bff/src/
COPY ../../../apps/backend/bff/tsconfig*.json ./apps/backend/bff/

# Build the application using workspace
RUN npm run build --workspace=bff

# Production stage
FROM node:20-alpine AS production

# Install runtime dependencies
RUN apk add --no-cache dumb-init curl

# Create non-root user
RUN addgroup -g 1001 -S appgroup && \
    adduser -S appuser -u 1001 -G appgroup

# Set working directory
WORKDIR /app

# Copy built application
COPY --from=builder --chown=1001:1001 /app/apps/backend/bff/dist ./dist
COPY --from=builder --chown=1001:1001 /app/apps/backend/bff/package*.json ./
COPY --from=builder --chown=1001:1001 /app/node_modules ./node_modules

# Switch to non-root user
USER 1001:1001

# Expose port
EXPOSE 9000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:9000/health || exit 1

# Start the application
ENTRYPOINT ["dumb-init", "--"]
CMD ["npm", "run", "start:prod"]
