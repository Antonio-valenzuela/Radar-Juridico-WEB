import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

test("ESLint's minimatch version accepts the patched brace-expansion API", () => {
  const minimatch = require("minimatch");

  assert.equal(minimatch("app/page.tsx", "**/*.{ts,tsx}"), true);
});
