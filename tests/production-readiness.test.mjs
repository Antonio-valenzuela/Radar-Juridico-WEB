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
  const productionStart = fs.readFileSync("scripts/start-prod.sh", "utf8");

  assert.match(dockerfile, /node:22-bookworm-slim/);
  assert.match(dockerfile, /FROM base AS deps/);
  assert.match(dockerfile, /FROM deps AS builder/);
  assert.match(dockerfile, /AS web-runtime/);
  assert.match(dockerfile, /AS worker-runtime/);
  assert.match(dockerfile, /AS migrate/);
  assert.match(dockerfile, /FROM web-runtime AS production\s*$/);
  assert.match(dockerfile, /RUN npm ci/);
  assert.match(dockerfile, /USER node/);
  assert.doesNotMatch(dockerfile, /(?:CMD|ENTRYPOINT)[^\n]*npm install/i);
  assert.doesNotMatch(productionStart, /(?:npm install|prisma migrate|next build)/i);
  assert.match(productionStart, /exec npm run start/);
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

test("CI uses Node 22 and never suppresses lint failures", () => {
  const ci = fs.readFileSync(".github/workflows/ci.yml", "utf8");

  assert.match(ci, /actions\/checkout@v4/);
  assert.match(ci, /actions\/setup-node@v4/);
  assert.match(ci, /node-version:\s*["']?22["']?/);
  assert.doesNotMatch(ci, /npm run lint\s*\|\|\s*true/);
  assert.match(ci, /npm run typecheck/);
  assert.match(ci, /npm run db:migrate/);
  assert.match(ci, /npm audit --omit=dev/);
  assert.match(ci, /docker compose -f docker-compose\.prod\.yml config --quiet/);
  assert.match(ci, /requirepass|CONFIG SET requirepass/);
  assert.doesNotMatch(ci, /POSTGRES_PASSWORD:\s*apppass/);
});

test("operations guide covers portable Render and VPS lifecycle", () => {
  const guide = fs.readFileSync("docs/DEPLOYMENT.md", "utf8");
  const caddy = fs.readFileSync("docs/Caddyfile.example", "utf8");

  for (const topic of [
    "Render",
    "VPS",
    "migrate",
    "health/ready",
    "logs",
    "pg_dump",
    "pg_restore",
    "rollback",
    "worker",
    "HTTPS",
    "SSH",
    "secret",
  ]) {
    assert.ok(guide.toLowerCase().includes(topic.toLowerCase()), `missing deployment topic: ${topic}`);
  }

  assert.match(caddy, /reverse_proxy/);
  assert.match(caddy, /localhost:3000/);
});
