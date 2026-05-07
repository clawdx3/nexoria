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
