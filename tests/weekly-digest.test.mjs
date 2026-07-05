import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

function runTs(code) {
  const result = spawnSync(process.execPath, ["node_modules/tsx/dist/cli.mjs", "--eval", code], { encoding: "utf8" });

  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || result.error?.message || "tsx execution failed");
  }

  return JSON.parse(result.stdout.trim());
}

test("weekly digest agrupa documentos por materia", () => {
  const digest = runTs(`
    import { generateWeeklyDigest } from "./lib/ai/weeklyDigest";
    const digest = generateWeeklyDigest({
      periodStart: "2026-06-09",
      periodEnd: "2026-06-16",
      documents: [
        { title: "Resolucion SAT", matter: "fiscal", impactLevel: "alto", source: "DOF" },
        { title: "Acuerdo COFEPRIS", matter: "salud", impactLevel: "bajo", source: "DOF" },
        { title: "Criterio fiscal", matter: "fiscal", impactLevel: "medio", source: "SIDOF" }
      ]
    });
    console.log(JSON.stringify(digest));
  `);

  assert.equal(digest.totalDocuments, 3);
  assert.equal(digest.highImpactCount, 1);
  assert.equal(digest.matters.fiscal, 2);
  assert.equal(digest.matters.salud, 1);
});
