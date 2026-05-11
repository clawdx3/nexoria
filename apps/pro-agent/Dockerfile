# Nexoria Pro Agent Runtime
# Uses pnpm deploy to produce a self-contained node_modules tree.

FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate
WORKDIR /app

# deps
FROM base AS deps
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages/agent-core/package.json ./packages/agent-core/
COPY apps/pro-agent/package.json ./apps/pro-agent/
RUN pnpm install --no-frozen-lockfile

# build + deploy
FROM deps AS build
COPY . .
RUN pnpm --filter @nexoria/agent-core build
RUN pnpm --filter @nexoria/pro-agent build
# Deploy resolves all workspace symlinks into a flat node_modules tree
RUN pnpm --filter @nexoria/pro-agent deploy --prod /tmp/pro-agent-out

# production
FROM base AS runtime
RUN apk add --no-cache curl ca-certificates
WORKDIR /app

# Copy the self-contained deploy output
COPY --from=build /tmp/pro-agent-out .

RUN mkdir -p /app/data/memory /app/data/workspace && chown -R node:node /app
USER node

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:3002/health || exit 1

EXPOSE 3002
CMD ["node", "dist/main.js"]
