import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

function modelBlock(schema, modelName) {
  const start = schema.indexOf(`model ${modelName} {`);
  assert.notEqual(start, -1, `missing model ${modelName}`);
  const bodyStart = schema.indexOf("{", start) + 1;
  const bodyEnd = schema.indexOf("\n}", bodyStart);
  assert.notEqual(bodyEnd, -1, `unterminated model ${modelName}`);
  return schema.slice(bodyStart, bodyEnd);
}

test("Document agrega metadatos de monitoreo sin reutilizar status", () => {
  const schema = fs.readFileSync("prisma/schema.prisma", "utf8");
  const document = modelBlock(schema, "Document");
  const officialSource = modelBlock(schema, "OfficialSource");

  for (const field of [
    "shortCode",
    "matter",
    "officialSourceId",
    "officialUrl",
    "officialSourceUrl",
    "currentHash",
    "etag",
    "lastModified",
    "fileSize",
    "lastCheckedAt",
    "lastError",
    "monitoringStatus",
    "changeSummary",
  ]) {
    assert.match(document, new RegExp(`${field}\\s+`), `missing Document.${field}`);
  }

  assert.match(document, /monitoringStatus\s+String\?/);
  assert.match(document, /status\s+String\s+@default\("active"\)/);
  assert.doesNotMatch(document, /status\s+String\?.*unchanged|status\s+String\?.*blocked/s);
  assert.match(document, /officialSource\s+OfficialSource\?/);
  assert.match(officialSource, /documents\s+Document\[\]/);
});

test("DocumentVersion y DocumentChange guardan solo metadatos ligeros de monitoreo", () => {
  const schema = fs.readFileSync("prisma/schema.prisma", "utf8");
  const version = modelBlock(schema, "DocumentVersion");
  const change = modelBlock(schema, "DocumentChange");

  for (const field of ["etag", "lastModified", "fileSize", "sourceUrl", "metadata"]) {
    assert.match(version, new RegExp(`${field}\\s+`), `missing DocumentVersion.${field}`);
  }

  assert.match(version, /rawText\s+String\?/);
  assert.match(version, /originalText\s+String\?/);

  for (const field of [
    "sourceUrl",
    "detectedAt",
    "previousHash",
    "newHash",
    "priority",
    "reviewStatus",
    "matter",
    "jurisdiction",
  ]) {
    assert.match(change, new RegExp(`${field}\\s+`), `missing DocumentChange.${field}`);
  }

  assert.match(change, /before\s+String\?/);
  assert.match(change, /after\s+String\?/);
});

test("migracion de monitoreo legal es aditiva y no destructiva", () => {
  const migrationsDir = "prisma/migrations";
  const migration = fs
    .readdirSync(migrationsDir)
    .find((entry) => entry.includes("legal_change_monitoring_metadata"));

  assert.ok(migration, "missing legal_change_monitoring_metadata migration");

  const sql = fs.readFileSync(path.join(migrationsDir, migration, "migration.sql"), "utf8");
  assert.match(sql, /ALTER TABLE "Document"[\s\S]*ADD COLUMN "monitoringStatus"/);
  assert.match(sql, /ALTER TABLE "DocumentVersion"[\s\S]*ADD COLUMN "etag"/);
  assert.match(sql, /ALTER TABLE "DocumentChange"[\s\S]*ADD COLUMN "previousHash"/);
  assert.doesNotMatch(sql, /DROP\s+TABLE|DROP\s+COLUMN|TRUNCATE|DELETE\s+FROM|migrate\s+reset/i);
});
