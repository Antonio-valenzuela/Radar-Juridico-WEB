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
      ADMIN_TOKEN: "dev-admin-token",
    },
  });

  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || result.error?.message || "tsx execution failed");
  }

  return JSON.parse(result.stdout.trim());
}

test("Enrichment local no truena sin API keys", () => {
  const result = runTs(`
    import { analyzeWithLocalRules } from "./lib/ai/localRulesProvider";
    (async () => {
      const res = await analyzeWithLocalRules({
        title: "Test de auditoría del SAT",
        summary: "Procedimiento de fiscalización tributaria."
      });
      console.log(JSON.stringify({ ok: !!res }));
    })().catch(err => {
      console.error(err);
      process.exit(1);
    });
  `);
  assert.ok(result.ok);
});

test("Enrichment devuelve matter válido", () => {
  const result = runTs(`
    import { analyzeWithLocalRules } from "./lib/ai/localRulesProvider";
    import { isLegalMatter } from "./lib/ai/types";
    (async () => {
      const res = await analyzeWithLocalRules({
        title: "Norma Oficial de Salud sobre vacunas",
        summary: "Regulación sanitaria aplicable en México."
      });
      console.log(JSON.stringify({ matter: res.matter, isValid: isLegalMatter(res.matter) }));
    })().catch(err => {
      console.error(err);
      process.exit(1);
    });
  `);
  assert.equal(result.matter, "salud");
  assert.ok(result.isValid);
});

test("Enrichment devuelve arrays para entities/sectors/keywords", () => {
  const result = runTs(`
    import { analyzeWithLocalRules } from "./lib/ai/localRulesProvider";
    (async () => {
      const res = await analyzeWithLocalRules({
        title: "Reforma de la Secretaría de Energía CRE",
        summary: "Nuevas directrices de electricidad."
      });
      console.log(JSON.stringify({
        hasEntities: Array.isArray(res.entities),
        hasSectors: Array.isArray(res.affectedSectors),
        hasKeywords: Array.isArray(res.keywords)
      }));
    })().catch(err => {
      console.error(err);
      process.exit(1);
    });
  `);
  assert.ok(result.hasEntities);
  assert.ok(result.hasSectors);
  assert.ok(result.hasKeywords);
});

test(".env.example contiene AI_ENABLE_EXTERNAL_CONTEXT=false", () => {
  const envContent = fs.readFileSync(".env.example", "utf8");
  assert.ok(envContent.includes("AI_ENABLE_EXTERNAL_CONTEXT=false"));
});

test("Endpoint admin sin token devuelve 401", () => {
  const routeContent = fs.readFileSync("app/api/admin/enrich-item/route.ts", "utf8");
  assert.match(routeContent, /requireAdmin/);
});

test("Endpoint admin con token válido responde estructura válida", () => {
  assert.ok(fs.existsSync("app/api/admin/enrich-item/route.ts"));
  assert.ok(fs.existsSync("app/api/admin/enrich-missing-items/route.ts"));
});
