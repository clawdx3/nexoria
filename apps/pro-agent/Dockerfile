# Nexoria Pro Agent Runtime
# Lightweight Node.js agent that connects to the API via WebSocket

FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate
WORKDIR /app

# Install dependencies
FROM base AS deps
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages/agent-core/package.json ./packages/agent-core/
COPY apps/pro-agent/package.json ./apps/pro-agent/
RUN pnpm install --no-frozen-lockfile

# Build stage
FROM deps AS build
COPY . .
RUN pnpm --filter @nexoria/agent-core build
RUN pnpm --filter @nexoria/pro-agent build

# Production stage
FROM node:20-alpine AS runtime
RUN apk add --no-cache curl ca-certificates
WORKDIR /app

# Copy node_modules from deps stage (contains workspace symlinks pointing outside /app)
COPY --from=deps /app/node_modules ./node_modules

# Copy built packages
COPY --from=build /app/packages/agent-core/dist ./packages/agent-core/dist
COPY --from=build /app/packages/agent-core/package.json ./packages/agent-core/package.json
COPY --from=build /app/apps/pro-agent/dist ./apps/pro-agent/dist
COPY --from=build /app/apps/pro-agent/package.json ./apps/pro-agent/package.json
COPY --from=build /app/pnpm-workspace.yaml ./
COPY --from=build /app/package.json ./

# Fix workspace symlinks: recreate @nexoria/agent-core link to point inside /app
RUN rm -rf /app/node_modules/@nexoria && mkdir -p /app/node_modules/@nexoria && ln -s /app/packages/agent-core /app/node_modules/@nexoria/agent-core

# Create data directories
RUN mkdir -p /app/data/memory /app/data/workspace && chown -R node:node /app

# Run as non-root
USER node

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:3002/health || exit 1

EXPOSE 3002

CMD ["node", "apps/pro-agent/dist/main.js"]
