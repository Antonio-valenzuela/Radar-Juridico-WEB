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

test("advanced search endpoint retorna expandedQuery y debug en test env", () => {
  const result = runTs(`
    import { POST } from "./app/api/search/advanced/route";
    import { NextRequest } from "next/server";

    (async () => {
      const req = new NextRequest("http://localhost/api/search/advanced", {
        method: "POST",
        body: JSON.stringify({
          query: "derecho de familia",
          limit: 5
        })
      });

      const response = await POST(req);
      const data = await response.json();
      console.log(JSON.stringify(data));
    })().catch((err) => {
      console.error(err);
      process.exit(1);
    });
  `);

  assert.equal(result.ok, true);
  assert.equal(result.expandedQuery.originalQuery, "derecho de familia");
  assert.equal(Array.isArray(result.expandedQuery.expandedTerms), true);
  assert.match(result.expandedQuery.expandedTerms.join(","), /alimento/);
  assert.equal(result.expandedQuery.relatedMaterias.includes("Familiar"), true);
  assert.ok(result.debug);
  assert.equal(result.debug.originalQuery, "derecho de familia");
});
