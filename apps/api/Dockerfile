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
COPY shared/types/package.json shared/types/package.json
RUN pnpm install --frozen-lockfile
COPY tsconfig.json tsconfig.json
COPY apps/api apps/api
COPY shared shared
RUN pnpm --filter @nexoria/api build

FROM base AS production
COPY --from=build /app/apps/api/dist /app/apps/api/dist
COPY --from=build /app/apps/api/package.json /app/apps/api/package.json
COPY --from=build /app/apps/api/node_modules /app/apps/api/node_modules
COPY --from=build /app/node_modules /app/node_modules
COPY --from=build /app/pnpm-workspace.yaml /app/pnpm-workspace.yaml
COPY --from=build /app/package.json /app/package.json
WORKDIR /app
EXPOSE 3000
CMD ["node", "apps/api/dist/main"]
