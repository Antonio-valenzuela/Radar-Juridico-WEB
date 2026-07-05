// tests/production-features.test.mjs

import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

function runTs(code) {
  const result = spawnSync(process.execPath, ["node_modules/tsx/dist/cli.mjs", "--eval", code], {
    encoding: "utf8",
    env: {
      ...process.env,
      NODE_ENV: "test",
    },
  });

  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || result.error?.message || "tsx execution failed");
  }

  return JSON.parse(result.stdout.trim());
}

test("SSRF: Bloquear local e IP privada, permitir externa", () => {
  const result = runTs(`
    import { validateUrlSecurity } from "./lib/security/urlValidation";
    (async () => {
      const localhostRes = await validateUrlSecurity('http://localhost:3000');
      const privateIpRes = await validateUrlSecurity('http://192.168.1.1');
      const validRes = await validateUrlSecurity('https://www.dof.gob.mx');
      console.log(JSON.stringify({ localhostRes, privateIpRes, validRes }));
    })().catch((error) => {
      console.error(error);
      process.exit(1);
    });
  `);

  assert.equal(result.localhostRes.valid, false);
  assert.match(result.localhostRes.error || '', /prohibido|local/i);

  assert.equal(result.privateIpRes.valid, false);
  assert.match(result.privateIpRes.error || '', /IP privada|local/i);

  assert.equal(result.validRes.valid, true);
});

test("Diff: Comparar documentos y cambios numéricos", () => {
  const result = runTs(`
    import { compareDocuments } from "./lib/documents/diff";
    const beforePlazo = "La autoridad deberá responder en un plazo de 30 días.";
    const afterPlazo = "La autoridad deberá responder en un plazo de 15 días.";
    const changesPlazo = compareDocuments(beforePlazo, afterPlazo);

    const beforePct = "El impuesto es del 16%.";
    const afterPct = "El impuesto es del 18%.";
    const changesPct = compareDocuments(beforePct, afterPct);

    console.log(JSON.stringify({ changesPlazo, changesPct }));
  `);

  const matchedPlazo = result.changesPlazo.some((c) => c.extractedPlazoDias === 15);
  assert.ok(matchedPlazo, "No detectó el cambio de plazo de 30 a 15 días");

  const matchedPct = result.changesPct.some((c) => c.extractedPorcentaje === 18);
  assert.ok(matchedPct, "No detectó el cambio porcentual de 16% a 18%");
});
