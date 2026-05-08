# AGENTS.md

This document guides any AI agent continuing work on the Nexoria backend.

## Architecture Overview

Nexoria is a NestJS monorepo backend for an AI-powered agent platform. It is designed around:

- **Workspace-scoped multi-tenancy**: Almost every entity belongs to a workspace.
- **Agent runtime**: A reusable executor loop that loads memory, calls LLMs, and runs tools.
- **Tool registry**: Dynamic, customer-scoped tool discovery via `enabledTools` on agent profiles.
- **4-tier memory**: Profile / Session / Daily / Long-term (semantic search via pgvector).

## Repository Layout

```
/home/openclaw/.hermes/nexoria/
  apps/
    api/
      src/
        app.module.ts              # Root module, imports all domain modules
        main.ts                    # Entry point, Swagger setup
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
          tools/                   # Concrete tool implementations (future expansion)
        common/
          guards/                  # JwtAuthGuard, RolesGuard
          decorators/              # @Roles, @CurrentUser
          interceptors/            # (future)
          filters/                 # (future)
      test/
        jest-e2e.json
        app.e2e-spec.ts
  docker-compose.yml
  .env.example
```

## Critical Files

| File | Responsibility |
|------|---------------|
| `apps/api/src/app.module.ts` | Wire all modules, TypeORM config, environment |
| `apps/api/src/main.ts` | Bootstrap, Swagger, validation pipe, versioning |
| `apps/api/src/database/entities/index.ts` | Barrel export of all entities for TypeORM |
| `apps/api/src/modules/agent-runtime/executor/agent-executor.service.ts` | The core agent loop |
| `apps/api/src/modules/agent-runtime/tool-registry/tool-registry.service.ts` | Tool registration + discovery |
| `apps/api/src/modules/agent-runtime/llm-provider/llm-provider.factory.ts` | Per-profile model resolution |
| `apps/api/src/modules/agent-runtime/memory-context/memory-context.builder.ts` | 4-tier memory assembly |
| `apps/api/src/modules/agent-runtime/reflection/reflection.service.ts` | Post-run memory extraction |

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
- Format method produces a text block injected into the system prompt.

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

## Running the full stack

docker compose up -d
# API on :3000, Swagger on :3000/docs
# Web dev server on :3001 (or proxy via Caddy)

## OpenClaw Managed Runtime

Realtime chat is delegated to a managed OpenClaw gateway. Nexoria stays the canonical control plane (memory, approvals, allowed agents, persisted transcripts); OpenClaw is the chat runtime. A small **runner** is the only service that talks to OpenClaw.

### Topology

| Service | Image | User | Role |
|---------|-------|------|------|
| `openclaw-gateway` | `ghcr.io/openclaw/openclaw:latest` | `node` (uid 1000) | Hosts the OpenClaw WS gateway on `:18789`, the agent runtime, and the MCP client (`bundle-mcp`). Internal only — never expose 18789 to the host. |
| `openclaw-runner` | local | `node` (uid 1000) | Long-polls Nexoria for chat commands, talks to the OpenClaw gateway over WS, posts events back. The only service authorised to speak the gateway protocol. |
| `api` (Nest module `McpModule`) | local | root | Hosts the **MCP server** at `GET /api/v1/mcp` (SSE) + `POST /api/v1/mcp/messages?sessionId=…`. Exposes `create_task`, `list_tasks`, `update_task_status`. |

### Flow on a chat message

1. Frontend POSTs `/workspaces/:wsId/runtime/chat/sessions/:sessionId/messages`.
2. `ManagedRuntimeService.sendChatMessage` persists the message and enqueues a `RuntimeChatCommand` (`type=send_message`). On the **first** message of a session it includes `context` (workspaceId, allowedAgentIds, agent profile, instructions); subsequent messages don't — OpenClaw's session retains transcript state server-side.
3. `openclaw-runner` polls `/runner/runtime/instances/:key/chat/commands/next`, calls `chat.send` over the gateway WebSocket. If the cached `openclawSessionKey` is dead (volume wipe, agent rename), the runner detects "agent no longer exists / unknown session" errors, calls `sessions.create` again, prepends a small recovery context block, and retries once.
4. OpenClaw's bundle-mcp client connects to our MCP server at boot of an agent run, calls `tools/list`, exposes `create_task` etc. to the LLM as native function-call tools.
5. When the LLM calls a tool → MCP server writes to DB via existing `TasksService` → emits a per-workspace SSE event → frontend tasks board updates live.
6. Final assistant text streams back to Nexoria via `runner-runtime/.../events`, which fans out to the chat SSE channel.

### Critical invariants (don't regress these)

- **MCP server speaks legacy MCP HTTP+SSE transport.** OpenClaw's `bundle-mcp` does `GET <url>` expecting `text/event-stream` and reads the `endpoint` event for the messages POST URL. The MCP server uses the official `@modelcontextprotocol/sdk` (`SSEServerTransport`) — **one `Server` instance per SSE connection** (the SDK rejects sharing).
- **Tolerate repeated `Authorization` headers.** OpenClaw's bundle-mcp appends the configured `headers.Authorization` on top of one HTTP already attached, so the upstream sees `Bearer X, Bearer X`. `McpService.authenticate` splits on `,` and accepts a match in any part. If you tighten this back to exact-equality, MCP silently 401s and the LLM hallucinates tool calls.
- **Runner runs as `node` (uid 1000).** Same UID as the gateway. Files written into the shared `openclaw_config` / `openclaw_workspace` volumes must not be root-owned, or the gateway can't write `AGENTS.md` / `paired.json`. Don't add `USER root` or `user: 0:0` to the runner.
- **Runner does NOT write into `OPENCLAW_WORKSPACE_DIR`.** That dir belongs to OpenClaw (it auto-creates `AGENTS.md`, `BOOTSTRAP.md`, `IDENTITY.md`, `SOUL.md`, `TOOLS.md`, etc.). The runner only writes to `OPENCLAW_CONFIG_DIR` and only when strictly needed.
- **Connect frame must NOT have a root-level `nonce`.** Inside `device.nonce` only. The gateway's schema validator rejects the frame with `invalid connect params: at root: unexpected property 'nonce'` — this used to silently drop the runner to a (now-removed) HTTP fallback.
- **Pre-pair the runner during gateway boot.** The gateway's compose entrypoint runs a small Node script after `openclaw config patch` that generates the runner's Ed25519 identity (mode 0644, node-owned) if missing, then injects the deviceId into `devices/paired.json`. Without this, the runner's first `sessions.create` hits "pairing required: device is not approved yet" and dies. Don't move this step or pre-pair will run before onboard creates `devices/paired.json`.
- **`mcp.servers.nexoria` lives in the python-generated config patch**, not a separate `openclaw mcp set` CLI call. The CLI requires a fresh /tmp/openclaw-<uid> per invocation and chained CLI calls fight for it; in-config-patch is idempotent and avoids the temp-dir flake.

### Adding a new MCP tool

1. Define it in `apps/api/src/modules/mcp/mcp.service.ts:registerTaskTools` (or a peer method) — `name`, `description`, JSON-schema `inputSchema`, `execute(args)`.
2. The execute body should call into existing services (`TasksService`, `MemoryService`, `ApprovalsService`, …). Reuse the workspace-scoping that already exists; don't bypass approvals.
3. The LLM auto-discovers the tool on the next agent run via `tools/list`. No restart of the gateway needed (only the API).
4. Add a sentence to the `instructions` array in `ManagedRuntimeService.buildRuntimeChatContext` only if the tool needs a non-obvious cue (e.g. *"prefer creating a task over describing it in chat"*). Don't list every tool — bundle-mcp surfaces them automatically.

### Frontend SSE for live updates

- `TasksService` exposes `streamWorkspaceEvents(workspaceId)` (RxJS Subject keyed by workspace).
- Endpoint: `GET /workspaces/:wsId/tasks/events` (SSE).
- Frontend: `useTasksStore.subscribe(workspaceId)` opens an `useApiStream`, applies `task.created` / `task.updated` / `task.deleted` events to local state. Called on `pages/tasks.vue` mount, unsubscribed on unmount.

### Diagnostics & recovery

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| `Agent "X" no longer exists in configuration` | Cached `openclawSessionKey` references an OpenClaw agent that's gone (e.g. volume wipe). | Runner now self-heals — recreates session and retries once. To force-clean: `UPDATE runtime_chat_sessions SET "openclawSessionKey"=NULL, "openclawSessionId"=NULL WHERE …`. |
| `pairing required: device is not approved yet` | `nexoria_openclaw_config` volume was reset but `devices/paired.json` wasn't re-seeded. | Restart the gateway — pre-pair script regenerates the runner identity and adds it to `paired.json`. |
| LLM "creates" a task but DB row never appears | `bundle-mcp` couldn't connect to our MCP server, so the LLM has no real tools and improvises with the gateway's `exec` tool, often inventing fake task IDs. | Check `docker logs nexoria_openclaw_gateway \| grep bundle-mcp`. If 401/4xx, debug auth header (most common: someone re-tightened the auth check to exact equality). Check `docker logs nexoria_api \| grep McpService` for `mcp session opened`. |
| `EACCES: permission denied … paired.json` / `AGENTS.md` | Root-owned files in shared volumes (runner ran as root in a past version). | One-shot fix: `docker run --rm -v nexoria_openclaw_workspace:/ws alpine chown -R 1000:1000 /ws` (and the same for `nexoria_openclaw_config`). |
| `Unable to create fallback OpenClaw temp dir: /tmp/openclaw-1000` | Docker Desktop VM disk full. | `docker system prune -f` + `docker builder prune -f`. |
| `[bundle-mcp] failed to start server "nexoria": Already connected to a transport` | We tried to share one MCP `Server` across connections. | One `Server` per `SSEServerTransport` — see `McpService.openSseTransport`. |

### Env vars

| Var | Default | Purpose |
|-----|---------|---------|
| `OPENCLAW_GATEWAY_TOKEN` | `dev-openclaw-token-change-me` | Gateway token-auth. Shared by gateway + runner. |
| `NEXORIA_RUNNER_TOKEN` | `dev-runner-token-change-me` | Auth for runner ↔ Nexoria API endpoints. |
| `NEXORIA_MCP_TOKEN` | `dev-mcp-token-change-me` | Bearer token used by the gateway's bundle-mcp client to authenticate to our MCP server. |
| `NEXORIA_API_BASE_URL` | `http://api:3000/api/v1` | Where the gateway tells bundle-mcp our MCP server lives. |
| `OPENCLAW_GATEWAY_URL` | `http://openclaw-gateway:18789` | Runner → gateway. |
| `OPENCLAW_CONFIG_DIR` / `OPENCLAW_WORKSPACE_DIR` | `/openclaw-config` / `/openclaw-workspace` | Runner-side mounts of the shared `openclaw_config` / `openclaw_workspace` volumes. Same data as `/home/node/.openclaw{,/workspace}` inside the gateway. |
