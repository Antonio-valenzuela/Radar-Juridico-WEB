import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";

function runTs(code) {
  const result = spawnSync(
    process.execPath,
    ["node_modules/tsx/dist/cli.mjs", "--eval", code],
    {
      encoding: "utf8",
      env: { ...process.env, NODE_ENV: "development" },
      timeout: 45000,
    }
  );
  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || result.error?.message || "tsx execution failed");
  }
  return JSON.parse(result.stdout.trim());
}

test("deriveSearchState marca parcial cuando una fuente expira con resultados existentes", () => {
  const result = runTs(`
    import { deriveSearchState } from "./lib/search/searchResponse";
    const state = deriveSearchState({
      resultCount: 2,
      sources: [
        { source: "dof.gob.mx", status: "completed", resultsCount: 2 },
        { source: "diputados.gob.mx", status: "timed_out", resultsCount: 0 }
      ]
    });
    console.log(JSON.stringify(state));
  `);

  assert.equal(result.partial, true);
  assert.equal(result.timedOut, true);
  assert.match(result.message, /parcial/i);
});

test("deriveSearchState no llama vacío a un timeout sin resultados", () => {
  const result = runTs(`
    import { deriveSearchState } from "./lib/search/searchResponse";
    const state = deriveSearchState({
      resultCount: 0,
      sources: [{ source: "dof.gob.mx", status: "timed_out", resultsCount: 0 }]
    });
    console.log(JSON.stringify(state));
  `);

  assert.equal(result.empty, false);
  assert.equal(result.timedOut, true);
  assert.match(result.message, /agotó|timeout|tiempo/i);
});

test("deriveSearchState usa vacío solo cuando la búsqueda terminó sin hallazgos", () => {
  const result = runTs(`
    import { deriveSearchState } from "./lib/search/searchResponse";
    const state = deriveSearchState({
      resultCount: 0,
      sources: [{ source: "local", status: "completed", resultsCount: 0 }]
    });
    console.log(JSON.stringify(state));
  `);

  assert.equal(result.empty, true);
  assert.equal(result.timedOut, false);
  assert.match(result.message, /No se encontraron/i);
});

test("legal radar ya no contiene timeout rígido de 5 segundos", () => {
  const content = fs.readFileSync("app/api/legal/radar/route.ts", "utf8");

  assert.doesNotMatch(content, /timeout\(5000/);
  assert.doesNotMatch(content, /Búsqueda excedió timeout de 5s/);
  assert.match(content, /SEARCH_TIMEOUT_MS|withTimeoutOutcome|timedOut/);
});

test("official federated search usa timeout configurable y estado por fuente", () => {
  const content = fs.readFileSync("lib/search/officialFederatedSearch.ts", "utf8");

  assert.doesNotMatch(content, /timeoutMs:\s*number\s*=\s*1000/);
  assert.match(content, /EXTERNAL_SOURCE_TIMEOUT_MS|getTimeoutMs/);
  assert.match(content, /status:\s*["']timed_out["']|status:\s*["']completed["']/);
  assert.match(content, /durationMs/);
});

test("UI de búsqueda distingue parcial, timeout, vacío y error técnico", () => {
  const content = fs.readFileSync("app/search/page.tsx", "utf8");

  assert.match(content, /partial|respuesta parcial|resultados parciales/i);
  assert.match(content, /timedOut|tiempo de espera|timeout/i);
  assert.match(content, /failed/i);
  assert.match(content, /sin coincidencias|sin resultados reales|No se encontraron/i);
  assert.match(content, /error técnico|Error técnico|No se pudo completar/i);
});

test("UI de búsqueda no muestra vacío real cuando hubo timeout, parcial o fallo", () => {
  const content = fs.readFileSync("app/search/page.tsx", "utf8");

  assert.match(content, /!searchMeta\?\.timedOut/);
  assert.match(content, /!searchMeta\?\.partial/);
  assert.match(content, /!searchMeta\?\.failed/);
});

test("UI de búsqueda avanzada aborta requests lentos y sale de Buscando", () => {
  const content = fs.readFileSync("app/search/page.tsx", "utf8");

  assert.match(content, /AbortController/);
  assert.match(content, /controller\.abort/);
  assert.match(content, /clearTimeout/);
  assert.match(content, /tiempo límite|tiempo de espera|timeout/i);
});

test("proveedor IA usa timeout abortable para evitar cargas infinitas", () => {
  const content = fs.readFileSync("lib/ai-provider.ts", "utf8");

  assert.match(content, /AbortController/);
  assert.match(content, /AI_ANALYSIS_TIMEOUT_MS|getTimeoutMs/);
  assert.match(content, /signal:\s*controller\.signal/);
  assert.match(content, /clearTimeout/);
});

test("expansión local reconoce derecho familiar aunque no se seleccione materia", () => {
  const result = runTs(`
    process.env.LLM_PROVIDER = "local";
    import { expandLegalSearch } from "./lib/search/legalExpansion";
    (async () => {
      const expansion = await expandLegalSearch({ query: "derecho familiar" });
      console.log(JSON.stringify(expansion.expanded.expandedSearch));
    })().catch((error) => {
      console.error(error);
      process.exit(1);
    });
  `);

  assert.ok(result.alternativeTerms.some((term) => /alimentos|custodia|divorcio|patria potestad/i.test(term)));
  assert.ok(result.relatedAuthorities.some((authority) => /SCJN|Familia/i.test(authority.name)));
});
