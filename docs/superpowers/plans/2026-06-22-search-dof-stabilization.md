# Search and DOF Stabilization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make search degrade safely under slow dependencies, display truthful UI states, and prevent DOF page chrome from entering the legal corpus.

**Architecture:** Add a small environment configuration module and reusable timeout outcome helper, then adapt the legal-radar pipeline to return partial structured responses instead of throwing away completed work. Keep HTML extraction pure and testable in a dedicated DOF parser before wiring it into Prisma ingestion.

**Tech Stack:** Next.js 16, TypeScript, Node test runner, tsx, Cheerio, Prisma/PostgreSQL.

---

## File map

- Create `lib/config/timeouts.ts`: validate environment timeout values and production safeguards.
- Create `lib/async/withTimeout.ts`: represent completed, timed-out and failed operations without losing partial state.
- Create `lib/search/searchResponse.ts`: shared search response status and message derivation.
- Modify `lib/search/officialFederatedSearch.ts`: use configurable per-source timeout and expose source status/timing.
- Modify `app/api/legal/radar/route.ts`: remove the fixed five-second race and return partial metadata/timings.
- Modify `app/api/search/advanced/route.ts`: apply the search timeout contract and preserve completed candidates.
- Modify `app/search/page.tsx`: distinguish empty, partial, timeout and technical failure states.
- Create `lib/ingest/dofParser.ts`: extract and score legal content from a DOF note.
- Modify `lib/ingest/dofWeb.ts`: persist valid parsed notes and classify rejected notes as noise.
- Modify `.env.example`: document timeout settings.
- Create `tests/timeouts.test.mjs`, `tests/search-status.test.mjs`, `tests/dof-parser.test.mjs`: regression coverage.

### Task 1: Timeout configuration

**Files:**
- Create: `lib/config/timeouts.ts`
- Modify: `.env.example`
- Test: `tests/timeouts.test.mjs`

- [ ] **Step 1: Write failing tests**

Test `getTimeoutMs(name, fallback)` for an unset value, a valid integer, invalid/negative input, development `0`, and production `0` falling back to a safe positive value.

- [ ] **Step 2: Verify RED**

Run: `node --test tests/timeouts.test.mjs`  
Expected: FAIL because `lib/config/timeouts.ts` does not exist.

- [ ] **Step 3: Implement the minimal configuration API**

Export `getTimeoutMs`, `TIMEOUT_DEFAULTS`, and `getTimeoutConfig`. Parse only finite non-negative integers; permit `0` only when `NODE_ENV !== "production"`.

- [ ] **Step 4: Verify GREEN**

Run: `node --test tests/timeouts.test.mjs`  
Expected: all timeout tests pass.

### Task 2: Structured timeout outcomes

**Files:**
- Create: `lib/async/withTimeout.ts`
- Test: `tests/timeouts.test.mjs`

- [ ] **Step 1: Add failing outcome tests**

Cover a resolved promise, a promise exceeding its limit, a rejected promise, and timeout `0`.

- [ ] **Step 2: Verify RED**

Run: `node --test tests/timeouts.test.mjs`  
Expected: FAIL because `withTimeoutOutcome` is not exported.

- [ ] **Step 3: Implement the helper**

Return the discriminated union `{ status: "completed", value, durationMs }`, `{ status: "timed_out", durationMs }`, or `{ status: "failed", error, durationMs }`. Always clear timers and avoid unhandled rejections.

- [ ] **Step 4: Verify GREEN**

Run: `node --test tests/timeouts.test.mjs`  
Expected: all timeout tests pass.

### Task 3: Search status contract

**Files:**
- Create: `lib/search/searchResponse.ts`
- Modify: `lib/search/officialFederatedSearch.ts`
- Modify: `app/api/legal/radar/route.ts`
- Modify: `app/api/search/advanced/route.ts`
- Test: `tests/search-status.test.mjs`

- [ ] **Step 1: Write failing contract tests**

Assert that mixed completed/timed-out sources produce `partial: true`, timeout-only searches produce `timedOut: true` without claiming “sin resultados”, and successful empty searches produce the genuine empty state.

- [ ] **Step 2: Verify RED**

Run: `node --test tests/search-status.test.mjs`  
Expected: FAIL because the response contract is absent and the radar route still contains `timeout(5000, ...)`.

- [ ] **Step 3: Implement response derivation and source outcomes**

Add `deriveSearchState` and make official-source groups carry `status`, `durationMs`, and optional `warning`. Default source timeout comes from `EXTERNAL_SOURCE_TIMEOUT_MS` rather than `1000`.

- [ ] **Step 4: Adapt API routes**

Remove the total five-second `Promise.race`. Apply configured limits at dependency boundaries, retain results already obtained, and return `partial`, `timedOut`, `warnings`, `sources`, and `timings` with HTTP 200 for usable partial responses.

- [ ] **Step 5: Verify GREEN**

Run: `node --test tests/search-status.test.mjs tests/legal-radar.test.mjs tests/search-advanced.test.mjs`  
Expected: all selected tests pass.

### Task 4: Truthful search UI

**Files:**
- Modify: `app/search/page.tsx`
- Test: `tests/search-status.test.mjs`

- [ ] **Step 1: Add failing UI source assertions**

Require separate copy for partial results, timeout without results, real empty results and technical errors. Require the UI to preserve `data.results` for partial responses.

- [ ] **Step 2: Verify RED**

Run: `node --test tests/search-status.test.mjs`  
Expected: FAIL because the current catch path clears results and has no partial/timeout state.

- [ ] **Step 3: Add typed UI state**

Track response metadata independently of `error`; show partial results with an amber notice, timeout without results with retry guidance, and empty copy only for a completed search.

- [ ] **Step 4: Verify GREEN**

Run: `node --test tests/search-status.test.mjs`  
Expected: all status and UI assertions pass.

### Task 5: Pure DOF extraction and quality scoring

**Files:**
- Create: `lib/ingest/dofParser.ts`
- Test: `tests/dof-parser.test.mjs`

- [ ] **Step 1: Write failing parser tests**

Use inline HTML fixtures containing navigation, login, scripts, styles, encoded entities and a legal note. Assert the output contains the decree text, decoded accents and title while excluding chrome. Add a noise-only fixture and assert `quality.status === "noise"` with reasons.

- [ ] **Step 2: Verify RED**

Run: `node --test tests/dof-parser.test.mjs`  
Expected: FAIL because `parseDofNote` does not exist.

- [ ] **Step 3: Implement the parser**

Use Cheerio to remove non-content nodes, try known content selectors in priority order, normalize text, extract metadata and compute a deterministic score from text length, legal markers and chrome ratio.

- [ ] **Step 4: Verify GREEN**

Run: `node --test tests/dof-parser.test.mjs`  
Expected: all parser tests pass.

### Task 6: Wire quality into DOF ingestion

**Files:**
- Modify: `lib/ingest/dofWeb.ts`
- Test: `tests/dof-parser.test.mjs`

- [ ] **Step 1: Add a failing integration-source assertion**

Require `dofWeb.ts` to call `parseDofNote`, avoid `stripHtml(noteHtml)` on the whole page, and persist quality metadata plus a `ruido` classification for rejected content.

- [ ] **Step 2: Verify RED**

Run: `node --test tests/dof-parser.test.mjs`  
Expected: FAIL against the current whole-page extraction.

- [ ] **Step 3: Replace whole-page extraction**

Use parser output for title/summary. Valid notes keep classifier output; noise records retain URL and diagnostic metadata but use category `ruido` and remain excluded by normal dashboard/search filters.

- [ ] **Step 4: Verify GREEN**

Run: `node --test tests/dof-parser.test.mjs`  
Expected: all DOF tests pass.

### Task 7: Phase verification

**Files:**
- Modify: `docs/superpowers/plans/2026-06-22-search-dof-stabilization.md`

- [ ] **Step 1: Run focused tests**

Run: `node --test tests/timeouts.test.mjs tests/search-status.test.mjs tests/dof-parser.test.mjs`  
Expected: zero failures.

- [ ] **Step 2: Run complete regression suite**

Run: `npm test`  
Expected: zero failures.

- [ ] **Step 3: Run static verification**

Run: `npm run typecheck` and `npm run lint`  
Expected: TypeScript exits 0 and ESLint reports no errors.

- [ ] **Step 4: Run production build**

Run: `npm run build`  
Expected: Prisma generation and Next.js production build exit 0.

- [ ] **Step 5: Record evidence**

Check completed boxes in this plan and record command results in the delivery report without committing unrelated user changes.
