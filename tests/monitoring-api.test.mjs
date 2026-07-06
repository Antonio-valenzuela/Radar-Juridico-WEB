import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const documentsRoute = "app/api/monitoring/documents/route.ts";
const changesRoute = "app/api/monitoring/changes/route.ts";

test("APIs de monitoreo son solo lectura y no ejecutan el monitor", () => {
  for (const file of [documentsRoute, changesRoute]) {
    assert.ok(fs.existsSync(file), `missing ${file}`);
    const source = fs.readFileSync(file, "utf8");

    assert.match(source, /export\s+async\s+function\s+GET\b/);
    assert.doesNotMatch(source, /export\s+async\s+function\s+POST\b/);
    assert.doesNotMatch(source, /runLegalDocumentMonitor|monitor-legal-documents|worker|cron|BullMQ|Redis/i);
  }
});

test("APIs convierten BigInt a string antes de responder", () => {
  const source = `${fs.readFileSync(documentsRoute, "utf8")}\n${fs.readFileSync(changesRoute, "utf8")}`;

  assert.match(source, /fileSize:\s*[^,\n]*\.fileSize\?\.toString\(\)\s*\?\?\s*null/);
});

test("APIs no exponen texto completo ni diffs completos", () => {
  const source = `${fs.readFileSync(documentsRoute, "utf8")}\n${fs.readFileSync(changesRoute, "utf8")}`;

  assert.doesNotMatch(source, /rawText\s*:\s*true|originalText\s*:\s*true|before\s*:\s*true|after\s*:\s*true/);
  assert.doesNotMatch(source, /stack|trace|provider|fallback|Gemini|embeddings/i);
});
