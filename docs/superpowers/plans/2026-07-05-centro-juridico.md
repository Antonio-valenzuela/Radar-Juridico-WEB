# Centro Juridico Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a lawyer-facing legal hub with civil, mercantile, CNPCF, SCJN jurisprudence, boletines/SISE/CJF shortcuts, and machote templates.

**Architecture:** Keep the feature mostly static and typed in `lib/legalHub.ts`, then render it from a single client page at `app/legal-hub/page.tsx`. Reuse the existing search/admin routes by linking to `/search` and `/admin/sources` instead of building a second search system.

**Tech Stack:** Next.js App Router, React, TypeScript, Prisma seed data, Node test runner.

---

### Task 1: Legal Hub Data Contract

**Files:**
- Create: `tests/legal-hub.test.mjs`
- Create: `lib/legalHub.ts`

- [ ] **Step 1: Write the failing test**

Run: `node --test tests/legal-hub.test.mjs`
Expected: FAIL because `lib/legalHub.ts` and `app/legal-hub/page.tsx` do not exist.

- [ ] **Step 2: Add minimal data and UI**

Create `lib/legalHub.ts` with typed sections, shortcuts, and machotes. Create `app/legal-hub/page.tsx` to render tabs and cards. Add `/legal-hub` to the dashboard nav.

- [ ] **Step 3: Run test to verify it passes**

Run: `node --test tests/legal-hub.test.mjs`
Expected: PASS.

### Task 2: Official Source Catalog

**Files:**
- Modify: `tests/legal-hub.test.mjs`
- Modify: `prisma/seed_sources.ts`
- Modify: `lib/search/legalExpansion.ts`

- [ ] **Step 1: Add source seed entries and expansion domains**

Append search-only or browser-required sources to `prisma/seed_sources.ts`. Extend `ALLOWED_OFFICIAL_DOMAINS` and fallback source inference so legal search can use those sources safely.

- [ ] **Step 2: Run test to verify it passes**

Run: `node --test tests/legal-hub.test.mjs`
Expected: PASS.

### Task 3: Search Vocabulary

**Files:**
- Modify: `tests/legal-thesaurus.test.mjs`
- Modify: `lib/search/legalThesaurus.ts`
- Modify: `app/search/page.tsx`

- [ ] **Step 1: Add vocabulary and UI filter options**

Add a `cnpcf` thesaurus entry and add `Familiar`, `Amparo` and `CNPCF` options to the search page.

- [ ] **Step 2: Run tests and typecheck**

Run: `npm test -- tests/legal-hub.test.mjs tests/legal-thesaurus.test.mjs` and `npm run typecheck`.
Expected: PASS.

### Task 4: Operational Legal Modules

**Files:**
- Create: `tests/legal-operations.test.mjs`
- Create: `lib/legalOperations.ts`
- Create: `app/legal-hub/leyes-vigentes/page.tsx`
- Create: `app/legal-hub/jurisprudencia/page.tsx`
- Create: `app/legal-hub/expedientes/page.tsx`
- Create: `app/legal-hub/machotes/page.tsx`
- Modify: `app/legal-hub/page.tsx`
- Modify: `lib/ai/router.ts`

- [ ] **Step 1: Write the failing test**

Run: `node --test tests/legal-operations.test.mjs`
Expected: FAIL because `lib/legalOperations.ts` and the operational pages do not exist.

- [ ] **Step 2: Add operational data contract**

Create a typed catalog for current laws, jurisprudence filters, case-tracking fields, case-alert rules and guided legal templates. Include official-source links and clear notes for sources that require browser/session access.

- [ ] **Step 3: Add operational pages**

Create pages for Leyes Vigentes, Jurisprudencia, Expedientes and Machotes. Keep restricted judicial portals as assisted-search/open-official-source flows; do not bypass login/captcha.

- [ ] **Step 4: Replace technical fallback copy**

Change the local consultant fallback from provider-focused wording to lawyer-facing wording.

- [ ] **Step 5: Verify**

Run: `node --test tests/legal-operations.test.mjs tests/legal-hub.test.mjs tests/legal-thesaurus.test.mjs`, `npx tsc --noEmit --incremental false`, and `npm test`.
Expected: PASS.
