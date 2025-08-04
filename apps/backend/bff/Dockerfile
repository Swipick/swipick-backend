# Build stage
FROM node:18-alpine AS builder

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY turbo.json ./
COPY tsconfig*.json ./

# Copy workspace configuration
COPY apps/backend/bff/package*.json ./apps/backend/bff/
COPY packages/common/package*.json ./packages/common/

# Install dependencies
RUN npm ci --only=production && npm cache clean --force

# Copy source code
COPY apps/backend/bff/ ./apps/backend/bff/
COPY packages/common/ ./packages/common/

# Build the application
WORKDIR /app/apps/backend/bff
RUN npm run build

# Production stage
FROM node:18-alpine AS production

# Create app directory
WORKDIR /app

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nextjs -u 1001

# Copy built application
COPY --from=builder --chown=nextjs:nodejs /app/apps/backend/bff/dist ./dist
COPY --from=builder --chown=nextjs:nodejs /app/apps/backend/bff/package*.json ./
COPY --from=builder --chown=nextjs:nodejs /app/node_modules ./node_modules

# Switch to non-root user
USER nextjs

# Expose port
EXPOSE 9000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:9000/health || exit 1

# Start the application
CMD ["node", "dist/main.js"]
