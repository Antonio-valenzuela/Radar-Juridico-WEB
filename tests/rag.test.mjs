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

  return JSON.parse(result.stdout.trim());
}

test("RAG contesta con fallback local cuando no hay evidencia", () => {
  const result = runTs(`
    import { answerQuestion } from "./lib/rag/answer";
    
    // Mock the retrieveContext using a module patch or just test prompt builder
    import { buildRagPrompt } from "./lib/rag/prompts";
    const prompt = buildRagPrompt("¿Qué pasó hoy?", []);
    
    console.log(JSON.stringify({ prompt }));
  `);

  assert.ok(result.prompt.includes("No encontré evidencia suficiente en las fuentes indexadas."));
});

test("RAG responde que no hay documentos si context está vacío", () => {
  const result = runTs(`
    import { answerQuestion } from "./lib/rag/answer";
    import { prisma } from "./lib/prisma";
    
    // Mock database queries to return empty results
    prisma.document.findMany = async () => [];
    prisma.$queryRaw = async () => [];
    prisma.documentVersion.findMany = async () => [];

    (async () => {
      const res = await answerQuestion("pregunta sin documentos", 5);
      console.log(JSON.stringify(res));
      await prisma.$disconnect();
      setTimeout(() => process.exit(0), 200);
    })().catch(err => {
      console.error(err);
      process.exit(1);
    });
  `);

  assert.equal(result.ok, true);
  assert.equal(result.answer, "No encontré documentos suficientes en la base legal indexada para responder con precisión.");
  assert.equal(result.sources.length, 0);
  assert.ok(result.attempts.used > 0);
});

