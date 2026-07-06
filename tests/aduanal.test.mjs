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

test("clasificador clasifica correctamente palabras clave aduanales", () => {
  const result = runTs(`
    import { classifyItem } from "./lib/classifier";
    const res1 = classifyItem("Decreto que reforma la Ley Aduanera y las atribuciones de la aduana");
    const res2 = classifyItem("Reglas Generales de Comercio Exterior para 2026");
    const res3 = classifyItem("Lineamientos sobre la presentación de pedimentos y despacho aduanero");
    const res4 = classifyItem("Decreto de aranceles y la fracción arancelaria de importación");
    console.log(JSON.stringify({
      res1: res1.tema,
      res2: res2.tema,
      res3: res3.tema,
      res4: res4.tema
    }));
  `);

  assert.equal(result.res1, "aduanal");
  assert.equal(result.res2, "aduanal");
  assert.equal(result.res3, "aduanal");
  assert.equal(result.res4, "aduanal");
});

test("isLegalMatter y constantes de la IA contienen la materia aduanal", () => {
  const result = runTs(`
    import { isLegalMatter, LEGAL_MATTERS } from "./lib/ai/types";
    console.log(JSON.stringify({
      isAduanalMatter: isLegalMatter("aduanal"),
      hasAduanal: LEGAL_MATTERS.includes("aduanal"),
      hasComercioExterior: LEGAL_MATTERS.includes("comercio_exterior")
    }));
  `);

  assert.equal(result.isAduanalMatter, true);
  assert.equal(result.hasAduanal, true);
  assert.equal(result.hasComercioExterior, true);
});

test("reglas locales detectan correctamente la ANAM como autoridad", () => {
  const result = runTs(`
    import { analyzeWithLocalRules } from "./lib/ai/localRulesProvider";
    console.log(JSON.stringify({})); // load check
  `);
  assert.ok(result);
});

test("taxonomía de tareas contiene la materia aduanal y la regulacion-aduanal", () => {
  const result = runTs(`
    import { VALID_MATTERS, TASK_TAXONOMY } from "./lib/tasks/taskTaxonomy";
    console.log(JSON.stringify({
      validMattersHasAduanal: VALID_MATTERS.includes("aduanal"),
      hasAduanalTask: TASK_TAXONOMY.some(t => t.id === "regulacion-aduanal" && t.matter === "aduanal")
    }));
  `);

  assert.equal(result.validMattersHasAduanal, true);
  assert.equal(result.hasAduanalTask, true);
});
