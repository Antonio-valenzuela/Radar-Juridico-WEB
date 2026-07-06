import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const pagePath = "app/watchlists/page.tsx";
const routePath = "app/api/watchlist/route.ts";

test("/watchlists se presenta visualmente como Alertas", () => {
  const source = fs.readFileSync(pagePath, "utf8");

  assert.match(source, /Mis alertas legales/);
  assert.match(source, /Crear alerta/);
  assert.match(source, /Reglas activas/);
  assert.match(source, /Cambios recientes/);
  assert.doesNotMatch(source, /primera watchlist|Keyword|Webhook|Email=/);
});

test("Alertas reutiliza la ruta existente y no duplica pantalla", () => {
  const source = fs.readFileSync(pagePath, "utf8");

  assert.match(source, /fetch\("\/api\/watchlist"/);
  assert.match(source, /fetch\("\/api\/monitoring\/changes/);
  assert.doesNotMatch(source, /\/alertas/);
});

test("API de reglas evita errores tecnicos hacia el usuario", () => {
  const source = fs.readFileSync(routePath, "utf8");

  assert.doesNotMatch(source, /error\.message|String\(error\)/);
  assert.match(source, /No se pudo actualizar la alerta/);
});
