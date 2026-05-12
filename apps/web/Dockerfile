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
RUN pnpm install --frozen-lockfile
COPY tsconfig.json tsconfig.json
COPY apps/web apps/web
RUN NUXT_TYPECHECK=false pnpm --filter @nexoria/web build

FROM node:20-alpine AS production
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3001
WORKDIR /app
COPY --from=build /app/apps/web/.output ./.output
EXPOSE 3001
CMD ["node", ".output/server/index.mjs"]
