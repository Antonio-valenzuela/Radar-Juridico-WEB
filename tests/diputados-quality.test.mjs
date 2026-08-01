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
  if (result.status === 0) return JSON.parse(result.stdout.trim().split("\n").pop() || "{}");
  throw new Error(result.stderr || result.stdout || "tsx execution failed");
}

test("Diputados clasifica títulos jurídicos y marca navegación como sospechosa", () => {
  const result = runTs(`
    import { assessDiputadosTitle } from "./lib/sources/diputados";
    console.log(JSON.stringify({
      law: assessDiputadosTitle("Ley Federal del Trabajo", "LFT.pdf"),
      nav: assessDiputadosTitle("Lista de sesiones y directorio", "lista.pdf")
    }));
  `);

  assert.equal(result.law.status, "valid");
  assert.equal(result.law.matter, "laboral");
  assert.equal(result.nav.status, "suspicious");
  assert.ok(result.nav.reasons.length > 0);
});

test("Diputados separa fecha de reforma de fecha de recuperación", () => {
  const result = runTs(`
    import { extractDiputadosPdfItems } from "./lib/sources/diputados";
    const html = '<table><tr><td>1</td><td><a href="pdf/CPEUM.pdf">Constitución Política de los Estados Unidos Mexicanos</a></td><td>Última reforma DOF 15/09/2025</td></tr></table>';
    const [item] = extractDiputadosPdfItems(html, 20);
    console.log(JSON.stringify({
      ...item,
      published: item.published.toISOString(),
      raw: item.raw
    }));
  `);

  assert.equal(result.qualityStatus, "valid");
  assert.equal(result.published, "2025-09-15T00:00:00.000Z");
  assert.equal(result.lastReformDate, "2025-09-15T00:00:00.000Z");
  assert.equal(result.publicationDate, null);
  assert.equal(result.raw.reformDate, "2025-09-15T00:00:00.000Z");
  assert.equal(result.raw.dateSource, "dof_reform");
  assert.notEqual(result.raw.retrievedAt, result.raw.reformDate);
});

test("Diputados separa publicación original y última reforma cuando hay dos fechas", () => {
  const result = runTs(`
    import { extractDiputadosPdfItems } from "./lib/sources/diputados";
    const html = '<table><tr><td>DOF 05/02/1917</td><td><a href="pdf/CPEUM.pdf">Constitución Política de los Estados Unidos Mexicanos</a></td><td>DOF 02/06/2026</td></tr></table>';
    const [item] = extractDiputadosPdfItems(html, 20);
    console.log(JSON.stringify({ ...item, published: item.published.toISOString(), publicationDate: item.publicationDate?.toISOString() || null, lastReformDate: item.lastReformDate?.toISOString() || null }));
  `);

  assert.equal(result.publicationDate, "1917-02-05T00:00:00.000Z");
  assert.equal(result.lastReformDate, "2026-06-02T00:00:00.000Z");
  assert.equal(result.published, "2026-06-02T00:00:00.000Z");
});

test("Diputados retiene sin publicación los documentos sin fecha jurídica verificable", () => {
  const result = runTs(`
    import { extractDiputadosPdfItems } from "./lib/sources/diputados";
    const html = '<a href="pdf/LFT.pdf">Ley Federal del Trabajo</a>';
    const [item] = extractDiputadosPdfItems(html, 20);
    console.log(JSON.stringify({
      qualityStatus: item.qualityStatus,
      rawQualityStatus: item.raw.qualityStatus,
      published: item.published,
      publicationDate: item.publicationDate,
      lastReformDate: item.lastReformDate,
      retrievedAt: item.raw.retrievedAt,
    }));
  `);

  assert.equal(result.qualityStatus, "suspicious");
  assert.equal(result.rawQualityStatus, "pending_review");
  assert.equal(result.published, null);
  assert.equal(result.publicationDate, null);
  assert.equal(result.lastReformDate, null);
  assert.ok(result.retrievedAt);
});

test("Diputados no usa administrativo como materia por descarte", () => {
  const result = runTs(`
    import { extractDiputadosPdfItems } from "./lib/sources/diputados";
    const html = '<a href="pdf/listado.pdf">Lista de sesiones y directorio</a>';
    const [item] = extractDiputadosPdfItems(html, 20);
    console.log(JSON.stringify(item));
  `);

  assert.equal(result.qualityStatus, "suspicious");
  assert.equal(result.tema, null);
  assert.ok(result.qualityReasons.includes("title_not_legal"));
});

test("Diputados reconoce abreviaturas oficiales de LeyesBiblio", () => {
  const result = runTs(`
    import { extractDiputadosPdfItems } from "./lib/sources/diputados";
    const html = '<a href="pdf/CCom.pdf"></a><a href="pdf/CNPCF.pdf"></a>';
    console.log(JSON.stringify(extractDiputadosPdfItems(html, 20)));
  `);

  assert.equal(result[0].qualityStatus, "suspicious");
  assert.equal(result[0].raw.qualityStatus, "pending_review");
  assert.equal(result[0].title, "Código de Comercio");
  assert.equal(result[0].tema, "mercantil");
  assert.equal(result[1].qualityStatus, "suspicious");
  assert.equal(result[1].raw.qualityStatus, "pending_review");
  assert.equal(result[1].title, "Código Nacional de Procedimientos Civiles y Familiares");
});

test("diagnóstico de Diputados es de solo lectura salvo --reprocess y no borra", () => {
  const script = fs.readFileSync("scripts/inspect-diputados-quality.ts", "utf8");
  assert.match(script, /--reprocess/);
  assert.doesNotMatch(script, /deleteMany|delete\s*\(/);
  assert.match(script, /runSourceIngest\("DIPUTADOS"/);
  assert.match(script, /source:\s*item\.source/);
});

test("runIngest manda items sospechosos a cuarentena antes de persistir", () => {
  const source = fs.readFileSync("lib/ingest/runIngest.ts", "utf8");
  assert.match(source, /raw\.qualityStatus\s*===\s*["']suspicious["']/);
  assert.match(source, /quarantineDocument\s*\(/);
});
