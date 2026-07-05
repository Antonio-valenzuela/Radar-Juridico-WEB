import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

function runTs(code) {
  const result = spawnSync(process.execPath, ["node_modules/tsx/dist/cli.mjs", "--eval", code], {
    encoding: "utf8",
    env: { ...process.env, NODE_ENV: "test" },
  });
  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || result.error?.message || "tsx execution failed");
  }
  return JSON.parse(result.stdout.trim());
}

test("expandLegalQuery normaliza y expande terminos", () => {
  const result = runTs(`
    import { expandLegalQuery } from "./lib/search/expandLegalQuery";
    const res1 = expandLegalQuery("derecho familiar");
    const res2 = expandLegalQuery("derecho de familia");
    const res3 = expandLegalQuery("embargos");
    
    console.log(JSON.stringify({ res1, res2, res3 }));
  `);

  assert.equal(result.res1.canonicalTopic, "derecho familiar");
  assert.match(result.res1.expandedTerms.join(","), /alimento/);
  assert.match(result.res1.expandedTerms.join(","), /patria potestad/);

  assert.equal(result.res2.canonicalTopic, "derecho familiar");

  assert.equal(result.res3.canonicalTopic, "embargo");
});
