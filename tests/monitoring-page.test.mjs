import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const pagePath = "app/monitoreo/page.tsx";

test("/monitoreo existe y presenta monitoreo para abogado", () => {
  assert.ok(fs.existsSync(pagePath), "missing app/monitoreo/page.tsx");
  const source = fs.readFileSync(pagePath, "utf8");

  assert.match(source, /Vigilancia documental/);
  assert.match(source, /Fuente oficial/);
  assert.match(source, /Cambios recientes/);
  assert.match(source, /Cambio detectado — sin desglose por artículo disponible/);
  assert.match(source, /Desglose por artículo disponible/);
  assert.match(source, /summaryBullets/);
  assert.match(source, /legalChangesHref/);
  assert.match(source, /Requiere revision profesional|Requiere revisión profesional/);
});

test("/monitoreo no muestra lenguaje tecnico de infraestructura o IA", () => {
  const source = fs.readFileSync(pagePath, "utf8");

  assert.doesNotMatch(source, /Redis|BullMQ|worker|embeddings|JSON|stack|provider|Gemini|fallback|cron|tsx|npx/i);
});

test("navegacion principal enlaza la pantalla de monitoreo", () => {
  const home = fs.readFileSync("app/page.tsx", "utf8");
  const appShell = fs.readFileSync("components/layout/AppShell.tsx", "utf8");

  assert.match(home, /href="\/monitoreo"/);
  assert.match(appShell, /href: '\/monitoreo'/);
  assert.match(appShell, /Vigilancia documental/);
  assert.match(appShell, /Cambios por artículo/);
});

test("la vista de cambios admite filtro directo por norma", () => {
  const page = fs.readFileSync("app/legal-hub/cambios/page.tsx", "utf8");
  const route = fs.readFileSync("app/api/legal/diffs/route.ts", "utf8");

  assert.match(page, /searchParams\.get\("norma"\)/);
  assert.match(route, /searchParams\.get\("norma"\)/);
});
