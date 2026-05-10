# syntax=docker/dockerfile:1
FROM node:20-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

FROM base AS build
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY apps/openclaw-runner/package.json apps/openclaw-runner/package.json
COPY apps/power-agent-runtime/package.json apps/power-agent-runtime/package.json
COPY shared/types/package.json shared/types/package.json
RUN pnpm install --frozen-lockfile
COPY tsconfig.json tsconfig.json
COPY apps/power-agent-runtime apps/power-agent-runtime
RUN pnpm --filter @nexoria/power-agent-runtime build

FROM node:20-alpine AS production
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /app/apps/power-agent-runtime/dist apps/power-agent-runtime/dist
COPY --from=build /app/apps/power-agent-runtime/package.json apps/power-agent-runtime/package.json
COPY --from=build /app/node_modules node_modules
COPY --from=build /app/apps/power-agent-runtime/node_modules apps/power-agent-runtime/node_modules
# Install system deps for power agent (sqlite, git)
RUN apk add --no-cache sqlite3 git curl ca-certificates
RUN mkdir -p /var/nexoria/data /var/nexoria/skills /var/nexoria/tools
ENV NEXORIA_DATA_DIR=/var/nexoria/data
ENV NEXORIA_SKILLS_DIR=/var/nexoria/skills
ENV NEXORIA_TOOLS_DIR=/var/nexoria/tools
USER node
CMD ["node", "apps/power-agent-runtime/dist/index.js"]
