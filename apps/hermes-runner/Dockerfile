# Nexoria Hermes Runner
# Bridges Nexoria's Socket.IO runner protocol to a Hermes API server.

FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate
WORKDIR /app

FROM base AS deps
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY apps/hermes-runner/package.json ./apps/hermes-runner/
RUN pnpm install --no-frozen-lockfile

FROM deps AS build
COPY apps/hermes-runner ./apps/hermes-runner
RUN pnpm --filter @nexoria/hermes-runner build
RUN pnpm --filter @nexoria/hermes-runner deploy --prod /tmp/hermes-runner-out

FROM base AS runtime
RUN apk add --no-cache curl ca-certificates
WORKDIR /app
COPY --from=build /tmp/hermes-runner-out .
RUN mkdir -p /app/data && chown -R node:node /app
USER node

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:3003/health || exit 1

EXPOSE 3003
CMD ["node", "dist/main.js"]
