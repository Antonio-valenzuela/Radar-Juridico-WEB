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

test("SSRF: bloquear todas las redes IP no públicas relevantes", () => {
  const result = runTs(`
    import { isNonPublicIp } from "./lib/security/urlValidation";
    const blocked = [
      "0.0.0.0",
      "100.100.100.200",
      "192.0.2.1",
      "198.18.0.1",
      "224.0.0.1",
      "255.255.255.255",
      "::",
      "::1",
      "::ffff:127.0.0.1",
      "fc12::1",
      "fd12::1",
      "fe90::1",
      "ff02::1",
      "2001:db8::1",
    ].map((address) => [address, isNonPublicIp(address)]);
    const publicAddresses = [
      "8.8.8.8",
      "1.1.1.1",
      "2606:4700:4700::1111",
      "2a00:1450:4009:80b::200e",
    ].map((address) => [address, isNonPublicIp(address)]);
    console.log(JSON.stringify({ blocked, publicAddresses }));
  `);

  for (const [address, blocked] of result.blocked) {
    assert.equal(blocked, true, `${address} debe bloquearse`);
  }
  for (const [address, blocked] of result.publicAddresses) {
    assert.equal(blocked, false, `${address} debe aceptarse como global unicast`);
  }
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
