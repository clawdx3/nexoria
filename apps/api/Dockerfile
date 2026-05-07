# syntax=docker/dockerfile:1
FROM node:20-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

FROM base AS build
COPY . /app
WORKDIR /app
RUN pnpm install --frozen-lockfile
RUN pnpm --filter api build

FROM base AS production
COPY --from=build /app/apps/api/dist /app/apps/api/dist
COPY --from=build /app/apps/api/package.json /app/apps/api/package.json
COPY --from=build /app/node_modules /app/node_modules
COPY --from=build /app/pnpm-workspace.yaml /app/pnpm-workspace.yaml
COPY --from=build /app/package.json /app/package.json
WORKDIR /app
EXPOSE 3000
CMD ["pnpm", "--filter", "api", "start:prod"]
