import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

function runTs(code, extraEnv = {}) {
  const result = spawnSync(
    process.execPath,
    ["node_modules/tsx/dist/cli.mjs", "--eval", code],
    {
      encoding: "utf8",
      env: { ...process.env, LLM_PROVIDER: "local", NODE_ENV: "test", ...extraEnv },
      timeout: 10_000,
    }
  );

  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || result.error?.message || "tsx execution failed");
  }

  try {
    return JSON.parse(result.stdout.trim().split("\n").pop() || "{}");
  } catch {
    throw new Error("Invalid JSON returned: " + result.stdout);
  }
}

// ── 1. Module exports all required constants ───────────────────────────────────
test("TIMEOUTS module exports all required constants with positive defaults", () => {
  const res = runTs(`
    import { TIMEOUTS } from "./lib/config/timeouts";
    console.log(JSON.stringify({
      keys: Object.keys(TIMEOUTS).sort(),
      allPositive: Object.values(TIMEOUTS).every(v => typeof v === "number" && v > 0),
    }));
  `);

  const EXPECTED_KEYS = [
    "AI_GLOBAL_MS",
    "AI_PROVIDER_MS",
    "AI_SYNTHESIS_MS",
    "EXTERNAL_SEARCH_MS",
    "INGEST_FETCH_MS",
    "INGEST_RUN_MS",
    "LLM_EXPANSION_MS",
    "LOCAL_SEARCH_MS",
    "LOCAL_VERSIONS_MS",
    "PER_SOURCE_MS",
    "WEEKLY_DIFFS_MS",
  ];

  assert.deepEqual(res.keys, EXPECTED_KEYS);
  assert.equal(res.allPositive, true);
});

// ── 2. Named exports match TIMEOUTS object values ─────────────────────────────
test("Named exports are consistent with TIMEOUTS summary object", () => {
  const res = runTs(`
    import {
      LOCAL_SEARCH_MS,
      PER_SOURCE_MS,
      EXTERNAL_SEARCH_MS,
      LOCAL_VERSIONS_MS,
      WEEKLY_DIFFS_MS,
      LLM_EXPANSION_MS,
      AI_SYNTHESIS_MS,
      AI_PROVIDER_MS,
      AI_GLOBAL_MS,
      INGEST_FETCH_MS,
      INGEST_RUN_MS,
      TIMEOUTS,
    } from "./lib/config/timeouts";

    const consistent =
      LOCAL_SEARCH_MS   === TIMEOUTS.LOCAL_SEARCH_MS   &&
      PER_SOURCE_MS     === TIMEOUTS.PER_SOURCE_MS      &&
      EXTERNAL_SEARCH_MS=== TIMEOUTS.EXTERNAL_SEARCH_MS &&
      LOCAL_VERSIONS_MS === TIMEOUTS.LOCAL_VERSIONS_MS  &&
      WEEKLY_DIFFS_MS   === TIMEOUTS.WEEKLY_DIFFS_MS    &&
      LLM_EXPANSION_MS  === TIMEOUTS.LLM_EXPANSION_MS   &&
      AI_SYNTHESIS_MS   === TIMEOUTS.AI_SYNTHESIS_MS    &&
      AI_PROVIDER_MS    === TIMEOUTS.AI_PROVIDER_MS     &&
      AI_GLOBAL_MS      === TIMEOUTS.AI_GLOBAL_MS       &&
      INGEST_FETCH_MS   === TIMEOUTS.INGEST_FETCH_MS    &&
      INGEST_RUN_MS     === TIMEOUTS.INGEST_RUN_MS;

    console.log(JSON.stringify({ consistent }));
  `);

  assert.equal(res.consistent, true);
});

// ── 3. Environment variables override defaults ─────────────────────────────────
test("Env variable TIMEOUT_LOCAL_SEARCH_MS overrides default", () => {
  const res = runTs(`
    import { LOCAL_SEARCH_MS } from "./lib/config/timeouts";
    console.log(JSON.stringify({ value: LOCAL_SEARCH_MS }));
  `, { TIMEOUT_LOCAL_SEARCH_MS: "1234" });

  assert.equal(res.value, 1234);
});

test("Env variable TIMEOUT_PER_SOURCE_MS overrides default", () => {
  const res = runTs(`
    import { PER_SOURCE_MS } from "./lib/config/timeouts";
    console.log(JSON.stringify({ value: PER_SOURCE_MS }));
  `, { TIMEOUT_PER_SOURCE_MS: "500" });

  assert.equal(res.value, 500);
});

test("Env variable TIMEOUT_AI_SYNTHESIS_MS overrides default", () => {
  const res = runTs(`
    import { AI_SYNTHESIS_MS } from "./lib/config/timeouts";
    console.log(JSON.stringify({ value: AI_SYNTHESIS_MS }));
  `, { TIMEOUT_AI_SYNTHESIS_MS: "9999" });

  assert.equal(res.value, 9999);
});

// ── 4. Zero is allowed in non-production ─────────────────────────────────────
test("Zero disables timeout in non-production NODE_ENV", () => {
  const res = runTs(`
    import { LOCAL_SEARCH_MS } from "./lib/config/timeouts";
    console.log(JSON.stringify({ value: LOCAL_SEARCH_MS }));
  `, { TIMEOUT_LOCAL_SEARCH_MS: "0", NODE_ENV: "development" });

  assert.equal(res.value, 0);
});

// ── 5. Invalid values fall back to default ────────────────────────────────────
test("Invalid (NaN) env value falls back to default 3000", () => {
  const res = runTs(`
    import { LOCAL_SEARCH_MS } from "./lib/config/timeouts";
    console.log(JSON.stringify({ value: LOCAL_SEARCH_MS }));
  `, { TIMEOUT_LOCAL_SEARCH_MS: "not_a_number" });

  assert.equal(res.value, 3000);
});

test("Negative env value falls back to default", () => {
  const res = runTs(`
    import { PER_SOURCE_MS } from "./lib/config/timeouts";
    console.log(JSON.stringify({ value: PER_SOURCE_MS }));
  `, { TIMEOUT_PER_SOURCE_MS: "-500" });

  assert.equal(res.value, 1500);
});

// ── 6. Default values are within sensible ranges ─────────────────────────────
test("LOCAL_SEARCH_MS default is between 1s and 10s", () => {
  const res = runTs(`
    import { LOCAL_SEARCH_MS } from "./lib/config/timeouts";
    console.log(JSON.stringify({ value: LOCAL_SEARCH_MS }));
  `);

  assert.ok(res.value >= 1000 && res.value <= 10_000,
    "LOCAL_SEARCH_MS=" + res.value + " is outside [1000, 10000]");
});

test("AI_GLOBAL_MS default is at least AI_SYNTHESIS_MS default", () => {
  const res = runTs(`
    import { AI_GLOBAL_MS, AI_SYNTHESIS_MS } from "./lib/config/timeouts";
    console.log(JSON.stringify({ global: AI_GLOBAL_MS, synthesis: AI_SYNTHESIS_MS }));
  `);

  assert.ok(res.global >= res.synthesis,
    "AI_GLOBAL_MS=" + res.global + " should be >= AI_SYNTHESIS_MS=" + res.synthesis);
});
