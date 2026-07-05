import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";

function runTs(code) {
  const result = spawnSync(process.execPath, ["node_modules/tsx/dist/cli.mjs", "--eval", code], {
    encoding: "utf8",
    timeout: 15000
  });
  if (result.status !== 0) throw new Error(result.stderr || "tsx execution failed");
  return JSON.parse(result.stdout.trim());
}

// --- Task Taxonomy tests ---

test("taskTaxonomy contiene cumplimiento-fiscal", () => {
  const result = runTs(`
    import { getTaskById } from "./lib/tasks/taskTaxonomy";
    const t = getTaskById("cumplimiento-fiscal");
    console.log(JSON.stringify({ found: !!t, matter: t?.matter }));
  `);
  assert.ok(result.found);
  assert.equal(result.matter, "fiscal");
});

test("taskTaxonomy contiene salud-regulatoria", () => {
  const result = runTs(`
    import { getTaskById } from "./lib/tasks/taskTaxonomy";
    const t = getTaskById("salud-regulatoria");
    console.log(JSON.stringify({ found: !!t, matter: t?.matter }));
  `);
  assert.ok(result.found);
  assert.equal(result.matter, "salud");
});

test("ninguna tarea usa matter civil", () => {
  const result = runTs(`
    import { TASK_TAXONOMY } from "./lib/tasks/taskTaxonomy";
    const hasCivil = TASK_TAXONOMY.some(t => t.matter === "civil");
    console.log(JSON.stringify({ hasCivil }));
  `);
  assert.equal(result.hasCivil, false);
});

test("todas las tareas requeridas existen", () => {
  const result = runTs(`
    import { TASK_TAXONOMY } from "./lib/tasks/taskTaxonomy";
    const ids = TASK_TAXONOMY.map(t => t.id);
    console.log(JSON.stringify({ ids }));
  `);
  const required = [
    "cumplimiento-fiscal", "nomina-laboral", "salud-regulatoria",
    "energia", "ambiental", "financiero", "proteccion-datos", "comercio-exterior"
  ];
  for (const id of required) {
    assert.ok(result.ids.includes(id), `Falta tarea: ${id}`);
  }
});

test("cada tarea tiene keywords, entities, sectors", () => {
  const result = runTs(`
    import { TASK_TAXONOMY } from "./lib/tasks/taskTaxonomy";
    const valid = TASK_TAXONOMY.every(t =>
      Array.isArray(t.keywords) && t.keywords.length > 0 &&
      Array.isArray(t.entities) && t.entities.length > 0 &&
      Array.isArray(t.sectors) && t.sectors.length > 0
    );
    console.log(JSON.stringify({ valid }));
  `);
  assert.ok(result.valid);
});

// --- File existence tests ---

test("app/api/search/tasks/route.ts existe", () => {
  assert.ok(fs.existsSync("app/api/search/tasks/route.ts"));
});

test("app/api/search/advanced/route.ts existe", () => {
  assert.ok(fs.existsSync("app/api/search/advanced/route.ts"));
});

test("app/search/page.tsx existe", () => {
  assert.ok(fs.existsSync("app/search/page.tsx"));
});

// --- UI content tests ---

test("/search contiene chips rápidos obligatorios", () => {
  const content = fs.readFileSync("app/search/page.tsx", "utf-8");
  const requiredChips = ["Fiscal", "Laboral", "Salud", "SAT", "IMSS", "Alto impacto", "Esta semana", "Empresas", "DOF"];
  for (const chip of requiredChips) {
    assert.ok(content.includes(chip), `Falta chip: ${chip}`);
  }
});

test("/search llama a /api/search/advanced", () => {
  const content = fs.readFileSync("app/search/page.tsx", "utf-8");
  assert.ok(content.includes("/api/search/advanced"));
});

test("/search llama a /api/search/tasks", () => {
  const content = fs.readFileSync("app/search/page.tsx", "utf-8");
  assert.ok(content.includes("/api/search/tasks"));
});
