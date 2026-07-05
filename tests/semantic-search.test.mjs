import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

function runTs(code) {
  const result = spawnSync(process.execPath, ["node_modules/tsx/dist/cli.mjs", "--eval", code], {
    encoding: "utf8",
    env: { ...process.env, EMBEDDINGS_PROVIDER: "local" },
  });

  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || result.error?.message || "tsx execution failed");
  }

  return JSON.parse(result.stdout.trim());
}

test("semantic search genera embeddings deterministicos y local provider", () => {
  const result = runTs(`
    import { generateEmbedding } from "./lib/ai/embeddings";
    
    async function test() {
      const e1 = await generateEmbedding("cambios fiscales");
      const e2 = await generateEmbedding("cambios fiscales");
      const e3 = await generateEmbedding("reforma judicial");
      
      console.log(JSON.stringify({
        e1: e1.embedding.length,
        e2: e2.embedding.length,
        model: e1.model,
        identical: JSON.stringify(e1.embedding) === JSON.stringify(e2.embedding),
        different: JSON.stringify(e1.embedding) !== JSON.stringify(e3.embedding)
      }));
    }
    test();
  `);

  assert.equal(result.e1, 1536);
  assert.equal(result.e2, 1536);
  assert.equal(result.model, "local-hash-embedding");
  assert.equal(result.identical, true);
  assert.equal(result.different, true);
});
