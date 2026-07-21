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

test("production images are reproducible multi-stage runtimes", () => {
  const dockerfile = fs.readFileSync("Dockerfile", "utf8");
  const nextConfig = fs.readFileSync("next.config.ts", "utf8");
  const dockerignore = fs.readFileSync(".dockerignore", "utf8");

  assert.match(dockerfile, /node:22-bookworm-slim/);
  assert.match(dockerfile, /FROM base AS deps/);
  assert.match(dockerfile, /FROM deps AS builder/);
  assert.match(dockerfile, /AS web-runtime/);
  assert.match(dockerfile, /AS worker-runtime/);
  assert.match(dockerfile, /AS migrate/);
  assert.match(dockerfile, /RUN npm ci/);
  assert.match(dockerfile, /USER node/);
  assert.doesNotMatch(dockerfile, /(?:CMD|ENTRYPOINT)[^\n]*npm install/i);
  assert.match(nextConfig, /output:\s*["']standalone["']/);

  for (const ignored of [".env*", "tests", "docs", ".codegraph", "node_modules", ".next"]) {
    assert.ok(dockerignore.split(/\r?\n/).some((line) => line.trim() === ignored));
  }
});

test("production compose keeps stateful services private and authenticated", () => {
  const compose = fs.readFileSync("docker-compose.prod.yml", "utf8");
  const postgres = compose.match(/\n  postgres:\n([\s\S]*?)(?=\n  [a-z][\w-]*:\n)/)?.[1] || "";
  const redis = compose.match(/\n  redis:\n([\s\S]*?)(?=\n  [a-z][\w-]*:\n)/)?.[1] || "";

  assert.doesNotMatch(postgres, /^\s+ports:/m);
  assert.doesNotMatch(redis, /^\s+ports:/m);
  assert.match(compose, /POSTGRES_PASSWORD:\s*["']?\$\{POSTGRES_PASSWORD:\?/);
  assert.match(compose, /REDIS_PASSWORD:\s*["']?\$\{REDIS_PASSWORD:\?/);
  assert.match(compose, /ADMIN_TOKEN:\s*["']?\$\{ADMIN_TOKEN:\?/);
  assert.match(redis, /requirepass/);
  assert.match(compose, /profiles:\s*\["migrate"\]/);
  assert.ok((compose.match(/healthcheck:/g) || []).length >= 7);
  assert.ok((compose.match(/restart: unless-stopped/g) || []).length >= 7);
  assert.doesNotMatch(compose, /npm install/);
});
