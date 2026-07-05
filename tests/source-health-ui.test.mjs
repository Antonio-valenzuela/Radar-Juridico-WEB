import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const page = fs.readFileSync("app/admin/sources/page.tsx", "utf8");

test("UI de fuentes reconoce todos los estados de health", () => {
  for (const status of [
    "OK",
    "REDIRECT_BLOCKED",
    "BLOCKED_BY_PROVIDER",
    "NOT_FOUND",
    "FETCH_ERROR",
    "BROWSER_REQUIRED",
    "WARNING_ACCESSIBLE_WITH_LIMITATIONS",
  ]) {
    assert.match(page, new RegExp(`\\b${status}\\b`), status);
  }
});

test("UI muestra mensajes claros por categoría", () => {
  assert.match(page, /Accesible/);
  assert.match(page, /Bloqueado por proveedor externo, requiere navegador\/Playwright/);
  assert.match(page, /Ruta configurada incorrecta/);
  assert.match(page, /Redirección insegura bloqueada/);
  assert.match(page, /Error de red\/TLS\/DNS/);
  assert.match(page, /Accesible con limitaciones/);
});

test("UI presenta diagnóstico técnico sin etiqueta genérica engañosa", () => {
  assert.match(page, /causeCode/);
  assert.match(page, /statusCode/);
  assert.match(page, /finalUrl/);
  assert.doesNotMatch(page, />No accesible</);
});
