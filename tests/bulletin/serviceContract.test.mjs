import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

test("servicio de boletín persiste evidencia y evita actuaciones/alertas duplicadas", () => {
  const service = fs.readFileSync("lib/bulletins/service.ts", "utf8");
  assert.match(service, /buildBulletinDedupeKey/);
  assert.match(service, /findUnique\(\{\s*where: \{ dedupeKey/);
  assert.match(service, /if \(!actuation\)/);
  assert.match(service, /dedupeKey: alertKey/);
  assert.match(service, /result\.status/);
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
