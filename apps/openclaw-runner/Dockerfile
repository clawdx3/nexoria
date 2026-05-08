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
COPY shared/types/package.json shared/types/package.json
RUN pnpm install --frozen-lockfile
COPY tsconfig.json tsconfig.json
COPY apps/openclaw-runner apps/openclaw-runner
RUN pnpm --filter @nexoria/openclaw-runner build

FROM node:20-alpine AS production
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /app/apps/openclaw-runner/dist apps/openclaw-runner/dist
COPY --from=build /app/apps/openclaw-runner/package.json apps/openclaw-runner/package.json
COPY --from=build /app/node_modules node_modules
COPY --from=build /app/apps/openclaw-runner/node_modules apps/openclaw-runner/node_modules
USER node
CMD ["node", "apps/openclaw-runner/dist/index.js"]
