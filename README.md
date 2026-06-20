# Hospital ERP — Document Registry

A monorepo for issuing and tracking hospital operational documents (work orders, contracts, and issue notes). Documents receive a human-readable sequential code (`WO-2568-0001`, `CT-2568-0002`, `ISS-2568-0003`) that resets per document type per Buddhist-era year. An LLM-backed classify endpoint can infer the document type from free-form text and issue the code automatically.

---

## Repository layout

```
hospital-doc-ai/
├── apps/
│   ├── api/          Elysia REST API  (Bun runtime)
│   └── web/          Next.js 15 frontend
├── packages/
│   ├── types/        Shared ArkType schemas + TypeScript types
│   └── tsconfig/     Shared tsconfig presets
├── docker-compose.yml  PostgreSQL 16 (port 5433)
├── biome.json          Linter / formatter config
└── turbo.json          Turborepo task graph
```

---

## Tech stack

| Layer | Choice |
|---|---|
| Runtime | Bun 1.3.14 |
| Monorepo | Turborepo + Bun workspaces |
| API framework | Elysia.js |
| Database | PostgreSQL 16 |
| ORM | Drizzle ORM + postgres.js |
| Frontend | Next.js 15, React 19 |
| Data fetching | TanStack Query v5 |
| Styling | Tailwind CSS v3, class-variance-authority |
| Validation | ArkType (shared between API and web) |
| LLM | OpenAI-compatible endpoint (default: Typhoon v2.5) |
| Linting | Biome 1.9.4 |
| Unit tests | Bun test |
| E2E tests | Playwright |

---

## Prerequisites

- **Bun ≥ 1.2** — [bun.sh](https://bun.sh)
- **Docker** — for the PostgreSQL container

---

## Quick start

```bash
# 1. Install all workspace dependencies
bun install

# 2. Start PostgreSQL
bun run db:up

# 3. Run migrations
bun run db:migrate

# 4. (Optional) seed sample data
bun run --filter=@app/api db:seed

# 5. Start both API and web in development mode
bun run dev
```

| Service | URL |
|---|---|
| Web | http://localhost:3000 |
| API | http://localhost:3001 |
| Health | http://localhost:3001/health |

---

## Environment variables

Copy `.env.example` to `.env` and adjust as needed. Turborepo reads `.env` and injects these into every task.

| Variable | Default | Description |
|---|---|---|
| `DATABASE_URL` | `postgresql://postgres:pass@localhost:5433/hospital_erp` | PostgreSQL connection string |
| `PORT` | `3001` | API server port |
| `OPENAI_API_KEY` | — | LLM API key |
| `OPENAI_BASE_URL` | `https://api.opentyphoon.ai/v1` | OpenAI-compatible base URL |
| `OPENAI_MODEL` | `typhoon-v2.5-30b-a3b-instruct` | Model name |
| `LLM_TIMEOUT_MS` | `15000` | Request timeout for the LLM call |
| `NEXT_PUBLIC_API_URL` | `http://localhost:3001` | API URL visible to the browser |

---

## API reference

Base path: `http://localhost:3001`

### `GET /health`

```json
{ "status": "ok" }
```

---

### `GET /documents`

List documents (active only — soft-deleted rows are hidden).

**Query parameters**

| Param | Type | Description |
|---|---|---|
| `entityType` | `work_order \| contract \| issue_note` | Filter by type |
| `search` | `string` | Partial match on `code` (case-insensitive) |
| `page` | `integer ≥ 1` | Page number (default `1`) |
| `pageSize` | `1–100` | Rows per page (default `20`) |

**Response**

```json
{
  "rows": [
    {
      "id": "uuid",
      "entityType": "work_order",
      "code": "WO-2568-0001",
      "description": "Elevator motor repair zone B",
      "createdAt": "2025-01-15T08:30:00Z"
    }
  ],
  "total": 42,
  "page": 1,
  "pageSize": 20
}
```

---

### `POST /documents`

Issue a new document manually.

**Request body**

```json
{
  "entityType": "work_order",
  "description": "Elevator motor repair zone B"
}
```

`description` is optional. `entityType` must be one of `work_order`, `contract`, `issue_note`.

**Response** `201` — the created document (same shape as a row in `GET /documents`).

---

### `POST /documents/classify`

Classify free-form text using an LLM, then issue a code automatically.

**Request body**

```json
{ "text": "The elevator in block B is broken and needs urgent repair" }
```

**Response** `201` on success, `200` with `entityType: "unknown"` when classification fails gracefully.

```json
{
  "entityType": "work_order",
  "confidence": 0.97,
  "code": "WO-2568-0004"
}
```

Classification flow:
1. Call LLM — validate response with ArkType schema.
2. On LLM failure or timeout — fall back to English keyword matching.
3. If both fail — return `{ entityType: "unknown", code: null }`.

---

## Document code format

```
{PREFIX}-{YEAR_BE}-{NNNN}
```

| Entity type | Prefix | Example |
|---|---|---|
| Work Order | `WO` | `WO-2568-0001` |
| Contract | `CT` | `CT-2568-0003` |
| Issue Note | `ISS` | `ISS-2568-0012` |

- **YEAR_BE** — Buddhist Era year (CE + 543). The counter resets to `0001` at the start of each new year, independently per entity type.
- **Sequence** — zero-padded to 4 digits, max 9 999 per type per year.
- **Atomicity** — counter increment and document insert happen in one PostgreSQL transaction using `INSERT … ON CONFLICT DO UPDATE SET seq = seq + 1 RETURNING seq`. If the document insert fails, the entire transaction rolls back, so there are no gaps in the sequence.

---

## Database schema

### `documents`

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` | Primary key, `gen_random_uuid()` |
| `entity_type` | `entity_type` enum | `work_order`, `contract`, `issue_note` |
| `code` | `text` | Unique human-readable code |
| `description` | `text` | Optional free-form description |
| `created_at` | `timestamptz` | Auto-set on insert |
| `deleted_at` | `timestamptz` | `NULL` = active; non-NULL = soft-deleted |

Index on `(entity_type, deleted_at)` for filtered list queries.

### `document_counters`

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` | Primary key |
| `entity_type` | `entity_type` enum | |
| `year_be` | `integer` | Buddhist-era year |
| `seq` | `integer` | Last issued sequence number |

Unique constraint on `(entity_type, year_be)` — the target of `ON CONFLICT`.

---

## Shared types (`packages/types`)

All ArkType schemas and inferred TypeScript types live here and are shared between the API and the web app.

| Export | Description |
|---|---|
| `ENTITY_TYPES` | `["work_order", "contract", "issue_note"] as const` |
| `EntityType` | Union type derived from `ENTITY_TYPES` |
| `entityTypeSchema` | ArkType validator for entity type values |
| `createDocumentSchema` | Validates `POST /documents` body |
| `listDocumentsQuerySchema` | Validates `GET /documents` query params |
| `classifyResultSchema` | Validates raw LLM output before trusting it |
| `classifyRequestSchema` | Validates `POST /documents/classify` body |
| `classifyResponseSchema` | Shape of the classify response |
| `documentSchema` | Shape of a document row returned by the API |
| `listDocumentsResponseSchema` | Envelope returned by `GET /documents` |

---

## Frontend

The web app is a single-page document registry at `/documents` (root redirects there).

**Features**

- Paginated table of active documents (10 per page) with columns Code, Type, Description, Issued At.
- **Search** — debounced (300 ms) partial-match on code via `ILIKE`.
- **Type filter** — dropdown to restrict by `work_order`, `contract`, or `issue_note`.
- **+ New Document** modal — choose type and optional description, issue manually.
- **✦ AI Auto-Issue** modal — paste free-form text, let the LLM classify and issue the code.
- **Optimistic updates** — a placeholder row appears immediately on submit; it is replaced by the real row after the API responds, or rolled back on error.
- **Success banner** — shows the issued code after a successful operation, dismissible with ✕.

---

## Development scripts

All scripts are run from the repository root unless noted otherwise.

### Root

| Command | Description |
|---|---|
| `bun run dev` | Start API + web in watch mode (via Turborepo) |
| `bun run build` | Production build for all apps |
| `bun run typecheck` | Run `tsc --noEmit` across all packages |
| `bun run test` | Run all unit / integration tests |
| `bun run test:e2e` | Run Playwright E2E tests against a running dev server |
| `bun run lint` | Biome check (no write) |
| `bun run lint:fix` | Biome check with auto-fix |
| `bun run format` | Biome format with write |
| `bun run db:up` | Start the PostgreSQL Docker container |
| `bun run db:down` | Stop the PostgreSQL Docker container |
| `bun run db:generate` | Generate Drizzle migration files from schema changes |
| `bun run db:migrate` | Apply pending migrations |
| `bun run db:push` | Push schema directly without a migration file (dev only) |
| `bun run db:studio` | Open Drizzle Studio in the browser |
| `bun run clean` | Remove `node_modules`, `.turbo`, and build outputs |

### API only

```bash
bun run --filter=@app/api db:seed   # seed sample documents
bun run --filter=@app/api test      # run unit tests
```

---

## Testing

### Unit / integration tests (`apps/api`)

Tests live alongside source files and run with Bun's built-in test runner against a real PostgreSQL database.

```bash
# Requires db:up + db:migrate first
bun run test
```

`issueCode.test.ts` covers:

- **Concurrent requests** — 10 parallel calls produce 10 unique, gap-free codes.
- **Code format** — prefix, Buddhist-era year, 4-digit zero-padded sequence.
- **Counter isolation** — each entity type maintains its own independent counter.

### E2E tests (`apps/web/e2e`)

Playwright tests run against the full running stack (API + web + PostgreSQL).

```bash
# Terminal 1: ensure db and dev server are running
bun run db:up && bun run db:migrate && bun run dev

# Terminal 2: run E2E suite
bun run test:e2e
```

Coverage:

- Page load — table headers visible.
- Manual issue — all three entity types produce correctly formatted codes; new rows appear in the table.
- Issue with description — description is stored and displayed.
- Success banner — shows the issued code, dismisses on ✕.
- Modal interactions — Cancel button and backdrop click both close the modal.
- Search — debounced input filters rows; clearing search restores all rows.
- Type filter — only matching entity types shown; resetting shows all rows.
- AI Auto-Issue — modal UI, cancel, and full flow with natural-language input.

---

## Database management

```bash
# Start / stop Postgres
bun run db:up
bun run db:down

# After changing apps/api/src/db/schema.ts:
bun run db:generate   # creates a SQL file in apps/api/drizzle/
bun run db:migrate    # applies it

# Visualise data
bun run db:studio
```

The Docker container exposes PostgreSQL on **port 5433** (not the default 5432) to avoid conflicts with any locally-installed instance.

---

## Code style

Biome is the single tool for both linting and formatting. Configuration is in `biome.json` at the root.

- **Indent**: 2 spaces
- **Quotes**: double
- **Semicolons**: always
- **Trailing commas**: all
- **Line width**: 100

Pre-commit or CI should run `bun run lint` and `bun run typecheck`.
