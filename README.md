# Nexoria

AI-powered agent platform for small businesses.

## Stack

- **Backend**: NestJS + TypeORM (PostgreSQL with pgvector)
- **Queue**: BullMQ + Redis
- **AI Layer**: Vercel AI SDK (`ai` + `@ai-sdk/openai`)
- **Validation**: class-validator + class-transformer
- **Docs**: Swagger / OpenAPI via @nestjs/swagger
- **Testing**: Jest (unit + e2e)
- **DevOps**: Docker Compose, pnpm workspaces

## Project Structure

```
/home/openclaw/.hermes/nexoria/
  apps/
    api/          # NestJS backend
      src/
        modules/
          auth/
          users/
          workspaces/
          tasks/
          missions/
          approvals/
          agent-profiles/
          memory/
          integrations/
          playbooks/
          audit/
          agent-runtime/     # Core agent engine
            executor/
            tool-registry/
            llm-provider/
            memory-context/
            reflection/
          tools/
        common/
        config/
        database/entities/
      test/
    web/          # Placeholder for Nuxt frontend
  docker-compose.yml
  .env.example
  README.md
  AGENTS.md
```

## Quick Start

### 1. Prerequisites

- Node.js 20+
- pnpm 9+
- Docker + Docker Compose

### 2. Install dependencies

```bash
pnpm install
```

### 3. Environment

```bash
cp .env.example .env
# Edit .env with your API keys
```

### 4. Start infrastructure

```bash
docker compose up -d postgres redis
```

### 5. Run API

```bash
pnpm dev
```

API will be available at `http://localhost:3000/api`
Swagger docs at `http://localhost:3000/docs`

## Docker Compose (full stack)

```bash
docker compose up -d
```

Services:
- `postgres` - PostgreSQL 16 + pgvector
- `redis` - Redis 7
- `api` - NestJS API server
- `worker` - BullMQ worker container
- `migrate` - TypeORM migration runner (run on demand)

## Key Commands

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start API in watch mode |
| `pnpm --filter api build` | Build API |
| `pnpm --filter api test` | Run unit tests |
| `pnpm --filter api test:e2e` | Run e2e tests |
| `docker compose up -d` | Start all services |
| `docker compose logs -f api` | Tail API logs |

## API Conventions

- All endpoints prefixed with `/api`
- Versioned via URL (`/api/v1/...`)
- Bearer JWT auth required for most endpoints
- Workspace-scoped routes: `/api/v1/workspaces/:workspaceId/:resource`

## Testing

Unit tests live next to services (`*.spec.ts`).
E2E tests live in `apps/api/test/`.

```bash
pnpm --filter api test
pnpm --filter api test:e2e
```

## License

MIT
