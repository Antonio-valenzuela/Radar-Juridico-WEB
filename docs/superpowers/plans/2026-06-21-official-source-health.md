# Official Source Health Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make official-source connection tests and manual ingestion adapter-aware, diagnosable, and compatible with existing source CRUD and admin authorization.

**Architecture:** A focused `SourceHealthService` resolves database records into immutable adapter profiles and performs SSRF-safe GET checks with controlled redirects. The existing admin API and UI consume one typed result contract, while manual ingestion resolves the same adapter identity before falling back to legacy crawl modes.

**Tech Stack:** Next.js 15 route handlers, TypeScript, Prisma/PostgreSQL, Node fetch/AbortController, Node test runner with tsx.

---

### Task 1: Adapter-aware health contract and failing tests

**Files:**
- Create: `tests/source-health.test.mjs`
- Create: `lib/sources/sourceHealth.ts`

- [ ] **Step 1: Write failing tests for target selection and semantic statuses**

Create tests that import the wished-for API and inject fetch responses:

```js
import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

function runTs(code) {
  const result = spawnSync(process.execPath, ["node_modules/tsx/dist/cli.mjs", "--eval", code], {
    cwd: process.cwd(), encoding: "utf8", timeout: 30000,
    env: { ...process.env, NODE_ENV: "test" }
  });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout);
  return JSON.parse(result.stdout.trim().split("\n").pop());
}

test("SIDOF uses apiStatus", () => {
  const value = runTs(`
    import { checkSourceHealth } from "./lib/sources/sourceHealth";
    let requested = "";
    const result = await checkSourceHealth(
      { adapter: "SIDOF", baseUrl: "https://sidof.segob.gob.mx/dof/sidof" },
      { fetch: async (url) => { requested = String(url); return new Response("ok", { status: 200 }); }, validate: async () => ({ safe: true }) }
    );
    console.log(JSON.stringify({ requested, status: result.status }));
  `);
  assert.equal(value.requested, "https://sidof.segob.gob.mx/apiStatus");
  assert.equal(value.status, "OK");
});
```

Add separate assertions for Diputados `/LeyesBiblio/index.htm`, SJF JavaScript body, SCJN 403, fetch `cause`, allowlisted HTTP→HTTPS rewrite, and blocked cross-host/insecure redirects.

- [ ] **Step 2: Run tests and verify RED**

Run: `node --test tests/source-health.test.mjs`

Expected: FAIL because `lib/sources/sourceHealth.ts` does not exist.

- [ ] **Step 3: Define the health types and adapter profiles**

Implement these stable public types:

```ts
export type SourceAdapter = "SIDOF" | "DOF" | "DIPUTADOS" | "SCJN_LEG" | "SJF" | "GENERIC_HTML";
export type SourceHealthStatus =
  | "OK" | "REDIRECT_BLOCKED" | "BLOCKED_BY_PROVIDER" | "NOT_FOUND"
  | "FETCH_ERROR" | "BROWSER_REQUIRED" | "WARNING_ACCESSIBLE_WITH_LIMITATIONS";

export type SourceHealthInput = {
  adapter?: string | null;
  slug?: string | null;
  type?: string | null;
  baseUrl: string;
  healthUrl?: string | null;
  healthPath?: string | null;
  requiresBrowser?: boolean;
};
```

Profiles must set SIDOF `/apiStatus`, Diputados `/LeyesBiblio/index.htm`, SCJN Legislación `/buscador/paginas/buscar.aspx`, SJF `/`, and DOF `/`.

- [ ] **Step 4: Implement GET health checks with controlled redirects**

Use 15 seconds, the required browser headers, manual redirects, at most three hops, and URL validation before every fetch. Rewrite a same-host HTTP redirect to HTTPS only when its host is in the fixed official allowlist. Never use HEAD or mutate `NODE_TLS_REJECT_UNAUTHORIZED`.

Serialize caught errors as:

```ts
const cause = error instanceof Error ? (error as Error & { cause?: Record<string, unknown> }).cause : undefined;
return {
  name: error instanceof Error ? error.name : "Error",
  message: error instanceof Error ? error.message : String(error),
  causeCode: typeof cause?.code === "string" ? cause.code : undefined,
  causeMessage: typeof cause?.message === "string" ? cause.message : undefined,
  causeHostname: typeof cause?.hostname === "string" ? cause.hostname : undefined,
};
```

- [ ] **Step 5: Run health tests and verify GREEN**

Run: `node --test tests/source-health.test.mjs`

Expected: all adapter health tests pass without live network access.

### Task 2: Database configuration, seed, and CRUD compatibility

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/20260621060000_official_source_health/migration.sql`
- Modify: `prisma/seed_sources.ts`
- Modify: `app/api/admin/sources/route.ts`
- Modify: `app/api/admin/sources/[id]/route.ts`
- Modify: `tests/official-sources.test.mjs`

- [ ] **Step 1: Add failing structural tests for optional fields and canonical seed targets**

Assert that the schema contains `adapter`, `healthUrl`, and `requiresBrowser`; that the seed contains canonical slugs and correct health URLs; and that create/update routes accept but do not require the new fields.

- [ ] **Step 2: Run the focused tests and verify RED**

Run: `node --test tests/official-sources.test.mjs`

Expected: the new schema/seed assertions fail while existing admin-token and CRUD assertions remain unchanged.

- [ ] **Step 3: Add backward-compatible Prisma fields and SQL migration**

Add:

```prisma
adapter         String   @default("GENERIC_HTML")
healthUrl       String?
requiresBrowser Boolean  @default(false)
```

The migration uses matching defaults and no destructive column changes.

- [ ] **Step 4: Update the seed without duplicate legacy rows**

Seed `SIDOF`, `DIPUTADOS`, `SCJN_LEG`, `SCJN_SJF`, and `DOF_WEB`, with the approved base/health URLs and browser flags. Before create, find existing rows case-insensitively by canonical slug or legacy type; update that row in place.

- [ ] **Step 5: Extend CRUD payloads safely**

Create/update routes accept `adapter`, `healthUrl`, and `requiresBrowser`. Validate `baseUrl` and `healthUrl` independently with existing SSRF validation. Missing new fields preserve defaults/current values.

- [ ] **Step 6: Regenerate Prisma and verify tests**

Run: `npx prisma generate`

Run: `node --test tests/official-sources.test.mjs`

Expected: CRUD security and new configuration assertions pass.

### Task 3: Connect admin health endpoint to the service

**Files:**
- Modify: `app/api/admin/sources/[id]/test/route.ts`
- Modify: `lib/security/urlValidation.ts`
- Test: `tests/source-health.test.mjs`

- [ ] **Step 1: Add a failing route contract test**

Assert the route imports `checkSourceHealth`, retains `requireAdmin`, and updates failure timestamps only for hard failure statuses. Warning/browser/provider-blocked statuses prove liveness and must not be stored as generic network failures.

- [ ] **Step 2: Run the focused test and verify RED**

Run: `node --test tests/source-health.test.mjs`

Expected: route still imports `testOfficialSourceConnection` and fails the assertion.

- [ ] **Step 3: Replace the generic connection call**

Call `checkSourceHealth(source)`, return its typed contract unchanged, and classify `OK`, `BLOCKED_BY_PROVIDER`, `BROWSER_REQUIRED`, and `WARNING_ACCESSIBLE_WITH_LIMITATIONS` as reachable outcomes for timestamps.

- [ ] **Step 4: Remove only the obsolete generic health function**

Keep `validateUrlSafety` and `safeFetch` for legacy consumers. Delete `testOfficialSourceConnection` after its only caller is migrated; do not weaken admin auth or CRUD URL validation.

- [ ] **Step 5: Verify GREEN**

Run: `node --test tests/source-health.test.mjs tests/official-sources.test.mjs`

Expected: health contract and existing source endpoint tests pass.

### Task 4: Adapter-aware manual ingestion

**Files:**
- Modify: `lib/ingest/runIngest.ts`
- Modify: `lib/sources/sidof.ts`
- Modify: `lib/sources/diputados.ts`
- Modify: `lib/sources/types.ts`
- Modify: `lib/sources/index.ts`
- Modify: `app/api/admin/sources/[id]/ingest/route.ts`
- Create: `tests/source-ingest-dispatch.test.mjs`

- [ ] **Step 1: Write failing dispatch and warning tests**

Use structural/module-level tests to prove SIDOF resolves its API adapter, Diputados resolves LeyesBiblio, SJF with `requiresBrowser` returns a controlled zero-item warning, SCJN provider limitation returns a warning category, and DOF Web is not selected as primary while active SIDOF exists.

- [ ] **Step 2: Run tests and verify RED**

Run: `node --test tests/source-ingest-dispatch.test.mjs`

Expected: current `crawlMode`-first dispatch and obsolete SIDOF endpoints fail.

- [ ] **Step 3: Resolve adapters before generic crawl modes**

Add a case-insensitive adapter resolver shared with the health service. In `runSourceIngest`, use dedicated modules for SIDOF and Diputados before RSS/manual fallbacks. Keep existing behavior for custom registered sources.

- [ ] **Step 4: Correct SIDOF endpoints**

Use base `https://sidof.segob.gob.mx` and these paths only:

```text
/diarios/porFecha/{dd-mm-yyyy}
/notas/{dd-mm-yyyy}
/notas/nota/{codigo}
/documentos/pdf/{id}
```

Remove fallback construction involving `/dof/sidof`.

- [ ] **Step 5: Preserve Diputados parser with decoding fallback**

Fetch `/LeyesBiblio/index.htm` and decode response bytes in UTF-8, then Latin-1/Windows-1252 when replacement-character or parsing heuristics indicate a bad decode. Continue extracting PDF and HTML links through the existing parser.

- [ ] **Step 6: Return controlled SCJN limitations**

For SJF/SCJN Legislación records marked `requiresBrowser`, do not run generic HTML ingestion. Return `ok: true`, zero counts, and a warning string/category that the route presents as a limitation rather than “Fallo”. No Playwright dependency is added.

- [ ] **Step 7: Verify dispatch tests**

Run: `node --test tests/source-ingest-dispatch.test.mjs`

Expected: all dispatch, endpoint, and warning cases pass.

### Task 5: Typed frontend result presentation

**Files:**
- Modify: `app/admin/sources/page.tsx`
- Create: `tests/source-health-ui.test.mjs`

- [ ] **Step 1: Add failing UI contract tests**

Assert the page handles every semantic status and contains the required Spanish labels, uses `data.accessible`, and distinguishes warning from failure presentation.

- [ ] **Step 2: Run test and verify RED**

Run: `node --test tests/source-health-ui.test.mjs`

Expected: missing status mappings fail.

- [ ] **Step 3: Type connection and ingestion state**

Replace `any` with `SourceHealthResult` and a minimal manual-ingestion result type. Add a pure status-to-label helper covering all seven statuses.

- [ ] **Step 4: Render clear labels and diagnostics**

Show `statusCode`, `finalUrl`, and `error.causeCode` when present. Render provider/browser/limitation states in amber, OK in green, and only hard failure states in red.

- [ ] **Step 5: Verify UI tests and lint the file**

Run: `node --test tests/source-health-ui.test.mjs`

Run: `npx eslint app/admin/sources/page.tsx`

Expected: tests pass and ESLint reports no errors.

### Task 6: Full verification and report

**Files:**
- Modify: `docs/AI_WORKFLOW.md` only if operational behavior needs project-specific documentation
- Create: `docs/OFFICIAL_SOURCES_REPAIR.md`

- [ ] **Step 1: Scan for obsolete behavior**

Run:

```powershell
rg -n "HEAD|sidof\.segob\.gob\.mx/dof/sidof|testOfficialSourceConnection|NODE_TLS_REJECT_UNAUTHORIZED" lib app prisma tests
```

Expected: no obsolete health probing or SIDOF seed path; unrelated legacy TLS behavior is documented if still required elsewhere.

- [ ] **Step 2: Run focused suites**

Run:

```powershell
node --test tests/source-health.test.mjs tests/source-ingest-dispatch.test.mjs tests/source-health-ui.test.mjs tests/official-sources.test.mjs
```

Expected: all focused tests pass.

- [ ] **Step 3: Run project gates**

Run:

```powershell
npm run typecheck
npm run lint
npm test
npm run build
```

Expected: all commands exit zero. Existing warnings are recorded separately and are not hidden by changing lint rules.

- [ ] **Step 4: Document outcomes and remaining risks**

Record modified files, adapter behavior, test results, network diagnostics, lack of Playwright installation, and any live-provider limitation. Do not include tokens, environment values, or credentials.

