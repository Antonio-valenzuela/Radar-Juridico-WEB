import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

function runTs(code) {
  const result = spawnSync(process.execPath, ["node_modules/tsx/dist/cli.mjs", "--eval", code], {
    encoding: "utf8",
    env: { ...process.env, LLM_PROVIDER: "local" },
  });

  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || result.error?.message || "tsx execution failed");
  }

  return JSON.parse(result.stdout.trim());
}

test("isOfficialDomain valida correctamente dominios oficiales", () => {
  const result = runTs(`
    import { isOfficialDomain } from "./lib/legal-radar";
    console.log(JSON.stringify({
      dof: isOfficialDomain("https://dof.gob.mx/nota_detalle.php"),
      scjn: isOfficialDomain("https://sjf2.scjn.gob.mx/detalle"),
      blog: isOfficialDomain("https://elblogdelabogado.com/articulo"),
      noticias: isOfficialDomain("https://reforma.com/news"),
      invalid: isOfficialDomain("not-a-url")
    }));
  `);

  assert.equal(result.dof, true);
  assert.equal(result.scjn, true);
  assert.equal(result.blog, false);
  assert.equal(result.noticias, false);
  assert.equal(result.invalid, false);
});

test("getSourceFromUrl y getTypeFromUrl mapean correctamente", () => {
  const result = runTs(`
    import { getSourceFromUrl, getTypeFromUrl } from "./lib/legal-radar";
    console.log(JSON.stringify({
      dofSource: getSourceFromUrl("https://dof.gob.mx/index.php"),
      diputadosSource: getSourceFromUrl("https://www.diputados.gob.mx/LeyesBiblio/"),
      leyType: getTypeFromUrl("https://www.diputados.gob.mx/LeyesBiblio/pdf/1.pdf"),
      jurisType: getTypeFromUrl("https://sjf2.scjn.gob.mx/detalle/tesis/12345")
    }));
  `);

  assert.equal(result.dofSource, "Diario Oficial de la Federación");
  assert.equal(result.diputadosSource, "Cámara de Diputados");
  assert.equal(result.leyType, "ley");
  assert.equal(result.jurisType, "jurisprudencia");
});

test("findExcerptAndMatches cuenta coincidencias y genera extracto", () => {
  const result = runTs(`
    import { findExcerptAndMatches } from "./lib/legal-radar";
    const text = "La ley de amparo es una ley reglamentaria de los artículos 103 y 107 de la Constitución Federal. El juicio de amparo es el principal medio de defensa.";
    const matchesInfo = findExcerptAndMatches(text, "amparo");
    console.log(JSON.stringify(matchesInfo));
  `);

  assert.equal(result.matches, 2);
  assert.ok(result.excerpt.includes("amparo"));
});

