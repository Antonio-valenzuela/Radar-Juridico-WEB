import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const pagePath = "app/monitoreo/page.tsx";

test("/monitoreo existe y presenta monitoreo para abogado", () => {
  assert.ok(fs.existsSync(pagePath), "missing app/monitoreo/page.tsx");
  const source = fs.readFileSync(pagePath, "utf8");

  assert.match(source, /Monitoreo de cambios legales/);
  assert.match(source, /Fuente oficial/);
  assert.match(source, /Cambios recientes/);
  assert.match(source, /Cambio detectado|Sin cambios|Pendiente de registrar/);
  assert.match(source, /Requiere revision profesional|Requiere revisión profesional/);
});

test("/monitoreo no muestra lenguaje tecnico de infraestructura o IA", () => {
  const source = fs.readFileSync(pagePath, "utf8");

  assert.doesNotMatch(source, /Redis|BullMQ|worker|embeddings|JSON|stack|provider|Gemini|fallback|cron|tsx|npx/i);
});

test("navegacion principal enlaza la pantalla de monitoreo", () => {
  const home = fs.readFileSync("app/page.tsx", "utf8");
  const legalHub = fs.readFileSync("app/legal-hub/page.tsx", "utf8");

  assert.match(home, /href="\/monitoreo"/);
  assert.match(legalHub, /href="\/monitoreo"/);
});
