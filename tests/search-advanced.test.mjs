import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

function runTs(code) {
  const result = spawnSync(process.execPath, ["node_modules/tsx/dist/cli.mjs", "--eval", code], {
    encoding: "utf8",
    timeout: 15000
  });
  if (result.status !== 0) throw new Error(result.stderr || "tsx execution failed");
  return JSON.parse(result.stdout.trim());
}

// --- Validation tests ---

test("parser rechaza dateFrom inválida", () => {
  const result = runTs(`
    import { validateSearchInput } from "./lib/search/searchParser";
    const errors = validateSearchInput({ dateFrom: "fecha-mala" });
    console.log(JSON.stringify({ hasError: errors.some(e => e.field === "dateFrom") }));
  `);
  assert.ok(result.hasError);
});

test("parser rechaza dateTo inválida", () => {
  const result = runTs(`
    import { validateSearchInput } from "./lib/search/searchParser";
    const errors = validateSearchInput({ dateTo: "no-es-fecha" });
    console.log(JSON.stringify({ hasError: errors.some(e => e.field === "dateTo") }));
  `);
  assert.ok(result.hasError);
});

test("parser rechaza limit > 100", () => {
  const result = runTs(`
    import { validateSearchInput } from "./lib/search/searchParser";
    const errors = validateSearchInput({ limit: 500 });
    console.log(JSON.stringify({ hasError: errors.some(e => e.field === "limit") }));
  `);
  assert.ok(result.hasError);
});

test("parser rechaza limit < 1", () => {
  const result = runTs(`
    import { validateSearchInput } from "./lib/search/searchParser";
    const errors = validateSearchInput({ limit: 0 });
    console.log(JSON.stringify({ hasError: errors.some(e => e.field === "limit") }));
  `);
  assert.ok(result.hasError);
});

test("parser rechaza offset > 10000", () => {
  const result = runTs(`
    import { validateSearchInput } from "./lib/search/searchParser";
    const errors = validateSearchInput({ offset: 99999 });
    console.log(JSON.stringify({ hasError: errors.some(e => e.field === "offset") }));
  `);
  assert.ok(result.hasError);
});

test("parser rechaza mode inválido", () => {
  const result = runTs(`
    import { validateSearchInput } from "./lib/search/searchParser";
    const errors = validateSearchInput({ mode: "magic" });
    console.log(JSON.stringify({ hasError: errors.some(e => e.field === "mode") }));
  `);
  assert.ok(result.hasError);
});

test("parser rechaza sort inválido", () => {
  const result = runTs(`
    import { validateSearchInput } from "./lib/search/searchParser";
    const errors = validateSearchInput({ sort: "magic" });
    console.log(JSON.stringify({ hasError: errors.some(e => e.field === "sort") }));
  `);
  assert.ok(result.hasError);
});

test("parser rechaza query > 500 caracteres", () => {
  const result = runTs(`
    import { validateSearchInput } from "./lib/search/searchParser";
    const errors = validateSearchInput({ query: "a".repeat(501) });
    console.log(JSON.stringify({ hasError: errors.some(e => e.field === "query") }));
  `);
  assert.ok(result.hasError);
});

test("parser acepta input válido sin errores", () => {
  const result = runTs(`
    import { validateSearchInput } from "./lib/search/searchParser";
    const errors = validateSearchInput({ query: "fiscal", limit: 20, mode: "text", sort: "date" });
    console.log(JSON.stringify({ errorCount: errors.length }));
  `);
  assert.equal(result.errorCount, 0);
});

// --- Parser output tests ---

test("parser NO genera filtros Prisma con authority, affectedSectors o entities", () => {
  const result = runTs(`
    import { parseAdvancedSearch } from "./lib/search/searchParser";
    const parsed = parseAdvancedSearch({ authority: "SAT", entity: "IMSS", sector: "empresas" });
    const where = JSON.stringify(parsed.whereClause);
    console.log(JSON.stringify({
      hasAuthority: where.includes("authority"),
      hasAffectedSectors: where.includes("affectedSectors"),
      hasEntities: where.includes("entities"),
      postFilters: parsed.postFilters
    }));
  `);
  assert.equal(result.hasAuthority, false, "whereClause should not contain authority");
  assert.equal(result.hasAffectedSectors, false, "whereClause should not contain affectedSectors");
  assert.equal(result.hasEntities, false, "whereClause should not contain entities");
  assert.equal(result.postFilters.authority, "SAT");
  assert.equal(result.postFilters.entity, "IMSS");
  assert.equal(result.postFilters.sector, "empresas");
});

test("parser genera whereClause con tema para matter", () => {
  const result = runTs(`
    import { parseAdvancedSearch } from "./lib/search/searchParser";
    const parsed = parseAdvancedSearch({ matter: "fiscal" });
    console.log(JSON.stringify({ tema: parsed.whereClause.tema }));
  `);
  assert.equal(result.tema, "fiscal");
});

test("parser genera whereClause con impacto para impactLevel", () => {
  const result = runTs(`
    import { parseAdvancedSearch } from "./lib/search/searchParser";
    const parsed = parseAdvancedSearch({ impactLevel: "alto" });
    console.log(JSON.stringify({ impacto: parsed.whereClause.impacto }));
  `);
  assert.equal(result.impacto, "alto");
});

test("parser expande task a keywords y semanticQuery", () => {
  const result = runTs(`
    import { parseAdvancedSearch } from "./lib/search/searchParser";
    const parsed = parseAdvancedSearch({ task: "cumplimiento-fiscal" });
    console.log(JSON.stringify({
      hasTema: parsed.whereClause.tema === "fiscal",
      hasISR: parsed.expandedKeywords.includes("ISR"),
      semantic: parsed.semanticQuery
    }));
  `);
  assert.ok(result.hasTema);
  assert.ok(result.hasISR);
  assert.ok(result.semantic.length > 0);
});
