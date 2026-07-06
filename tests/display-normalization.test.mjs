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

test("normaliza mojibake y entidades HTML visibles en resultados jurídicos", () => {
  const result = runTs(`
    import { normalizeLegalDisplayText } from "./lib/text/normalizeLegalDisplayText";
    const sample = 'Leyes Federales de M�xico . &nbsp;&nbsp;&nbsp; &quot;LXVI Legislatura&quot; Reformas en Orden Cronol�gico Reformas por Art�culo M�s de la Constituci�n LEYES FEDERALES VIGENTES �ltima reforma publicada en el Diario Oficial de la Federaci�n 003 C�DIGO de Comercio';
    console.log(JSON.stringify({ normalized: normalizeLegalDisplayText(sample) }));
  `);

  assert.match(result.normalized, /Leyes Federales de México/);
  assert.match(result.normalized, /"LXVI Legislatura"/);
  assert.match(result.normalized, /Orden Cronológico/);
  assert.match(result.normalized, /Artículo/);
  assert.match(result.normalized, /Más de la Constitución/);
  assert.match(result.normalized, /Última reforma/);
  assert.match(result.normalized, /Federación/);
  assert.match(result.normalized, /CÓDIGO de Comercio/);
  assert.doesNotMatch(result.normalized, /�|&nbsp;|&quot;|&amp;/);
});

test("busqueda y detalle de item renderizan textos normalizados", () => {
  const searchPage = fs.readFileSync("app/search/page.tsx", "utf8");
  const itemPage = fs.readFileSync("app/items/[id]/page.tsx", "utf8");

  assert.match(searchPage, /normalizeLegalDisplayText/);
  assert.match(searchPage, /normalizeLegalDisplayText\(r\.title\)/);
  assert.match(searchPage, /normalizeLegalDisplayText\(r\.summary\)/);

  assert.match(itemPage, /normalizeLegalDisplayText/);
  assert.match(itemPage, /normalizeLegalDisplayText\(item\.title\)/);
  assert.match(itemPage, /normalizeLegalDisplayText\(\s*item\.summary/);
  assert.match(itemPage, /normalizeLegalDisplayText\(chunk\.text\)/);
});
