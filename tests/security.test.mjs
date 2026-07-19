import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

test("official source checks never disable TLS globally", () => {
  const urlValidation = fs.readFileSync("lib/security/urlValidation.ts", "utf8");
  const sourceHealthRoute = fs.readFileSync("app/api/admin/source-test/route.ts", "utf8");

  assert.doesNotMatch(urlValidation, /NODE_TLS_REJECT_UNAUTHORIZED/);
  assert.match(sourceHealthRoute, /checkSourceHealth/);
});
