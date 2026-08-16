# syntax=docker/dockerfile:1

# 1. Base stage with dumb-init for proper signal handling
FROM node:20-alpine AS base
WORKDIR /app
RUN apk add --no-cache dumb-init

# 2. Builder stage
FROM base AS builder

# Copy package manifests for workspace dependency resolution
COPY package.json package-lock.json ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/server/package.json ./packages/server/
COPY packages/client/package.json ./packages/client/

# Install all dependencies with BuildKit cache
RUN --mount=type=cache,target=/root/.npm \
    npm ci

# Copy sources
COPY packages/shared ./packages/shared
COPY packages/server ./packages/server
COPY packages/client ./packages/client

# Build shared, server, and client bundles
RUN npm run build

# Prune devDependencies to keep only production dependencies
RUN --mount=type=cache,target=/root/.npm \
    npm prune --omit=dev

# 3. Production Runner stage
FROM node:20-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0

# Install lightweight init system for clean process termination (SIGTERM)
RUN apk add --no-cache dumb-init

# Copy manifests and pre-pruned node_modules (zero redundant downloads)
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/packages/shared/package.json ./packages/shared/package.json
COPY --from=builder /app/packages/server/package.json ./packages/server/package.json
COPY --from=builder /app/packages/client/package.json ./packages/client/package.json

# Copy compiled production artifacts and static public templates
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/packages/server/dist ./packages/server/dist
COPY --from=builder /app/packages/server/public ./packages/server/public
COPY --from=builder /app/packages/client/dist ./packages/client/dist

# Run as non-root user for security
USER node

EXPOSE 3000

ENTRYPOINT ["/usr/bin/dumb-init", "--"]
CMD ["node", "packages/server/dist/index.js"]
