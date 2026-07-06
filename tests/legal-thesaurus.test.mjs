import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";

function runTs(code) {
  const result = spawnSync(process.execPath, ["node_modules/tsx/dist/cli.mjs", "--eval", code], {
    encoding: "utf8",
    env: { ...process.env, NODE_ENV: "test" },
  });
  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || result.error?.message || "tsx execution failed");
  }
  return JSON.parse(result.stdout.trim());
}

test("legalThesaurus contiene las materias mínimas y la estructura correcta", () => {
  const result = runTs(`
    import { LEGAL_THESAURUS } from "./lib/search/legalThesaurus";
    console.log(JSON.stringify({
      keys: Object.keys(LEGAL_THESAURUS),
      hasFamiliar: !!LEGAL_THESAURUS.familiar,
      hasPenal: !!LEGAL_THESAURUS.penal,
      hasFiscal: !!LEGAL_THESAURUS.fiscal,
      hasEmbargo: !!LEGAL_THESAURUS.embargo,
      hasCnpcf: !!LEGAL_THESAURUS.cnpcf,
      cnpcfTerms: LEGAL_THESAURUS.cnpcf?.relatedTerms || []
    }));
  `);

  assert.equal(result.hasFamiliar, true);
  assert.equal(result.hasPenal, true);
  assert.equal(result.hasFiscal, true);
  assert.equal(result.hasEmbargo, true);
  assert.equal(result.hasCnpcf, true);
  assert.match(result.cnpcfTerms.join(","), /Código Nacional de Procedimientos Civiles y Familiares/);
  assert.match(result.cnpcfTerms.join(","), /justicia digital/);
  assert.match(result.keys.join(","), /laboral/);
  assert.match(result.keys.join(","), /transparencia/);
});

test("busqueda avanzada expone filtros para familiar, amparo y CNPCF", () => {
  const page = fs.readFileSync("app/search/page.tsx", "utf8");
  assert.match(page, /value: 'familiar'/);
  assert.match(page, /value: 'amparo'/);
  assert.match(page, /value: 'cnpcf'/);
  assert.match(page, /Código Nacional de Procedimientos Civiles y Familiares/);
});
