import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const seedPath = "scripts/seed-monitored-documents.ts";

test("seed de documentos monitoreados es no destructivo e idempotente", () => {
  assert.ok(fs.existsSync(seedPath), "missing scripts/seed-monitored-documents.ts");

  const source = fs.readFileSync(seedPath, "utf8");

  assert.match(source, /MONITORED_DOCUMENTS/);
  assert.match(source, /\.upsert\(/);
  assert.doesNotMatch(source, /\.deleteMany\(|\.delete\(|TRUNCATE|DROP\s+TABLE|DROP\s+COLUMN|migrate\s+reset/i);
});

test("seed incluye documentos federales clave y URL oficial de LCE", () => {
  const source = fs.readFileSync(seedPath, "utf8");

  for (const shortCode of ["CPEUM", "LAmp", "CPF", "CCF", "CCom", "LFT", "CFF", "LAD", "LCE", "LSS", "CNPCF", "CNPP"]) {
    assert.match(source, new RegExp(`shortCode:\\s*"${shortCode}"`), `missing monitored document ${shortCode}`);
  }

  assert.match(source, /https:\/\/www\.diputados\.gob\.mx\/LeyesBiblio\/pdf\/LCE\.pdf/);
  assert.doesNotMatch(source, /LeyesBiblio\/pdf\/28\.pdf/);
});

test("seed valida URLs sin descargar ni guardar texto completo", () => {
  const source = fs.readFileSync(seedPath, "utf8");

  assert.match(source, /validateOfficialUrl/);
  assert.match(source, /method:\s*"HEAD"/);
  assert.match(source, /monitoringStatus/);
  assert.doesNotMatch(source, /rawText|originalText|DocumentVersion|DocumentChange|pdfParse|arrayBuffer\(/);
});
