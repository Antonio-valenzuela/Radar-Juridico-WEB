# Juridico Radar Portfolio Upgrade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert Juridico Radar into a professional, interview-defensible portfolio project without overengineering the product.

**Architecture:** Keep the current Next.js modular monolith and strengthen documentation, pipeline reliability, UI, tests, IA traceability, search and observability in phases. Each phase should produce visible portfolio value.

**Tech Stack:** Next.js 16, React 19, TypeScript, Prisma/PostgreSQL, Redis/BullMQ, Tailwind, pgvector, OpenTelemetry, Prometheus/Grafana, GitHub Actions.

---

## File Map

- `README.md`: replace template content with professional project overview and setup.
- `docs/blueprints/juridico-radar-blueprint.md`: source of truth for architecture and roadmap.
- `docs/adr/`: architectural decision records.
- `docs/architecture/`: focused diagrams and runbooks.
- `docs/api/`: API examples and collection notes.
- `app/page.tsx`: dashboard UX polish.
- `app/globals.css`: design tokens and global styles.
- `lib/ingest/`: idempotency, job state, DLQ and parser reliability.
- `lib/notifications/`: alert rules and delivery contracts.
- `lib/consultant/`: IA guardrails, citations and prompt versioning.
- `lib/search/`: FTS and future pgvector search.
- `prisma/schema.prisma`: future document/chunk/embedding models.
- `worker/ingestWorker.ts`: queue reliability and job telemetry.
- `.github/workflows/ci.yml`: CI pipeline.

## Task 1: Professional Documentation Baseline

**Files:**
- Modify: `README.md`
- Create: `docs/adr/0001-modular-monolith-first.md`
- Create: `docs/architecture/system-overview.md`

- [ ] **Step 1: Replace README template**

Write a README with:

```markdown
# Juridico Radar

SaaS legal-tech mexicano para monitorear fuentes oficiales, clasificar publicaciones juridicas y generar alertas accionables para equipos legales y de cumplimiento.

## Highlights

- Ingesta multi-fuente de publicaciones oficiales mexicanas.
- Deduplicacion por URL, source id, URL canonica y hash.
- Clasificacion por impacto, tipo, tema y categoria.
- Watchlists, notificaciones y resumenes ejecutivos.
- Diffs normativos e insights tipo consultor con IA/fallback deterministico.

## Stack

Next.js 16, React 19, TypeScript, Prisma, PostgreSQL, Redis, BullMQ, Tailwind, Recharts.
```

- [ ] **Step 2: Add ADR for modular monolith**

Create `docs/adr/0001-modular-monolith-first.md` explaining:

```markdown
# ADR 0001: Modular Monolith First

## Status
Accepted

## Context
Juridico Radar is built by one developer and needs full product velocity while keeping a path to enterprise scale.

## Decision
Use a modular monolith with asynchronous workers. Keep ingestion, notifications, search, consultant insights and metrics as modules, not separate services, until load or team ownership justifies extraction.

## Consequences
This reduces DevOps cost and keeps types/shared domain close. The risk is module coupling, mitigated by small files, explicit contracts, queues and tests.
```

- [ ] **Step 3: Add system overview doc**

Create `docs/architecture/system-overview.md` with the Mermaid architecture diagram from `docs/blueprints/juridico-radar-blueprint.md`.

- [ ] **Step 4: Verify docs**

Run:

```powershell
Get-Content README.md
Get-ChildItem docs -Recurse -File
```

Expected: files exist and contain no template Create Next App copy.

## Task 2: Ingestion Reliability

**Files:**
- Modify: `lib/ingest/runIngest.ts`
- Modify: `worker/ingestWorker.ts`
- Test: `lib/ingest/runIngest.test.ts`

- [ ] **Step 1: Write failing tests for idempotent ingest**

Test that a duplicate source item increments duplicate count and does not create a second item.

- [ ] **Step 2: Write failing tests for partial failures**

Test that one bad raw item records an error while valid items continue processing.

- [ ] **Step 3: Implement processing status fields if needed**

Keep `IngestRun` compatible, but ensure results report `ok`, `found`, `saved`, `duplicates`, `errors` and `checkpoint`.

- [ ] **Step 4: Add DLQ design**

If schema changes are deferred, document DLQ behavior in code comments and route failed BullMQ jobs to failed-state logging. If schema changes are accepted, add `ProcessingJob` later in Task 6.

- [ ] **Step 5: Verify**

Run:

```powershell
npm run lint
npm test -- runIngest
```

Expected: lint clean and ingest tests pass.

## Task 3: Dashboard UX Polish

**Files:**
- Modify: `app/page.tsx`
- Modify: `app/globals.css`
- Optional create: `app/components/MetricCard.tsx`
- Optional create: `app/components/ItemCard.tsx`

- [ ] **Step 1: Extract repeated UI**

Create focused components for metric cards, badges and item cards. Preserve existing behavior.

- [ ] **Step 2: Improve empty state**

Replace "Cargando datos..." as the only empty state with distinct states:

```text
Sin novedades para esta vista.
Si es la primera ejecucion, usa "Actualizar ahora" para iniciar ingesta.
```

- [ ] **Step 3: Add professional visual system**

Use restrained SaaS styling: neutral background, clear surfaces, legal/regulatory accent colors, 8px radius, visible focus states, 44px touch targets.

- [ ] **Step 4: Verify in Chrome**

Open `http://localhost:3000`, inspect desktop and narrow viewport, and confirm no overlapping text, broken controls or misleading empty states.

## Task 4: Search and Alert Contracts

**Files:**
- Modify: `app/api/items/route.ts`
- Modify: `app/api/watchlist/route.ts`
- Modify: `lib/notifications/run.ts`
- Create: `docs/api/examples.md`

- [ ] **Step 1: Add response shape documentation**

Document request/response examples for `/api/items`, `/api/watchlist`, `/api/notify/run` and future `/api/v1/search`.

- [ ] **Step 2: Add validation tests**

Test invalid watchlist type, missing value, invalid email and valid add/list/remove flow.

- [ ] **Step 3: Add consistent error shape**

Use:

```json
{ "ok": false, "error": { "code": "VALIDATION_ERROR", "message": "..." } }
```

where practical without breaking current UI.

## Task 5: IA Guardrails and Citations

**Files:**
- Modify: `lib/consultant/llm.ts`
- Modify: `lib/consultant/generate.ts`
- Modify: `lib/consultant/types.ts`
- Test: `lib/consultant/generate.test.ts`

- [ ] **Step 1: Add tests for fallback**

Test that deterministic fallback returns disclaimer, confidence and action items when LLM provider is missing.

- [ ] **Step 2: Add citation-ready fields**

Extend report types with optional `citations` and `disclaimer`.

- [ ] **Step 3: Harden prompt**

Add instruction that documents are untrusted data and legal advice is not definitive.

- [ ] **Step 4: Verify**

Run consultant tests and manually open an item consultant page.

## Task 6: Data Model Evolution for RAG

**Files:**
- Modify: `prisma/schema.prisma`
- Create migration: `prisma/migrations/<timestamp>_document_rag_models/migration.sql`
- Create: `lib/search/hybrid.ts`

- [ ] **Step 1: Add document/chunk/embedding models**

Add `Document`, `DocumentVersion`, `DocumentMetadata`, `DocumentChunk`, `Embedding` in a backwards-compatible way.

- [ ] **Step 2: Enable pgvector**

Add SQL migration:

```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

- [ ] **Step 3: Create hybrid search skeleton**

Implement a non-LLM function signature:

```ts
export async function hybridSearch(params: {
  query: string;
  filters?: Record<string, string>;
  limit?: number;
}) {
  return [];
}
```

- [ ] **Step 4: Verify Prisma**

Run:

```powershell
npx prisma generate
npx prisma validate
```

Expected: Prisma schema validates.

## Task 7: Observability and CI

**Files:**
- Create: `.github/workflows/ci.yml`
- Create: `docs/architecture/observability.md`
- Modify: `worker/ingestWorker.ts`

- [ ] **Step 1: Add CI workflow**

Include install, lint, typecheck and build.

- [ ] **Step 2: Document metrics**

Create metrics table for ingestion, search, queue, embeddings and notifications.

- [ ] **Step 3: Ensure worker structured logs**

Keep logs JSON with `event`, `job`, `id`, `source`, `durationMs`, `ok`.

- [ ] **Step 4: Verify**

Run:

```powershell
npm run lint
npm run build
```

Expected: both pass, or document blockers precisely.

## Task 8: Portfolio Release Package

**Files:**
- Create: `docs/runbooks/local-demo.md`
- Create: `docs/adr/0002-postgres-pgvector-first.md`
- Create: `docs/adr/0003-bullmq-before-event-bus.md`

- [ ] **Step 1: Add local demo runbook**

Include Docker Compose, env vars, Prisma, dev server, worker and sample ingestion.

- [ ] **Step 2: Add ADRs**

Document why Postgres/pgvector is first and why BullMQ precedes Kafka/NATS.

- [ ] **Step 3: Capture screenshots**

Use Chrome to capture dashboard, metrics, watchlists and consultant views after data exists.

- [ ] **Step 4: Final verification**

Run lint/build, open app in Chrome, check docs for placeholders, and update README screenshots section.
