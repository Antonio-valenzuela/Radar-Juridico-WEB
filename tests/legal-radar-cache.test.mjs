import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

test("legal-radar no importa cacheConnection desde queue para evitar warnings de compilación", () => {
  const content = fs.readFileSync("lib/legal-radar.ts", "utf8");

  assert.doesNotMatch(content, /from ["']@\/lib\/queue["']/);
  assert.match(content, /cacheConnection/);
});
