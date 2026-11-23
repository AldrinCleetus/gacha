# Multi-stage Dockerfile for gacha backend (Node.js 22 LTS, pnpm monorepo)
# Supported targets:
#   - dev: development environment with hot reload
#   - runner: minimal production image running as non-root 'node' user

FROM node:22-alpine AS base
WORKDIR /app
RUN apk add --no-cache curl postgresql-client
RUN npm install -g pnpm@latest

# Dependencies stage
FROM base AS dependencies
WORKDIR /app

# Copy monorepo manifests and pnpm config
COPY pnpm-workspace.yaml package.json .npmrc* pnpm-lock.yaml* ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/sources/package.json ./packages/sources/
COPY packages/db/package.json ./packages/db/
COPY apps/api/package.json ./apps/api/
COPY apps/worker/package.json ./apps/worker/

# Install all dependencies (dev + prod)
RUN pnpm install

# Dev target (used in docker-compose.yml for local development)
FROM dependencies AS dev
WORKDIR /app
ENV NODE_ENV=development
ENV TZ=UTC

COPY tsconfig.base.json tsconfig.json ./
COPY packages/shared ./packages/shared
COPY packages/sources ./packages/sources
COPY packages/db ./packages/db
COPY apps/api ./apps/api
COPY apps/worker ./apps/worker

RUN pnpm build

CMD ["pnpm", "--filter", "@gacha/api", "dev"]

# Build stage
FROM dev AS builder

# Slim production runner stage
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV TZ=UTC

# Ensure storage directory exists and has non-root permissions
RUN mkdir -p /app/data/raw && chown -R node:node /app

# Copy root manifests and node_modules
COPY --chown=node:node --from=builder /app/package.json /app/pnpm-workspace.yaml ./
COPY --chown=node:node --from=builder /app/node_modules ./node_modules

# Copy package dist and package.json
COPY --chown=node:node --from=builder /app/packages/shared/package.json ./packages/shared/
COPY --chown=node:node --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --chown=node:node --from=builder /app/packages/sources/package.json ./packages/sources/
COPY --chown=node:node --from=builder /app/packages/sources/dist ./packages/sources/dist
COPY --chown=node:node --from=builder /app/packages/db/package.json ./packages/db/
COPY --chown=node:node --from=builder /app/packages/db/dist ./packages/db/dist
COPY --chown=node:node --from=builder /app/apps/api/package.json ./apps/api/
COPY --chown=node:node --from=builder /app/apps/api/dist ./apps/api/dist
COPY --chown=node:node --from=builder /app/apps/worker/package.json ./apps/worker/
COPY --chown=node:node --from=builder /app/apps/worker/dist ./apps/worker/dist

# Switch to non-root user
USER node

EXPOSE 3001

CMD ["node", "apps/api/dist/index.js"]
