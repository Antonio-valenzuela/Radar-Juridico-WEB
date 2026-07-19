import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

test("production runtime is pinned and Next is patched", () => {
  const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));

  assert.equal(pkg.engines?.node, "22.x");
  assert.equal(pkg.dependencies.next, "16.2.10");
  assert.equal(pkg.devDependencies["eslint-config-next"], "16.2.10");
  assert.equal(pkg.overrides.next.postcss, "8.5.10");
  assert.equal(pkg.dependencies.tsx, "^4.21.0");
  assert.equal(pkg.devDependencies.tsx, undefined);
  assert.equal(fs.readFileSync(".nvmrc", "utf8").trim(), "22");
});
