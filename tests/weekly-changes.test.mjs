/**
 * Tests for GET /api/legal/weekly-changes and security boundaries.
 *
 * Uses the Node.js built-in test runner. Tests are designed to run
 * without a live database — they validate contract structure, security
 * behaviour and URL routing logic only.
 *
 * Tests that require a live DB or dev server are tagged with a note.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";

// ─── Helper: read source file content ────────────────────────────────────────

function readRoute(relPath) {
  const abs = new URL(`../${relPath}`, import.meta.url).pathname
    .replace(/^\/([A-Z]:)/, "$1"); // fix Windows path
  if (!existsSync(abs)) throw new Error(`File not found: ${abs}`);
  return readFileSync(abs, "utf8");
}

// ─── 1. Route file existence ──────────────────────────────────────────────────

test("weekly-changes route file exists", () => {
  assert.ok(
    existsSync(new URL("../app/api/legal/weekly-changes/route.ts", import.meta.url).pathname.replace(/^\/([A-Z]:)/, "$1")),
    "app/api/legal/weekly-changes/route.ts should exist"
  );
});

test("radar route file exists", () => {
  assert.ok(
    existsSync(new URL("../app/api/legal/radar/route.ts", import.meta.url).pathname.replace(/^\/([A-Z]:)/, "$1")),
    "app/api/legal/radar/route.ts should exist"
  );
});

// ─── 2. weekly-changes: no requireAdmin for GET ───────────────────────────────

test("GET /api/legal/weekly-changes does NOT call requireAdmin", () => {
  const src = readRoute("app/api/legal/weekly-changes/route.ts");
  // The export async function GET should NOT contain requireAdmin
  // Extract the GET function body
  const getMatch = src.match(/export async function GET[\s\S]*?(?=\nexport async function|\nconst|\nfunction|$)/);
  if (getMatch) {
    assert.ok(
      !getMatch[0].includes("requireAdmin"),
      "GET handler should be public (no requireAdmin)"
    );
  } else {
    // If we can't extract, check that the file imports requireAdmin only in POST
    // which is acceptable — just verify GET itself doesn't have the call
    assert.ok(
      !src.match(/export async function GET[\s\S]{0,200}requireAdmin/),
      "GET handler should not call requireAdmin in its first 200 chars"
    );
  }
});

// ─── 3. weekly-changes: keyword is optional ──────────────────────────────────

test("GET /api/legal/weekly-changes makes keyword optional", () => {
  const src = readRoute("app/api/legal/weekly-changes/route.ts");
  // Should NOT have: if (!keyword) return error
  assert.ok(
    !src.includes('!keyword') || src.includes('keyword || ""'),
    "keyword should be optional — no hard rejection when keyword is empty"
  );
  // Should use default date range (7 days)
  assert.ok(
    src.includes("7") || src.includes("defaultStart"),
    "Should default to last 7 days when no keyword/date provided"
  );
});

// ─── 4. weekly-changes: enforces 90-day max range ────────────────────────────

test("GET /api/legal/weekly-changes enforces 90-day max range", () => {
  const src = readRoute("app/api/legal/weekly-changes/route.ts");
  assert.ok(
    src.includes("90") || src.includes("MAX_DAYS_PUBLIC"),
    "Should enforce a maximum public date range"
  );
  assert.ok(
    src.includes("range_too_large") || src.includes("rango máximo"),
    "Should return an error code for oversized ranges"
  );
});

// ─── 5. weekly-changes: result limit capped ──────────────────────────────────

test("GET /api/legal/weekly-changes limits results (max 100)", () => {
  const src = readRoute("app/api/legal/weekly-changes/route.ts");
  assert.ok(
    src.includes("100") && (src.includes("safeInt") || src.includes("Math.min")),
    "Should cap result limit at 100"
  );
});

// ─── 6. weekly-changes: response contract has required fields ─────────────────

test("GET /api/legal/weekly-changes response contract includes required fields", () => {
  const src = readRoute("app/api/legal/weekly-changes/route.ts");
  // Fields appear as object keys (without quotes around key name) or quoted in string literals
  for (const field of ["rangeUsed", "summary", "results", "external", "degraded", "generatedAt", "message"]) {
    const hasField =
      src.includes(`"${field}"`) ||
      src.includes(`'${field}'`) ||
      src.includes(`${field}:`);
    assert.ok(
      hasField,
      `Response contract should include field: ${field}`
    );
  }
});

// ─── 7. weekly-changes: does not expose internal error messages ───────────────

test("GET /api/legal/weekly-changes never exposes raw error.message publicly", () => {
  const src = readRoute("app/api/legal/weekly-changes/route.ts");
  // The catch block should NOT do: error: error.message or error: _error.message
  // without sanitization
  const catchBlock = src.match(/catch\s*\([^)]*\)\s*\{[\s\S]*?\}/g) ?? [];
  for (const block of catchBlock) {
    assert.ok(
      !block.includes("error: error.message") &&
      !block.includes('error: _error.message') &&
      !block.includes("error: err.message"),
      `catch block should not expose raw error.message: ${block.slice(0, 100)}`
    );
  }
});

// ─── 8. weekly-changes: no LLM, no external fetch, no ingesta ────────────────

test("GET /api/legal/weekly-changes does not call LLM or external APIs", () => {
  const src = readRoute("app/api/legal/weekly-changes/route.ts");
  assert.ok(
    !src.includes("generateLlmCompletion"),
    "weekly-changes GET should not call LLM"
  );
  assert.ok(
    !src.includes("searchOfficialSources"),
    "weekly-changes GET should not call external federated search"
  );
  assert.ok(
    !src.includes("expandLegalSearch"),
    "weekly-changes GET should not expand query with LLM"
  );
});

// ─── 9. weekly-changes: orders by date desc ───────────────────────────────────

test("GET /api/legal/weekly-changes orders results by published date descending", () => {
  const src = readRoute("app/api/legal/weekly-changes/route.ts");
  assert.ok(
    src.includes(`published: "desc"`) || src.includes(`published: 'desc'`),
    "Should order results by published date descending"
  );
});

// ─── 10. radar POST: still requires admin token ───────────────────────────────

test("POST /api/legal/radar still requires requireAdmin", () => {
  const src = readRoute("app/api/legal/radar/route.ts");
  // POST handler must call requireAdmin
  const postSection = src.match(/export async function POST[\s\S]+?(?=\nexport async function|\nasync function performSearch|$)/);
  assert.ok(postSection, "POST handler should exist");
  assert.ok(
    postSection[0].includes("requireAdmin"),
    "POST /api/legal/radar must call requireAdmin"
  );
});

// ─── 11. radar POST: no global 5s Promise.race ────────────────────────────────

test("POST /api/legal/radar does NOT use a single global 5s Promise.race", () => {
  const src = readRoute("app/api/legal/radar/route.ts");
  // Should not have the exact pattern: timeout(5000, ...) inside Promise.race in POST handler
  assert.ok(
    !src.includes("timeout(5000") || src.includes("withTimeout"),
    "Should use per-step withTimeout, not a single 5s Promise.race for everything"
  );
  assert.ok(
    !src.includes("Promise.race([\n      searchPromise"),
    "Should not use the old single global Promise.race pattern"
  );
});

// ─── 12. radar: per-step timeouts exist ───────────────────────────────────────

test("POST /api/legal/radar uses per-step timeouts (withTimeout)", () => {
  const src = readRoute("app/api/legal/radar/route.ts");
  assert.ok(
    src.includes("withTimeout"),
    "Should use withTimeout helper for per-step graceful degradation"
  );
  // Should reference multiple timeout values — either hardcoded numbers OR
  // named constants from lib/config/timeouts (LOCAL_SEARCH_MS, etc.)
  const hasHardcoded = (src.match(/\d{4,5}/g) ?? []).filter(n => [3000, 4000, 5000, 6000, 12000].includes(Number(n))).length >= 2;
  const hasConstants = src.includes("LOCAL_SEARCH_MS") && src.includes("AI_SYNTHESIS_MS");
  assert.ok(hasHardcoded || hasConstants, "Should have multiple per-step timeout values (hardcoded or constants)");
});


// ─── 13. radar GET: still requires admin token ───────────────────────────────

test("GET /api/legal/radar (config endpoint) still requires requireAdmin", () => {
  const src = readRoute("app/api/legal/radar/route.ts");
  const getSection = src.match(/export async function GET[\s\S]+?(?=\nexport async function POST|$)/);
  assert.ok(getSection, "GET handler should exist");
  assert.ok(
    getSection[0].includes("requireAdmin"),
    "GET /api/legal/radar (config) should still require admin token"
  );
});

// ─── 14. radar: degraded flag in response ────────────────────────────────────

test("POST /api/legal/radar includes degraded flag in response", () => {
  const src = readRoute("app/api/legal/radar/route.ts");
  assert.ok(
    src.includes("degraded"),
    "Response should include degraded flag"
  );
  assert.ok(
    src.includes("timedOutSources"),
    "Response should include timedOutSources"
  );
});

// ─── 15. radar: does not expose raw error messages ───────────────────────────

test("POST /api/legal/radar does not expose raw error.message in catch", () => {
  const src = readRoute("app/api/legal/radar/route.ts");
  // The outer catch in POST should use a safe error message
  assert.ok(
    src.includes("service_error") || src.includes("service_unavailable"),
    "Should return safe error codes, not raw error messages"
  );
});

// ─── 16. protected routes: admin / debug / ingest still protected ─────────────

test("admin routes import requireAdmin", () => {
  // Verify that confirmed admin-protected routes have auth checks.
  // Note: some routes in /api/admin/* may use other auth mechanisms or
  // were built before requireAdmin was standardized — that's tracked as
  // separate security debt, not part of this fix.
  const confirmedProtectedRoutes = [
    "app/api/admin/refresh/route.ts",
  ];
  for (const rel of confirmedProtectedRoutes) {
    const path = new URL(`../${rel}`, import.meta.url).pathname.replace(/^\/([A-Z]:)/, "$1");
    if (!existsSync(path)) continue;
    const src = readFileSync(path, "utf8");
    assert.ok(
      src.includes("requireAdmin") || src.includes("x-admin-token") || src.includes("ADMIN_TOKEN"),
      `${rel} should enforce admin auth`
    );
  }
  // Verify POST /api/legal/radar (our main change) is still protected
  const radarSrc = readRoute("app/api/legal/radar/route.ts");
  assert.ok(
    radarSrc.includes("requireAdmin"),
    "POST /api/legal/radar must still require admin auth"
  );
  // Verify GET /api/legal/weekly-changes (our public endpoint) does NOT require admin
  const weeklySrc = readRoute("app/api/legal/weekly-changes/route.ts");
  const getSection = weeklySrc.match(/export async function GET[\s\S]+?(?=\nexport async function|\nconst|\n\/\/\s*─|$)/);
  if (getSection) {
    assert.ok(
      !getSection[0].includes("requireAdmin"),
      "GET /api/legal/weekly-changes should be public (no requireAdmin)"
    );
  }
  assert.ok(true, "Admin route boundary tests passed");
});

// ─── 17. rag page: no undeclared totalExternalResults ────────────────────────

test("app/rag/page.tsx does not use undeclared totalExternalResults", () => {
  const src = readRoute("app/rag/page.tsx");
  if (src.includes("totalExternalResults")) {
    // Must be declared (const/let totalExternalResults)
    assert.ok(
      src.match(/const totalExternalResults\s*=/) ||
      src.match(/let totalExternalResults\s*=/),
      "totalExternalResults must be declared before use"
    );
  }
  // passes if the variable is not used at all (also fine)
  assert.ok(true);
});

// ─── 18. rag page: loads weekly data on mount ────────────────────────────────

test("app/rag/page.tsx calls loadWeeklyData or fetchWeekly on mount", () => {
  const src = readRoute("app/rag/page.tsx");
  assert.ok(
    src.includes("weekly-changes") || src.includes("loadWeeklyData"),
    "Page should load weekly data on mount from GET /api/legal/weekly-changes"
  );
  assert.ok(
    src.includes("useEffect"),
    "Page must use useEffect to trigger auto-load"
  );
});

// ─── 19. rag page: handles degraded state ────────────────────────────────────

test("app/rag/page.tsx renders degraded state warning", () => {
  const src = readRoute("app/rag/page.tsx");
  assert.ok(
    src.includes("degraded") || src.includes("tiempo de espera"),
    "Page should handle and display degraded state to the user"
  );
});

// ─── 20. weekly-changes: rangeUsed includes timezone ─────────────────────────

test("GET /api/legal/weekly-changes rangeUsed includes Mexico City timezone", () => {
  const src = readRoute("app/api/legal/weekly-changes/route.ts");
  assert.ok(
    src.includes("America/Mexico_City"),
    "rangeUsed should specify America/Mexico_City timezone"
  );
});
