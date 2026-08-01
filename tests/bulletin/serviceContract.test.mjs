import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

test("servicio de boletín persiste evidencia y evita actuaciones/alertas duplicadas", () => {
  const service = fs.readFileSync("lib/bulletins/service.ts", "utf8");
  assert.match(service, /buildBulletinDedupeKey/);
  assert.match(service, /prisma\.\$transaction/);
  assert.match(service, /judicialBulletinEntry\.upsert/);
  assert.match(service, /matterBulletinEntry\.createMany/);
  assert.match(service, /skipDuplicates:\s*true/);
  assert.match(service, /dedupeKey: alertKey/);
  assert.match(service, /matterBulletinEntryId/);
  assert.doesNotMatch(service, /SOURCE_UNAVAILABLE[\s\S]{0,120}NOT_FOUND_AS_OF/);
});

test("migración de boletín es aditiva y conserva la evidencia", () => {
  const migration = fs.readFileSync("prisma/migrations/20260731120000_add_bulletin_monitoring/migration.sql", "utf8");
  assert.match(migration, /CREATE TABLE "CaseBulletinWatch"/);
  assert.match(migration, /CREATE TABLE "JudicialBulletinEntry"/);
  assert.match(migration, /CREATE TABLE "BulletinCheckRun"/);
  assert.match(migration, /contentHash/);
  assert.doesNotMatch(migration, /DROP TABLE|DELETE FROM/i);
});

test("migración de hardening conserva datos y traduce estados históricos", () => {
  const migration = fs.readFileSync("prisma/migrations/20260801030000_harden_bulletin_monitoring/migration.sql", "utf8");
  assert.match(migration, /CREATE TABLE "MatterBulletinEntry"/);
  assert.match(migration, /UPDATE "BulletinCheckRun"/);
  assert.match(migration, /"queryStatus"/);
  assert.match(migration, /"publicationStatus"/);
  assert.doesNotMatch(migration, /DROP TABLE|DELETE FROM|DROP COLUMN/i);
});
