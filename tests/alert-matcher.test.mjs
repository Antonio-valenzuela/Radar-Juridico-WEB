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

test("alert matcher detecta regla fiscal", () => {
  const match = runTs(`
    import { matchAlertRule } from "./lib/ai/alertMatcher";
    const match = matchAlertRule({
      ruleText: "Avisame sobre cambios fiscales para empresas",
      documentTitle: "Resolucion del SAT sobre obligaciones fiscales",
      documentSummary: "Nueva disposicion fiscal para contribuyentes",
      aiAnalysis: {
        matter: "fiscal",
        confidence: 0.8,
        summary: "Disposicion fiscal",
        entities: ["SAT"],
        affectedSectors: ["empresas", "contribuyentes"],
        impactLevel: "medium",
        keywords: ["fiscal", "SAT"]
      }
    });
    console.log(JSON.stringify(match));
  `);

  assert.equal(match.matched, true);
  assert.ok(match.score >= 0.7);
  assert.ok(match.matchedKeywords.includes("fiscal"));
});

test("alert matcher no marca documentos irrelevantes", () => {
  const match = runTs(`
    import { matchAlertRule } from "./lib/ai/alertMatcher";
    const match = matchAlertRule({
      ruleText: "Avisame sobre cambios fiscales para empresas",
      documentTitle: "Aviso sanitario para hospitales",
      documentSummary: "Lineamientos de salud publica",
      aiAnalysis: {
        matter: "salud",
        confidence: 0.8,
        summary: "Aviso sanitario",
        entities: ["COFEPRIS"],
        affectedSectors: ["hospitales"],
        impactLevel: "low",
        keywords: ["salud"]
      }
    });
    console.log(JSON.stringify(match));
  `);

  assert.equal(match.matched, false);
  assert.ok(match.score < 0.35);
});
