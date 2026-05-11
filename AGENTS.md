# AGENTS.md

This document guides any AI agent continuing work on the Nexoria backend.

## Architecture Overview

Nexoria is a NestJS monorepo backend for an AI-powered agent platform. It is designed around:

- **Workspace-scoped multi-tenancy**: Almost every entity belongs to a workspace.
- **Agent runtime**: A reusable executor loop that loads memory, calls LLMs, and runs tools.
- **Tool registry**: Dynamic, customer-scoped tool discovery via `enabledTools` on agent profiles.
- **4-tier memory**: Profile / Session / Daily / Long-term (semantic search via pgvector). Auto-extracted from chat transcripts via a debounced reflection pass; lifecycle service decays, promotes, and expires entries on a daily cron.
- **WebSocket-based real-time chat**: both `native_saas` (inline) and `native_pro` (external container) agents stream tokens to the frontend over Socket.IO.
- **Secure Pro Agent**: Ed25519 challenge-response authentication. No shared secrets for WS auth.

## Repository Layout

```
/home/openclaw/.hermes/nexoria/
  apps/
    api/
      src/
        app.module.ts              # Root module, imports all domain modules
        main.ts                    # Entry point, Swagger, Socket.IO adapter
        config/app.config.ts       # JWT + app config
        database/entities/         # All TypeORM entities
        modules/
          auth/                    # JWT login/register
          users/                   # User CRUD
          workspaces/              # Workspace + membership + invitations
          tasks/                   # Task management
          missions/                # Agent mission tracking
          approvals/               # Approval workflow + decisions
          agent-profiles/          # Per-workspace agent definitions
          memory/                  # Memory entries + semantic search
          integrations/            # OAuth/API integrations
          playbooks/               # Step-by-step automation templates
          audit/                   # Immutable audit log
          agent-runtime/           # Core AI engine
            executor/              # Agent loop (max 10 steps)
            tool-registry/         # Tool discovery + built-in tools
            llm-provider/          # Model resolution (openai/anthropic/openrouter)
            memory-context/        # Assembles 4-tier memory for prompts
            reflection/            # Post-run learning pipeline
            gateway/               # Socket.IO gateway for real-time chat
            loop/                  # Inline agent loop service (native_saas)
          managed-runtime/         # Chat sessions, jobs, instance registry
          mcp/                     # MCP server for tool exposure
        common/
          guards/                  # JwtAuthGuard, RolesGuard, ProAgentHttpGuard
          decorators/              # @Roles, @CurrentUser
    web/                         # Nuxt 3 frontend
      stores/chat.store.ts       # Socket.IO chat client
    pro-agent/                   # External Phoenix Pro Agent container
      src/
        main.ts                  # WS client, registration, job loop
        api-client.ts            # WsProAgentApiClient (Socket.IO + HTTP)
        keys/keys.ts             # Ed25519 key generation & signing
        loop.ts                  # ProAgentLoop wrapping AgentLoopCore
        config.ts                # Env vars + YAML
  docker-compose.yml
  .env.example
```

## Critical Files

| File | Responsibility |
|------|---------------|
| `apps/api/src/app.module.ts` | Wire all modules, TypeORM config, environment |
| `apps/api/src/main.ts` | Bootstrap, Swagger, Socket.IO adapter (`IoAdapter`) |
| `apps/api/src/database/entities/index.ts` | Barrel export of all entities for TypeORM |
| `apps/api/src/modules/agent-runtime/gateway/agent-runtime.gateway.ts` | Socket.IO gateway: JWT auth (FE), Ed25519 auth (Pro Agent), room-based streaming |
| `apps/api/src/modules/agent-runtime/gateway/pro-agent-runner.controller.ts` | `POST /runner/runtime/instances` — Pro Agent registration with Ed25519 signed payload |
| `apps/api/src/modules/agent-runtime/agent-runtime.module.ts` | Registers gateway, exports `AgentRuntimeGateway` |
| `apps/api/src/modules/managed-runtime/managed-runtime.service.ts` | Chat orchestration: inline (`native_saas`) vs external Pro Agent (`native_pro`) |
| `apps/api/src/modules/agent-runtime/executor/agent-executor.service.ts` | The core agent loop |
| `apps/api/src/modules/agent-runtime/tool-registry/tool-registry.service.ts` | Tool registration + discovery |
| `apps/api/src/modules/agent-runtime/llm-provider/llm-provider.factory.ts` | Per-profile model resolution |
| `apps/api/src/modules/agent-runtime/memory-context/memory-context.builder.ts` | 4-tier memory assembly |
| `apps/api/src/modules/agent-runtime/reflection/reflection.service.ts` | Post-run memory extraction (also runs `extractFromTranscript` for chat-driven extraction) |
| `apps/api/src/modules/agent-runtime/reflection/reflection-debouncer.service.ts` | Debounces per-session extraction; sweeps idle sessions every 5 min |
| `apps/api/src/modules/memory/memory-lifecycle.service.ts` | Daily cron: decay, promotion, hard-delete |
| `apps/pro-agent/src/main.ts` | Pro Agent entrypoint: key gen, WS connect, auth, job loop |
| `apps/pro-agent/src/api-client.ts` | `WsProAgentApiClient`: Socket.IO + HTTP heartbeat |
| `apps/pro-agent/src/keys/keys.ts` | Ed25519 key pair generation (`generateAndStoreKeys`, `signMessage`) |
| `apps/web/stores/chat.store.ts` | Frontend chat store: Socket.IO client, real-time streaming |

## Architecture: WebSocket-based Agent Runtime

### Socket.IO Gateway (`AgentRuntimeGateway`)

Namespace: `/agent-runtime`

**Authentication modes:**

1. **Frontend clients** — pass `Bearer <JWT>` in `handshake.auth.token`. Gateway verifies with `jwtSecret`, extracts `sub` (userId) and `workspaceId`, joins room `workspace:<wsId>`.

2. **Pro Agent** — passes no token initially. Gateway emits `auth_challenge` with a random nonce. Pro Agent signs the nonce with its Ed25519 private key and sends `auth_response` with `{ instanceKey, signature }`. Gateway verifies against the public key stored in `RuntimeInstance.metadata.ed25519PublicKey`. On success, joins `workspace:<wsId>` and `instance:<instanceKey>`.

**Rooms:**
- `workspace:<workspaceId>` — all FE clients + Pro Agent for that workspace
- `instance:<instanceKey>` — targeted delivery to a specific Pro Agent

**Events emitted to FE:**
- `chat.user_message` — user message persisted
- `chat.assistant_delta` — streaming token (native_saas + native_pro)
- `chat.assistant_final` — final message with full payload
- `chat.status` — tool call status
- `chat.error` — error message

**Events received from FE:**
- `chat.send` — payload `{ sessionId, content, attachmentIds? }` → `ManagedRuntimeService.sendChatMessage()`

**Events received from Pro Agent:**
- `job.claim` — claim next queued job for this instance
- `job.complete` — `{ jobId, status, result?, error? }`
- `job.event` — runtime event logging
- `chat.chunk` — `{ sessionId, jobId, content }` → forwarded to workspace room as `chat.assistant_delta`
- `chat.final` — `{ sessionId, jobId, content }` → saved as `assistant` message, forwarded as `chat.assistant_final`

### Chat Flow: `native_saas` (Inline)

1. FE emits `chat.send` over Socket.IO.
2. Gateway's `handleChatSend` calls `ManagedRuntimeService.sendChatMessage()`.
3. `AgentLoopService.run()` produces tokens via callback.
4. Each token is emitted to `workspace:<wsId>` as `chat.assistant_delta`.
5. On completion, the final assistant message is saved to DB and emitted as `chat.assistant_final`.

### Chat Flow: `native_pro` (Pro Agent)

1. FE emits `chat.send` over Socket.IO.
2. Gateway calls `ManagedRuntimeService.sendChatMessage()`.
3. API creates a `RuntimeJob` of type `native_pro_chat`, bound to the Pro Agent instance.
4. If the Pro Agent is connected via WS (`gateway.isInstanceConnected()`), the job status is set to `running` and `job.pushed` is emitted to `instance:<instanceKey>`.
5. If offline, the job stays `queued` and FE gets a `chat.status` saying "Pro Agent offline, queued".
6. Pro Agent receives `job.pushed`, runs its `AgentLoopCore`, emits `chat.chunk` (streamed to FE in real-time) and `chat.final` (saved to DB and broadcast).
7. Pro Agent emits `job.complete` with the result.

### Pro Agent Security (Ed25519)

- **Key generation**: On first boot, the Pro Agent generates an Ed25519 key pair via `tweetnacl.sign.keyPair()`. Private key is stored in `ed25519_private_key.pem` (mode 0o600) in the container's data volume. Public key in `ed25519_public_key.pem`. These never leave the container.
- **Registration**: `POST /runner/runtime/instances` sends `{ instanceKey, workspaceId, mode, version, metadata: { ed25519PublicKey } }` with a `X-Pro-Agent-Signature` header containing the Ed25519 signature of the JSON body.
- **WS auth challenge**: API sends random nonce → Pro Agent signs → API verifies with stored public key. No shared secrets required.
- **Future hardening**: mTLS can be layered on top (Caddy/Traefik terminates client cert, passes `X-Client-Cert-Hash`).

## Key Conventions

### TypeORM Entities
- All primary keys are UUIDs (`@PrimaryGeneratedColumn('uuid')`).
- Workspace-scoped entities have `workspaceId` column + `@ManyToOne(() => Workspace)`.
- JSONB fields use `Record<string, any>` or arrays.
- Enums are defined as TS types + `type: 'enum'` in `@Column`.
- **Never use `synchronize: true` in production**. Migrations should be generated via TypeORM CLI.

### DTOs
- Use `class-validator` decorators for every field.
- Use `@ApiProperty()` / `@ApiPropertyOptional()` from `@nestjs/swagger` for auto-generated docs.
- Do **not** type Swagger examples manually — rely on DTOs.
- Use `class-transformer` `@Type(() => Date)` for date fields in DTOs.

### Services
- One service per domain. No god files.
- Services map entities to Response DTOs in a private `toDto()` method.
- Use NestJS `@Injectable()` and inject repositories via `@InjectRepository`.

### Controllers
- All controllers use `@ApiTags`, `@ApiBearerAuth`, and `@ApiResponse`.
- Workspace-scoped routes pattern: `@Controller('workspaces/:workspaceId/:resource')`.
- Apply `JwtAuthGuard` globally or per-controller.

### Agent Runtime

#### Agent Loop (`AgentExecutorService`)
1. Load 4-tier memory via `MemoryContextBuilder`.
2. Build system prompt with tool descriptions + memory text.
3. Run LLM via `LlmProviderFactory`.
4. Parse JSON tool call from LLM output.
5. Validate arguments with tool's Zod schema.
6. Execute tool with `ToolContext`.
7. Append result to messages, repeat (max 10 steps).
8. Post-run: `ReflectionService` extracts patterns and stores them in memory.

#### Tool Registry
- Tools are registered at module init in `ToolRegistryService`.
- Each tool has: `name`, `description`, `schema` (Zod), `riskLevel` (1-3), `execute` function.
- Tools are filtered by `ctx.agentProfile.enabledTools`.

#### LLM Provider Factory
- Resolves model based on `agentProfile.modelProvider`.
- Supports: `openai`, `anthropic` (via OpenRouter), `openrouter`, `custom`.
- Falls back to `gpt-4o` if unknown.

#### Memory Context Builder
- Loads from `memory_entries` table filtered by `workspaceId`, `userId`, and tier.
- Long-term tier uses `embedding` column with pgvector cosine similarity (`<=>` operator).
- After every recall, fires-and-forgets a `lastValidatedAt` touch on returned IDs so semantically-recalled memories don't decay.
- Format method produces a text block injected into the system prompt.

### Memory Lifecycle and Auto-Extraction

Nexoria's DB memory is canonical. Two background services keep the canonical store healthy without requiring agents to remember to call `create_memory`:

#### Auto-extraction (`ReflectionService.extractFromTranscript`)
- Triggered by `ReflectionDebouncerService.schedule(workspaceId, sessionId, userId)`, which `ManagedRuntimeService` calls after every saved `assistant_final` message.
- Debouncer waits `REFLECTION_FLUSH_DELAY_MS` (default 30s) and re-arms on new turns. Multi-turn sessions get one extraction call instead of N.
- Extraction reads only messages newer than `RuntimeChatSession.metadata.lastReflectedMessageId`, runs a single cheap LLM call (configurable via `MEMORY_EXTRACTION_PROVIDER` / `MEMORY_EXTRACTION_MODEL`, default `openai` / `gpt-4o-mini`), parses structured JSON, and writes rows tagged `metadata.source='reflection'` with `metadata.sourceMessageRange=[firstId,lastId]`.
- Long-term entries are auto-embedded; embedding failures fall through silently.
- A 5-minute sweep (`sweepStaleSessions`) catches sessions that idled out without a debouncer flush (closed tab, etc.).

#### Lifecycle (`MemoryLifecycleService`, daily cron via `@nestjs/schedule`)
- **Decay**: entries with no validation in `MEMORY_DECAY_AFTER_DAYS` days (default 14) get `confidence *= MEMORY_DECAY_FACTOR` (default 0.95), floor `MEMORY_DECAY_FLOOR` (default 0.1).
- **Promotion**:
  - `session` → `daily` after `>= MEMORY_SESSION_PROMOTE_USES` keeps (default 2) and confidence > `MEMORY_SESSION_PROMOTE_CONFIDENCE` (default 0.6).
  - `daily` → `long_term` after `MEMORY_DAILY_PROMOTE_AGE_DAYS` (default 7) at confidence > `MEMORY_DAILY_PROMOTE_CONFIDENCE` (default 0.7), with embedding backfilled at promotion time.
- **Hard delete**: `expiresAt` past, OR `>= MEMORY_HARD_DELETE_NEGATIVE_USES` rejects (default 3) with no positive uses, OR confidence < `MEMORY_HARD_DELETE_CONFIDENCE` (default 0.05).
- Each phase is independently invokable for tests/manual runs.

#### Memory provenance
Memories are tagged with `metadata.source` so the UI can show how each one entered the store:
- `reflection` — auto-extracted from chat transcript.
- `reflection-tool` — written by the post-run pattern extractor in `ReflectionService.reflect`.
- `mcp:create_memory` — explicit agent call via the MCP tool.
- `manual` — UI-driven (default).

#### Module wiring (avoid the cycle)
`ReflectionService` and `ReflectionDebouncerService` live in **`MemoryModule`**, not `AgentRuntimeModule`. Importing them through `AgentRuntimeModule` re-creates a `TasksModule -> ManagedRuntimeModule -> AgentRuntimeModule -> TasksModule` cycle. `AgentExecutorService` still injects `ReflectionService` because `AgentRuntimeModule` already imports `MemoryModule`.

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DB_HOST` | Yes | PostgreSQL host |
| `DB_PORT` | Yes | PostgreSQL port (5432) |
| `DB_USER` | Yes | DB user |
| `DB_PASSWORD` | Yes | DB password |
| `DB_NAME` | Yes | DB name |
| `REDIS_URL` | Yes | Redis connection string |
| `JWT_SECRET` | Yes | JWT signing secret |
| `JWT_EXPIRES_IN` | No | Token expiry (default 7d) |
| `OPENAI_API_KEY` | No | Required if using OpenAI models |
| `OPENROUTER_API_KEY` | No | Required if using Anthropic/OpenRouter |
| `MEMORY_EXTRACTION_PROVIDER` | No | `openai` (default), `openrouter`, or `ollama` for the auto-extraction LLM |
| `MEMORY_EXTRACTION_MODEL` | No | Model id for auto-extraction (default `gpt-4o-mini`) |
| `REFLECTION_FLUSH_DELAY_MS` | No | Debounce window before extraction fires (default 30000) |
| `REFLECTION_SWEEP_INTERVAL_MS` | No | Idle-session sweep interval (default 300000) |
| `MEMORY_DECAY_AFTER_DAYS` / `MEMORY_DECAY_FACTOR` / `MEMORY_DECAY_FLOOR` | No | Memory decay tuning |
| `MEMORY_SESSION_PROMOTE_USES` / `MEMORY_SESSION_PROMOTE_CONFIDENCE` | No | session→daily promotion thresholds |
| `MEMORY_DAILY_PROMOTE_AGE_DAYS` / `MEMORY_DAILY_PROMOTE_CONFIDENCE` | No | daily→long_term promotion thresholds |
| `MEMORY_HARD_DELETE_NEGATIVE_USES` / `MEMORY_HARD_DELETE_CONFIDENCE` | No | Hard-delete thresholds |
| `NEXORIA_PRO_AGENT_TOKEN` | No | Legacy pre-shared token (fallback for WS auth during migration) |

## Testing Conventions

- Unit tests: `*.spec.ts` next to the service.
- E2E tests: `apps/api/test/*.e2e-spec.ts`.
- Mock TypeORM repositories with `getRepositoryToken(Entity)`.
- Mock external services (LLM factory, reflection) in agent runtime tests.

## Common Pitfalls

1. **Do not import entities by relative path in module files** — import from `../../database/entities` barrel.
2. **pgvector extension must be enabled** in PostgreSQL. The `ankane/pgvector` Docker image handles this.
3. **Agent profile `workspaceId = null`** means a global built-in template. Custom agents must have a `workspaceId`.
4. **Tool schema validation failures** are caught and fed back to the LLM as user messages so it can retry.
5. **Max 10 steps** in the executor loop prevents infinite loops.
6. **BullMQ workers** are stubbed in `docker-compose.yml` as a separate container. Wire actual queues when implementing background jobs.
7. **Do not commit `.env`** — only `.env.example` is tracked.
8. **Never use emojis** in code, docs, or commit messages. Use Lucide/Heroicons for UI icons.
9. **Do not share one Socket.IO `Server` instance per connection** — the NestJS gateway creates one adapter per app, which is correct. Each Pro Agent gets its own socket.
10. **Pro Agent private key must never leave the container** — it is stored in the `pro_agent_data` Docker volume, not in the image.

## How to Add a New Domain Module

1. Create entity in `database/entities/` and export from `index.ts`.
2. Create DTOs in `modules/<domain>/dto/`.
3. Create service, controller, module in `modules/<domain>/`.
4. Import module in `app.module.ts`.
5. Add controller route under `workspaces/:workspaceId/<domain>` if workspace-scoped.
6. Write unit tests (`<service>.spec.ts`).
7. Add Swagger decorators to controller.

## How to Add a New Tool

1. Register in `ToolRegistryService.registerBuiltIns()`.
2. Define Zod schema, description, risk level, and `execute` function.
3. Ensure `execute` accepts `(args, ToolContext)` and returns a serializable object.
4. Add tool name to agent profile `enabledTools` to make it available.
5. Write test in `tool-registry.service.spec.ts`.

## Migrations

When not in dev mode (`synchronize: false`), generate migrations:

```bash
pnpm --filter api typeorm migration:generate -d src/data-source.ts src/migrations/AddX
```

Run migrations:

```bash
docker compose run --rm migrate
```

## Contact

GitHub: https://github.com/clawdx3/nexoria

## Frontend (Nuxt 3)

- **Tech**: Nuxt 3, Vue 3 Composition API, TypeScript, Tailwind CSS, @nuxt/ui, Pinia
- **Icons**: lucide-vue-next (NO emojis)
- **Pages**: / (dashboard chat), /tasks, /approvals, /chat/[profile], /settings/*
- **Components**: ChatWindow, ChatMessage, ChatInput, TaskCard, TaskStatusBadge, ApprovalCard, ApprovalPreview, AppSidebar, AppHeader
- **Composables**: useApi, useAuth, useAgent, useTasks, useApprovals, useMemory, useRealtime
- **Stores**: auth.store, workspace.store, chat.store, tasks.store
- **Real-time chat**: Socket.IO client connects to `/agent-runtime` namespace with JWT auth. Emits `chat.send`, listens to `chat.*` events for streaming tokens.

## Running the full stack

```bash
docker compose up -d
# API on :3000, Swagger on :3000/docs, WebSocket on :3000/agent-runtime
# Web dev server on :3001
# Pro Agent (optional): docker compose --profile pro up -d
```

## Pro Agent (Phoenix Pro)

The Pro Agent is a standalone container that connects to the API over WebSocket with Ed25519 authentication. It provides:
- **Dedicated compute** for powerful agents (unlimited steps, local tools, file system access)
- **Dedicated LLM context** — runs its own LLM loop independent of the API's inline loop
- **Real-time streaming** — chat tokens stream directly to the frontend via the API gateway

### Container

- Image: built from `apps/pro-agent/Dockerfile`
- User: `node` (uid 1000)
- Healthcheck: `curl -f http://localhost:3002/health`
- Volumes: `pro_agent_data` (Ed25519 keys + local state)
- Compose profile: `pro`

### Configuration

| Env Var | Default | Description |
|---------|---------|-------------|
| `NEXORIA_API_URL` | `http://localhost:3000/api/v1` | API base URL |
| `NEXORIA_WORKSPACE_ID` | — | Workspace this agent serves |
| `NEXORIA_AGENT_PROFILE_ID` | — | Optional fixed agent profile |
| `LLM_PROVIDER` | `openai` | LLM provider for the Pro Agent |
| `LLM_API_KEY` | — | API key for the LLM |
| `LLM_MODEL` | `gpt-4o` | Model name |
| `LOCAL_DIR` | `./data` | Local data directory (inside container) |

### Lifecycle

1. On first start, generates Ed25519 key pair in `LOCAL_DIR` if missing.
2. Registers itself with API via signed HTTP POST to `/runner/runtime/instances`.
3. Connects WebSocket to `/agent-runtime` and responds to `auth_challenge` with signed nonce.
4. Receives `job.pushed` events when chat jobs are created. Falls back to `job.claim` polling.
5. Runs the agent loop, streams tokens via `chat.chunk`, final message via `chat.final`.
6. Sends `job.complete` when done.
7. Heartbeats via HTTP POST every 15s.

### Security invariants

- **Ed25519 private key never leaves the container** — stored in volume, not in config or env.
- **Registration payload is signed** — API verifies `X-Pro-Agent-Signature` against the public key in the payload.
- **WS auth is challenge-response** — no pre-shared secrets. API sends nonce, Pro Agent signs, API verifies with stored pubkey.
- **Fallback legacy token** — `NEXORIA_PRO_AGENT_TOKEN` can be passed as `X-Pro-Agent-Token` during migration, but should be removed once all instances have Ed25519 keys.

## Diagnostics & recovery

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| FE shows "Connection lost" | Socket.IO not connected or auth failed | Check browser devtools WS tab. Ensure JWT is valid. Check `AgentRuntimeGateway` logs. |
| Pro Agent shows "auth timeout" | Instance key mismatch or missing public key | Verify `instanceKey` matches DB row. Check `RuntimeInstance.metadata.ed25519PublicKey` is set. Regenerate keys if needed. |
| `Invalid Ed25519 signature` | Wrong private key or nonce tampering | Ensure the Pro Agent is using the same key pair that was registered. Delete `data/ed25519_*.pem` to regenerate. |
| Pro Agent offline but jobs queued | WS disconnected, but heartbeat still running | Check `AgentRuntimeGateway.instanceSockets` map. Heartbeat and WS are separate — a Pro Agent can heartbeat but fail WS auth. |
| `Cannot find module 'tweetnacl'` | Missing dependency | Run `pnpm install` in workspace root. Ensure `tweetnacl` is in `apps/api/package.json` and `apps/pro-agent/package.json`. |

## Removed / Deprecated

The following OpenClaw-related components have been removed. Do not re-introduce them:

- `openclaw-gateway` service
- `openclaw-runner` service
- `RuntimeChatCommand` entity
- `RuntimeRunnerController` (and `RunnerTokenGuard`)
- `NEXORIA_RUNNER_TOKEN`, `OPENCLAW_GATEWAY_TOKEN`, `OPENCLAW_CONFIG_DIR`, `OPENCLAW_WORKSPACE_DIR`
- SSE `/chat/sessions/:id/events` endpoint (replaced by Socket.IO)
- HTTP polling for Pro Agent job claiming (replaced by WS `job.pushed` + `job.claim`)
