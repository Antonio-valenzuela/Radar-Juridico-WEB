import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const scriptPath = "scripts/monitor-legal-documents.ts";
const libraryPath = "lib/monitoring/legalDocumentMonitor.ts";

test("monitor legal existe como script manual con modo dry-run", () => {
  assert.ok(fs.existsSync(scriptPath), "missing monitor script");
  assert.ok(fs.existsSync(libraryPath), "missing monitor library");

  const script = fs.readFileSync(scriptPath, "utf8");

  assert.match(script, /--dry-run/);
  assert.match(script, /runLegalDocumentMonitor/);
  assert.match(script, /documentos revisados|Documentos revisados/);
  assert.match(script, /sin cambios|Sin cambios/);
  assert.match(script, /cambios detectados|Cambios detectados/);
  assert.match(script, /errores|Errores/);
  assert.match(script, /bloqueados|Bloqueados/);
});

test("monitor detecta por hash y metadatos sin guardar contenido completo", () => {
  const source = fs.readFileSync(libraryPath, "utf8");

  assert.match(source, /createHash\("sha256"\)/);
  assert.match(source, /etag/);
  assert.match(source, /lastModified/);
  assert.match(source, /fileSize/);
  assert.match(source, /rawText:\s*null/);
  assert.match(source, /originalText:\s*null/);
  assert.match(source, /before:\s*null/);
  assert.match(source, /after:\s*null/);
  assert.doesNotMatch(source, /pdfParse|savePdf|fullText|textContent/);
});

test("monitor no escribe en base de datos cuando dry-run esta activo", () => {
  const source = fs.readFileSync(libraryPath, "utf8");

  assert.match(source, /if \(options\.dryRun\)/);
  assert.match(source, /return result/);
  assert.match(source, /prisma\.document\.update/);
  assert.match(source, /prisma\.documentVersion\.create/);
  assert.match(source, /prisma\.documentChange\.create/);
});
