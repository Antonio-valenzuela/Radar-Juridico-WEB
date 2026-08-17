import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

test("acciones administrativas usan adminFetch y JSON con itemId", () => {
  const button = fs.readFileSync("app/components/AdminItemActionButton.tsx", "utf8");
  assert.match(button, /adminFetch\(/);
  assert.match(button, /JSON\.stringify\(\{ itemId \}\)/);
  assert.doesNotMatch(button, /dev-admin-token/);
});

test("enriquecimiento, reindexado y alertas no exponen errores internos", () => {
  for (const file of [
    "app/api/admin/enrich-item/route.ts",
    "app/api/admin/reindex-document/route.ts",
    "app/api/admin/evaluate-alerts/route.ts",
  ]) {
    const source = fs.readFileSync(file, "utf8");
    assert.match(source, /message:/);
    assert.doesNotMatch(source, /error\.message\s*\|\|/);
  }
});

test("la pantalla de alertas usa el helper administrativo central", () => {
  const page = fs.readFileSync("app/watchlists/page.tsx", "utf8");
  assert.match(page, /adminFetch\(/);
  assert.match(page, /juridico_admin_token|setAdminToken|getAdminToken/);
  assert.doesNotMatch(page, /fetch\(\"\/api\/watchlist/);
});

test("expedientes y machotes exigen autenticación sin token hardcodeado", () => {
  const cases = fs.readFileSync("app/legal-hub/expedientes/page.tsx", "utf8");
  const templates = fs.readFileSync("app/legal-hub/machotes/page.tsx", "utf8");
  const generateRoute = fs.readFileSync("app/api/legal-engine/generate/route.ts", "utf8");
  assert.match(cases, /adminFetch\(/);
  assert.match(cases, /Ingresa el token administrativo/);
  // machotes autentica en servidor (requireLawyerAccess) sin prompt de token de admin.
  assert.doesNotMatch(templates, /adminFetch\(/);
  assert.doesNotMatch(templates, /Ingresa el token administrativo/);
  assert.match(generateRoute, /requireLawyerAccess/);
  assert.doesNotMatch(cases, /dev-admin-token/);
  assert.doesNotMatch(templates, /dev-admin-token/);
});
