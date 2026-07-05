import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

function runTs(code) {
  const result = spawnSync(process.execPath, ["node_modules/tsx/dist/cli.mjs", "--eval", code], {
    encoding: "utf8",
    env: { ...process.env, LLM_PROVIDER: "local" },
  });

  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || result.error?.message || "tsx execution failed");
  }

  return result.stdout.trim();
}

test("logger logInfo corre sin error", () => {
  const out = runTs(`
    import { logInfo } from "./lib/observability/logger";
    logInfo("test", {a:1});
    console.log("ok");
  `);
  assert.ok(out.includes("ok"));
});
