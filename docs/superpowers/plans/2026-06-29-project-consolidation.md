# Project Consolidation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Consolidate the more advanced `C:\Users\yahir\juridico-radar` project with the useful missing pieces from `C:\Users\yahir\Desktop\juridico-radar`.

**Architecture:** Use `C:\Users\yahir\juridico-radar` as the canonical project. Copy only missing source, tests, and documentation from Desktop; merge shared files selectively so the richer official-source, worker, and schema work remains intact.

**Tech Stack:** Next.js 16, React 19, Prisma, PostgreSQL/pgvector, Redis, BullMQ, Node test runner, Docker Compose.

---

### Task 1: Preserve Useful Desktop-Only Files

**Files:**
- Copy: `lib/ingest/manualUrl.ts`
- Copy: `lib/ingest/dofParser.ts`
- Copy: `lib/async/withTimeout.ts`
- Copy: `lib/search/searchResponse.ts`
- Copy: `tests/manual-url.test.mjs`
- Copy: `tests/admin-boundaries.test.mjs`
- Copy: `tests/dof-parser.test.mjs`
- Copy: `tests/docker-runtime.test.mjs`
- Copy: `tests/search-status.test.mjs`
- Copy: `tests/user-flow-ux.test.mjs`
- Copy: `AUDITORIA_PROYECTO.md`
- Copy: `docs/AI_WORKFLOW.md`
- Copy: `docs/demo-juridico-radar.md`
- Copy: `docs/specs/2026-06-22-juridico-radar-platform-spec.md`
- Copy: `docs/superpowers/plans/2026-06-20-critical-security-repair.md`
- Copy: `docs/superpowers/plans/2026-06-20-ecc-codex-toolkit.md`
- Copy: `docs/superpowers/plans/2026-06-22-search-dof-stabilization.md`
- Copy: `docs/superpowers/specs/2026-06-20-ecc-codex-toolkit-design.md`
- Copy: `ai-dev-toolkit/`

- [ ] **Step 1: Copy missing files only**

Use `Copy-Item` for files/directories that do not exist in the canonical folder. Do not copy `.env`, `.next`, `node_modules`, `.tmp`, `.codegraph`, or generated TypeScript build info.

- [ ] **Step 2: Verify no generated files were copied**

Run: `Get-ChildItem -Recurse -Force .tmp,.codegraph,.next,node_modules -ErrorAction SilentlyContinue`
Expected: either no output for newly copied locations or only pre-existing ignored directories.

### Task 2: Merge Manual URL Ingestion

**Files:**
- Modify: `lib/security/urlValidation.ts`
- Modify: `lib/ingest/manualUrl.ts`
- Modify: `app/api/admin/ingest/manual-url/route.ts`

- [ ] **Step 1: Add synchronous public URL and redirect validators**

Add `validatePublicHttpUrl` and `validateRedirectTarget` exports while keeping Home's existing async `validateUrlSafety`, `safeFetch`, and official-source diagnostics.

- [ ] **Step 2: Adapt robust manual ingestion to Home schema**

Ensure created and updated `DocumentVersion` records include `versionNumber` compatibility, `originalText`, `rawText`, `sourceItemId`, and delete old chunks when reusing a version with changed content.

- [ ] **Step 3: Replace inline route logic**

Make `POST /api/admin/ingest/manual-url` call `ingestManualUrl`, retain `x-admin-token` protection, and include backward-compatible `indexed` and `versionId` aliases in the JSON response.

### Task 3: Verify Consolidated Project

**Files:**
- Test: `tests/manual-url.test.mjs`
- Test: `tests/admin-boundaries.test.mjs`
- Test: all existing `tests/*.test.mjs`

- [ ] **Step 1: Install dependencies**

Run: `npm install`
Expected: exit 0.

- [ ] **Step 2: Run targeted tests**

Run: `node --test tests/manual-url.test.mjs tests/admin-boundaries.test.mjs tests/dof-parser.test.mjs`
Expected: exit 0.

- [ ] **Step 3: Run full tests**

Run: `npm test`
Expected: exit 0.

- [ ] **Step 4: Run typecheck and build**

Run: `npm run typecheck`
Expected: exit 0.

Run: `npm run build`
Expected: exit 0.

- [ ] **Step 5: Restart Docker and smoke test**

Run: `docker compose down && FRONTEND_PORT=3003 docker compose up -d --build`
Expected: frontend on `http://localhost:3003`.

Run: `curl.exe -i --max-time 90 http://localhost:3003/admin/ingest/manual-url`
Expected: HTTP 200.
