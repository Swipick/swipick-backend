# Multi-stage build for Railway deployment
FROM node:20-alpine AS base

# Install dependencies only when needed
FROM base AS deps
WORKDIR /app

# Copy the root package.json and package-lock.json
COPY ../../../package*.json ./
COPY ../../../turbo.json ./

# Copy workspace package.json files
COPY ../../../packages/common/package*.json ./packages/common/
COPY package*.json ./apps/backend/gaming-services/

# Install dependencies
RUN npm ci

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app

# Copy all necessary files from root
COPY --from=deps /app/node_modules ./node_modules
COPY ../../../packages ./packages
COPY ../../../turbo.json ./
COPY ../../../package*.json ./

# Copy gaming-services source
COPY . ./apps/backend/gaming-services

# Build the common package first
RUN npm run build --workspace=@swipick/common

# Build gaming-services
RUN npm run build --workspace=@swipick/gaming-services

# Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nestjs

# Copy the standalone output
COPY --from=builder /app/apps/backend/gaming-services/dist ./dist
COPY --from=builder /app/packages/common/dist ./node_modules/@swipick/common/dist
COPY --from=builder /app/packages/common/package.json ./node_modules/@swipick/common/
COPY --from=deps /app/node_modules ./node_modules

# Copy package.json for the start script
COPY package*.json ./

USER nestjs

EXPOSE 3002

ENV PORT=3002

CMD ["node", "dist/main"]
