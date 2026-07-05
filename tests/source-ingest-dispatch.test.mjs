import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { spawnSync } from "node:child_process";

function runTs(code) {
  const result = spawnSync(process.execPath, ["node_modules/tsx/dist/cli.mjs", "--eval", code], {
    cwd: process.cwd(),
    encoding: "utf8",
    timeout: 30000,
    env: { ...process.env, NODE_ENV: "test" },
  });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || "tsx execution failed");
  return JSON.parse(result.stdout.trim().split("\n").pop() || "{}");
}

test("política de ingesta despacha adaptadores oficiales", () => {
  const result = runTs(`
    import { resolveIngestPolicy } from "./lib/sources/ingestPolicy";
    console.log(JSON.stringify({
      sidof: resolveIngestPolicy({ adapter: "SIDOF", slug: "SIDOF", type: "sidof", requiresBrowser: false }),
      diputados: resolveIngestPolicy({ adapter: "DIPUTADOS", slug: "DIPUTADOS", type: "diputados", requiresBrowser: false }),
      dof: resolveIngestPolicy({ adapter: "DOF", slug: "DOF_WEB", type: "dof", requiresBrowser: false }),
      sjf: resolveIngestPolicy({ adapter: "SJF", slug: "SCJN_SJF", type: "sjf", requiresBrowser: true }),
      scjn: resolveIngestPolicy({ adapter: "SCJN_LEG", slug: "SCJN_LEG", type: "scjn", requiresBrowser: true })
    }));
  `);

  assert.equal(result.sidof.handler, "registry");
  assert.equal(result.sidof.registryKey, "SIDOF");
  assert.equal(result.diputados.registryKey, "DIPUTADOS");
  assert.equal(result.dof.handler, "dof-web");
  assert.equal(result.sjf.handler, "warning");
  assert.equal(result.sjf.warningCode, "BROWSER_REQUIRED");
  assert.equal(result.scjn.handler, "warning");
  assert.equal(result.scjn.warningCode, "BLOCKED_BY_PROVIDER");
});

test("SIDOF usa endpoints oficiales actuales", () => {
  const source = fs.readFileSync("lib/sources/sidof.ts", "utf8");
  assert.match(source, /https:\/\/sidof\.segob\.gob\.mx["']/);
  assert.match(source, /\/diarios\/porFecha\/\$\{dateStr\}/);
  assert.match(source, /\/notas\/\$\{dateStr\}/);
  assert.match(source, /\/notas\/nota\/\$\{codNota\}/);
  assert.match(source, /\/documentos\/pdf\//);
  assert.doesNotMatch(source, /sidof\.segob\.gob\.mx\/dof\/sidof/);
});

test("runSourceIngest conecta DOF Web y políticas de advertencia", () => {
  const source = fs.readFileSync("lib/ingest/runIngest.ts", "utf8");
  const policy = fs.readFileSync("lib/sources/ingestPolicy.ts", "utf8");
  assert.match(source, /resolveIngestPolicy\s*\(/);
  assert.match(source, /ingestDofWeb\s*\(/);
  assert.match(policy, /BROWSER_REQUIRED/);
  assert.match(policy, /BLOCKED_BY_PROVIDER/);
});

test("Diputados conserva índice y fallback de codificación", () => {
  const source = fs.readFileSync("lib/sources/diputados.ts", "utf8");
  assert.match(source, /LeyesBiblio\/index\.htm/);
  assert.match(source, /TextDecoder/);
  assert.match(source, /windows-1252|latin1/i);
});

test("Diputados extrae PDFs relativos y conocidos desde LeyesBiblio", () => {
  const result = runTs(`
    import { extractDiputadosPdfItems } from "./lib/sources/diputados";
    const html = \`
      <html><body>
        <a href="pdf/CPEUM.pdf">Constitución Política de los Estados Unidos Mexicanos</a>
        <a href="/LeyesBiblio/pdf/LFT.pdf">Ley Federal del Trabajo</a>
        <a href="https://www.diputados.gob.mx/LeyesBiblio/pdf/LISR.pdf"></a>
        <a href="/LeyesBiblio/ref/CPEUM.htm">Reformas</a>
      </body></html>\`;
    const items = extractDiputadosPdfItems(html, 20);
    console.log(JSON.stringify(items));
  `);

  assert.equal(result.length, 3);
  assert.equal(result[0].url, "https://www.diputados.gob.mx/LeyesBiblio/pdf/CPEUM.pdf");
  assert.equal(result[1].url, "https://www.diputados.gob.mx/LeyesBiblio/pdf/LFT.pdf");
  assert.equal(result[2].title, "Ley del Impuesto sobre la Renta");
  assert.equal(result[2].tema, "fiscal");
});

test("dedupe refleja items oficiales en Document para búsqueda híbrida", () => {
  const source = fs.readFileSync("lib/ingest/dedupe.ts", "utf8");
  assert.match(source, /mirrorItemToDocument/);
  assert.match(source, /prisma\.document\.(upsert|findFirst)/);
  assert.match(source, /documentVersion/);
});

test("clasificador legacy detecta materia mercantil", () => {
  const result = runTs(`
    import { classifyItem } from "./lib/classifier";
    console.log(JSON.stringify(classifyItem("Ley General de Sociedades Mercantiles", "contrato mercantil y comercio")));
  `);

  assert.equal(result.tema, "mercantil");
});
