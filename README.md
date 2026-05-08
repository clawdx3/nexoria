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
          tasks/                # SSE events at /workspaces/:wsId/tasks/events
          missions/
          approvals/
          agent-profiles/
          memory/
          integrations/
          playbooks/
          audit/
          agent-runtime/        # Legacy first-party agent engine (still used for RuntimeJob)
            executor/
            tool-registry/
            llm-provider/
            memory-context/
            reflection/
          managed-runtime/      # Bridges Nexoria chat ↔ OpenClaw via the runner
          mcp/                  # MCP server: GET /api/v1/mcp (SSE) + POST /messages
          tools/
        common/
        config/
        database/entities/
      test/
    openclaw-runner/  # Sidecar that talks to the OpenClaw gateway over WS
    web/              # Nuxt 3 frontend
      components/   # Chat, Tasks, Approvals, Layout
      composables/  # API wrappers, stores
      pages/        # Dashboard, Chat, Tasks, Approvals, Settings
      stores/       # Pinia stores (tasks.store now subscribes to SSE for live updates)
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
- `api` - NestJS API server (now also hosts the MCP server at `/api/v1/mcp`)
- `worker` - BullMQ worker container
- `migrate` - TypeORM migration runner (run on demand)
- `openclaw-gateway` - OpenClaw chat runtime; internal-only on `:18789` (never expose to the host)
- `openclaw-runner` - Sidecar bridging Nexoria chat sessions ↔ OpenClaw gateway over WS
- `web` - Nuxt 3 frontend
- `camofox` - Anti-detection browser used by tools

The `openclaw-gateway` entrypoint pre-pairs the runner's Ed25519 device on first boot and registers the Nexoria MCP server (`mcp.servers.nexoria`) into its config — both are idempotent, so wiping the openclaw volumes and bringing the stack up clean Just Works.

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
- Server-sent events: `/api/v1/workspaces/:workspaceId/tasks/events`, `/api/v1/workspaces/:workspaceId/runtime/chat/sessions/:sessionId/events`
- MCP server (consumed by the OpenClaw gateway, not by end users):
  - `GET /api/v1/mcp` — opens an SSE channel; emits the `endpoint` event with the messages URL
  - `POST /api/v1/mcp/messages?sessionId=…` — JSON-RPC 2.0 (`initialize`, `tools/list`, `tools/call`)
  - Auth: `Authorization: Bearer $NEXORIA_MCP_TOKEN` (header may be repeated; both values accepted)

## Testing

Unit tests live next to services (`*.spec.ts`).
E2E tests live in `apps/api/test/`.

```bash
pnpm --filter api test
pnpm --filter api test:e2e
```

## License

MIT
