import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

test("Radar Legal UI corta cargas largas con AbortController y muestra reintento", () => {
  const content = fs.readFileSync("app/rag/page.tsx", "utf8");

  assert.match(content, /AbortController/);
  assert.match(content, /setTimeout\(\(\)\s*=>\s*controller\.abort/);
  assert.match(content, /Reintentar/);
  assert.match(content, /resultado parcial|Resultados parciales|parcial/i);
});

test("Búsqueda avanzada ejecuta fuentes oficiales cuando local no alcanza", () => {
  const content = fs.readFileSync("app/api/search/advanced/route.ts", "utf8");

  assert.match(content, /searchOfficialSources/);
  assert.match(content, /LOCAL_RESULT_THRESHOLD/);
  assert.match(content, /sourcesConsulted/);
  assert.match(content, /externalResults/);
  assert.match(content, /officialSources/);
});

test("Búsqueda avanzada no descarta resultados semánticos por el OR textual", () => {
  const content = fs.readFileSync("app/api/search/advanced/route.ts", "utf8");

  assert.match(content, /semanticStructuredWhere/);
  assert.doesNotMatch(content, /id:\s*\{\s*in:\s*itemsToFetch\s*\}[\s\S]{0,120}whereClause/);
});

test("Búsqueda avanzada UI ofrece acciones útiles en vacío real", () => {
  const content = fs.readFileSync("app/search/page.tsx", "utf8");

  assert.match(content, /Agregar link jurídico/);
  assert.match(content, /\/admin\/ingest\/manual-url/);
  assert.match(content, /Buscar en fuentes oficiales/);
  assert.match(content, /Quitar filtros/);
  assert.match(content, /Reintentar búsqueda ampliada/);
});

test("Dashboard, navegación principal y Documentos exponen Agregar link jurídico", () => {
  const dashboard = fs.readFileSync("app/page.tsx", "utf8");
  const documents = fs.readFileSync("app/items/page.tsx", "utf8");

  for (const content of [dashboard, documents]) {
    assert.match(content, /Agregar link jurídico/);
    assert.match(content, /\/admin\/ingest\/manual-url/);
  }
});

test("Dashboard normaliza títulos mojibake antes de mostrarlos", () => {
  const dashboard = fs.readFileSync("app/page.tsx", "utf8");

  assert.match(dashboard, /normalizeLegalDisplayText/);
  assert.doesNotMatch(dashboard, /\{item\.title\}/);
});

test("ingesta manual persiste señales de búsqueda, indexación y RAG", () => {
  const content = fs.readFileSync("lib/ingest/manualUrl.ts", "utf8");

  assert.match(content, /searchableText|rawText/);
  assert.match(content, /indexingStatus/);
  assert.match(content, /ragReady|retrievable|documentVersionId/);
  assert.match(content, /indexDocumentVersion/);
  assert.match(content, /decodeResponseBody/);
  assert.match(content, /windows-1252/);
});

test("RAG y ranking toleran similitud nula o no numérica", () => {
  const ragAnswer = fs.readFileSync("lib/rag/answer.ts", "utf8");
  const ragRetrieve = fs.readFileSync("lib/rag/retrieve.ts", "utf8");
  const ranking = fs.readFileSync("lib/search/searchRanking.ts", "utf8");

  assert.match(ragAnswer, /Number\.isFinite\(c\.score\)/);
  assert.match(ragRetrieve, /Number\.isFinite\(chunk\.similarity\)/);
  assert.match(ranking, /semanticScore/);
});
