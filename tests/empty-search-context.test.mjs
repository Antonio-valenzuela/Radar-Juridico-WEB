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

test("empty search assistant en chat-bubble usa el thesaurus y retorna acciones con sinónimos", () => {
  const result = runTs(`
    import { POST } from "./app/api/ai/chat-bubble/route";
    import { NextRequest } from "next/server";
    import { prisma } from "./lib/prisma";

    (async () => {
      // Limpiar db locks
      await prisma.aiProviderHealth.deleteMany().catch(() => {});
      await prisma.aiUsageEvent.deleteMany().catch(() => {});

      const req = new NextRequest("http://localhost/api/ai/chat-bubble", {
        method: "POST",
        body: JSON.stringify({
          message: "derecho de familia",
          currentPath: "/search",
          mode: "empty_search_assistant",
          query: "derecho de familia",
          resultCount: 0
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

  assert.equal(typeof result.answer, "string");
  assert.equal(result.mode, "empty_search_assistant");
  assert.equal(Array.isArray(result.actions), true);

  // Debería tener acciones con tipo search y query de alimentos/patria potestad
  const searchActions = result.actions.filter(a => a.type === "search");
  assert.ok(searchActions.length > 0);
  assert.match(searchActions[0].label, /Buscar/);
  assert.ok(searchActions[0].payload.query);

  // Debería tener las acciones obligatorias "Quitar filtros" y "Agregar link jurídico"
  const clearFiltersAction = result.actions.find(a => a.type === "clear_filters");
  const addSourceAction = result.actions.find(a => a.type === "add_source_url");

  assert.ok(clearFiltersAction);
  assert.ok(addSourceAction);
});
