import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { test } from "node:test";

test("portfolio baseline files exist", () => {
  assert.equal(existsSync("README.md"), true);
  assert.equal(existsSync(".env.example"), true);
  assert.equal(existsSync(".github/workflows/ci.yml"), true);
  assert.equal(existsSync("docs/adr/0001-modular-monolith-first.md"), true);
});

test("package exposes required scripts", () => {
  const pkg = JSON.parse(readFileSync("package.json", "utf8"));
  for (const script of ["dev", "build", "lint", "typecheck", "test", "db:migrate", "db:seed", "worker"]) {
    assert.equal(typeof pkg.scripts[script], "string", `${script} script is missing`);
  }
});

test("env example documents operational variables", () => {
  const env = readFileSync(".env.example", "utf8");
  for (const key of ["DATABASE_URL", "REDIS_URL", "NEXT_PUBLIC_APP_URL", "LLM_PROVIDER"]) {
    assert.match(env, new RegExp(`^${key}=`, "m"));
  }
});
