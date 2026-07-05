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
      LLM_PROVIDER: "local",
      GEMINI_API_KEY: "",
      OPENROUTER_API_KEY: "",
      GROQ_API_KEY: "",
      ADMIN_TOKEN: "test-token",
    },
  });

  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || result.error?.message || "tsx execution failed");
  }

  return JSON.parse(result.stdout.trim());
}

test("local provider responde análisis JSON válido", () => {
  const analysis = runTs(`
    import { analyzeWithLocalRules } from "./lib/ai/localRulesProvider";
    (async () => {
      const analysis = await analyzeWithLocalRules({
        title: "Resolución del SAT sobre obligaciones fiscales",
        summary: "Nueva disposición fiscal para contribuyentes."
      });
      console.log(JSON.stringify(analysis));
    })().catch((error) => {
      console.error(error);
      process.exit(1);
    });
  `);

  assert.equal(analysis.matter, "fiscal");
  assert.equal(typeof analysis.confidence, "number");
  assert.equal(typeof analysis.summary, "string");
  assert.ok(Array.isArray(analysis.entities));
  assert.ok(Array.isArray(analysis.affectedSectors));
  assert.ok(["low", "medium", "high"].includes(analysis.impactLevel));
  assert.ok(Array.isArray(analysis.keywords));
});

test("analyzeLegalDocument no truena sin API keys", () => {
  const analysis = runTs(`
    import { analyzeLegalDocument } from "./lib/ai/provider";
    (async () => {
      const analysis = await analyzeLegalDocument({
        title: "Acuerdo administrativo general",
        summary: "Publicación oficial de prueba."
      });
      console.log(JSON.stringify(analysis));
    })().catch((error) => {
      console.error(error);
      process.exit(1);
    });
  `);

  assert.equal(typeof analysis.summary, "string");
  assert.ok(analysis.summary.length > 0);
});

test("clasificación básica detecta fiscal, laboral y salud", () => {
  const result = runTs(`
    import { analyzeWithLocalRules } from "./lib/ai/localRulesProvider";
    (async () => {
      const fiscal = await analyzeWithLocalRules({ title: "SAT IVA ISR obligaciones fiscales" });
      const laboral = await analyzeWithLocalRules({ title: "IMSS INFONAVIT STPS obligaciones laborales" });
      const salud = await analyzeWithLocalRules({ title: "COFEPRIS emite disposición sanitaria" });
      console.log(JSON.stringify([fiscal.matter, laboral.matter, salud.matter]));
    })().catch((error) => {
      console.error(error);
      process.exit(1);
    });
  `);

  assert.deepEqual(result, ["fiscal", "laboral", "salud"]);
});

test("endpoint de análisis está protegido con requireAdmin y 401", () => {
  const route = fs.readFileSync("app/api/ai/analyze/route.ts", "utf8");

  assert.match(route, /requireAdmin/);
  assert.match(route, /!adminCheck\.ok/);
  assert.match(route, /analyzeLegalDocumentWithProvider/);
});

test("si LLM_PROVIDER=gemini sin key, cae a local", () => {
  const result = runTs(`
    import { getActiveLegalAiProviderName } from "./lib/ai/provider";
    process.env.LLM_PROVIDER = "gemini";
    process.env.GEMINI_API_KEY = "";
    console.log(JSON.stringify(getActiveLegalAiProviderName()));
  `);
  assert.equal(result, "local");
});

test("si LLM_PROVIDER=openrouter sin key, cae a local", () => {
  const result = runTs(`
    import { getActiveLegalAiProviderName } from "./lib/ai/provider";
    process.env.LLM_PROVIDER = "openrouter";
    process.env.OPENROUTER_API_KEY = "";
    console.log(JSON.stringify(getActiveLegalAiProviderName()));
  `);
  assert.equal(result, "local");
});

test("si LLM_PROVIDER=groq sin key, cae a local", () => {
  const result = runTs(`
    import { getActiveLegalAiProviderName } from "./lib/ai/provider";
    process.env.LLM_PROVIDER = "groq";
    process.env.GROQ_API_KEY = "";
    console.log(JSON.stringify(getActiveLegalAiProviderName()));
  `);
  assert.equal(result, "local");
});
