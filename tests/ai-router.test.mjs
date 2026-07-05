import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";

function runTs(code) {
  const result = spawnSync(process.execPath, ["node_modules/tsx/dist/cli.mjs", "--eval", code], {
    encoding: "utf8",
    env: {
      ...process.env,
      NODE_ENV: "test",
      LLM_PROVIDER: "gemini",
      GEMINI_API_KEY: "",
      OPENROUTER_API_KEY: "",
      GROQ_API_KEY: "",
    },
  });

  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || result.error?.message || "tsx execution failed");
  }

  return JSON.parse(result.stdout.trim());
}

test("router no truena sin API keys", () => {
  const result = runTs(`
    import { analyzeLegalText, analyzeLegalImage, searchRecentContext } from "./lib/ai/router";
    (async () => {
      const text = await analyzeLegalText({
        title: "Resolucion del SAT sobre IVA",
        summary: "Cambio fiscal para contribuyentes"
      });
      const image = await analyzeLegalImage({});
      const context = await searchRecentContext({ query: "SAT IVA" });
      console.log(JSON.stringify({ text, image, context }));
    })().catch((error) => {
      console.error(error);
      process.exit(1);
    });
  `);

  assert.equal(result.text.matter, "fiscal");
  assert.equal(result.image.ok, false);
  assert.equal(result.context.provider, "none");
  assert.deepEqual(result.context.results, []);
});

test("endpoints nuevos validan requireAdmin", () => {
  const matchRoute = fs.readFileSync("app/api/ai/match-alert/route.ts", "utf-8");
  const digestRoute = fs.readFileSync("app/api/ai/weekly-digest/route.ts", "utf-8");

  assert.match(matchRoute, /requireAdmin/);
  assert.match(digestRoute, /requireAdmin/);
});

test("routeLlmCompletion soporta el selector de least-used", () => {
  const result = runTs(`
    import { prisma } from "./lib/prisma";
    import { routeLlmCompletion } from "./lib/ai/router";
    (async () => {
      await prisma.aiProviderHealth.deleteMany().catch(() => {});
      await prisma.aiUsageEvent.deleteMany().catch(() => {});
      // Configurar estrategia least-used y mock API key
      process.env.AI_SELECTION_STRATEGY = "least-used";
      process.env.GEMINI_API_KEY = "mock-gemini-key";
      const res = await routeLlmCompletion("Test de prompt", "general");
      console.log(JSON.stringify({ geminiKey: process.env.GEMINI_API_KEY, res }));
    })().catch((error) => {
      console.error(error);
      process.exit(1);
    });
  `);

  assert.equal(result.res.attemptedProviders[0], "gemini");
  assert.equal(result.res.provider, "local");
  assert.equal(result.res.usedFallback, true);
});
