# Production Readiness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convertir Jurídico Radar en un artefacto Docker reproducible y seguro, ejecutable tanto en Render como en un VPS, sin modificar el despliegue Render activo ni la funcionalidad jurídica.

**Architecture:** Se conserva el monolito modular Next.js y el Compose de desarrollo. Un Dockerfile multi-stage produce targets web, worker y migración; `docker-compose.prod.yml` conecta app, workers, WebSocket, PostgreSQL y Redis en redes internas con credenciales obligatorias y healthchecks. La configuración, readiness y cierre ordenado se centralizan en módulos reutilizables.

**Tech Stack:** Node.js 22 LTS, Next.js 16.2.10, React 19, TypeScript, Prisma 6, PostgreSQL 16/pgvector, Redis 7, BullMQ 5, Docker Compose, GitHub Actions.

---

## File map

- Create `.nvmrc`: versión única de Node.
- Modify `package.json`, `package-lock.json`: Next seguro, engine Node y runtime `tsx`.
- Modify `next.config.ts`: salida standalone.
- Create `lib/config/env.ts`: parseo y validación central de entorno.
- Create `lib/health/checks.ts`: liveness/readiness compartido.
- Create `lib/health/server.ts`: servidor HTTP de salud para procesos no Next.
- Create `app/api/health/live/route.ts`, `app/api/health/ready/route.ts`: endpoints diferenciados.
- Modify `app/api/health/route.ts`: compatibilidad con el contrato existente.
- Modify `worker/ingestWorker.ts`, `worker/legalReportWorker.ts`, `worker/dashboardWorker.ts`: salud y cierre ordenado.
- Modify `lib/security/urlValidation.ts`: retirar bypass TLS no utilizado.
- Create `Dockerfile`, `docker-compose.prod.yml`: imágenes y topología de producción.
- Modify `.dockerignore`, `.gitignore`, `.env.example`: exclusiones y configuración documentada.
- Modify `.github/workflows/ci.yml`: pipeline bloqueante y reproducible.
- Create `tests/production-readiness.test.mjs`, `tests/env-config.test.mjs`, `tests/health.test.mjs`: contratos de producción.
- Create `docs/DEPLOYMENT.md`, `docs/Caddyfile.example`: operación y proxy HTTPS.

### Task 1: Baseline, branch safety and dependency/runtime alignment

**Files:**
- Create: `.nvmrc`
- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `tests/production-readiness.test.mjs`

- [ ] **Step 1: Record baseline and preserve the existing test change**

Run:

```powershell
git status --short
git diff -- tests/ai-usage.test.mjs
node --version
npm --version
```

Expected: branch `codex/production-readiness-20260719`; only the previously reviewed date-isolation change in `tests/ai-usage.test.mjs`, plus plan/index files.

- [ ] **Step 2: Write the failing runtime/dependency contract test**

Add assertions to `tests/production-readiness.test.mjs`:

```js
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

test("production runtime is pinned and Next is patched", () => {
  const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
  assert.equal(pkg.engines.node, "22.x");
  assert.equal(pkg.dependencies.next, "16.2.10");
  assert.equal(pkg.devDependencies["eslint-config-next"], "16.2.10");
  assert.equal(fs.readFileSync(".nvmrc", "utf8").trim(), "22");
});
```

- [ ] **Step 3: Run the contract test and confirm RED**

Run: `node --test tests/production-readiness.test.mjs`

Expected: FAIL because `engines`, `.nvmrc` and Next 16.2.10 do not exist yet.

- [ ] **Step 4: Apply the minimal dependency changes**

Set:

```json
{
  "engines": { "node": "22.x" },
  "dependencies": {
    "next": "16.2.10",
    "tsx": "^4.21.0"
  },
  "devDependencies": {
    "eslint-config-next": "16.2.10"
  }
}
```

Remove `tsx` from `devDependencies`, create `.nvmrc` containing `22`, then run `npm install` to regenerate the lockfile.

- [ ] **Step 5: Verify GREEN and audit dependencies**

Run:

```powershell
node --test tests/production-readiness.test.mjs
npm audit --omit=dev
```

Expected: runtime test PASS; zero high/critical vulnerabilities.

- [ ] **Step 6: Commit**

```powershell
git add .nvmrc package.json package-lock.json tests/production-readiness.test.mjs
git commit -m "build: align secure Node and Next versions"
```

### Task 2: Centralized environment contract

**Files:**
- Create: `lib/config/env.ts`
- Create: `tests/env-config.test.mjs`
- Modify: `.env.example`
- Modify: `.gitignore`

- [ ] **Step 1: Write failing environment tests**

Use `tsx --eval` from `tests/env-config.test.mjs` to assert:

```js
test("production config rejects missing infrastructure secrets", () => {
  const result = runTs(`
    import { validateProductionEnv } from "./lib/config/env";
    try {
      validateProductionEnv({ NODE_ENV: "production" });
    } catch (error) {
      console.log(JSON.stringify({ message: String(error) }));
    }
  `);
  assert.match(result.message, /DATABASE_URL/);
  assert.match(result.message, /REDIS_URL/);
  assert.match(result.message, /ADMIN_TOKEN/);
});
```

Also assert every key extracted by `scripts/env_extract.py` exists in `.env.example`, and no server secret is referenced from a file containing `"use client"`.

- [ ] **Step 2: Run tests and confirm RED**

Run: `node --test tests/env-config.test.mjs`

Expected: FAIL because `lib/config/env.ts` is absent and `.env.example` lacks keys.

- [ ] **Step 3: Implement focused environment validation**

Create `lib/config/env.ts` with:

```ts
type EnvSource = Record<string, string | undefined>;

const requiredProduction = ["DATABASE_URL", "REDIS_URL", "ADMIN_TOKEN"] as const;

export function validateProductionEnv(env: EnvSource = process.env) {
  if (env.NODE_ENV !== "production") return;
  const missing = requiredProduction.filter((key) => !env[key]?.trim());
  if (missing.length) {
    throw new Error(`Missing required production environment variables: ${missing.join(", ")}`);
  }
  if (!env.REDIS_URL?.match(/^rediss?:\/\/[^:@/]+:[^@/]+@/)) {
    throw new Error("REDIS_URL must include authentication in production");
  }
}

export function integerEnv(env: EnvSource, key: string, fallback: number, min = 1) {
  const parsed = Number(env[key]);
  return Number.isFinite(parsed) && parsed >= min ? parsed : fallback;
}
```

Invoke `validateProductionEnv()` only in server entrypoints and worker startup, never in client modules.

- [ ] **Step 4: Rebuild `.env.example` safely**

Document all extracted keys with blank placeholders for secrets and safe examples for non-secrets. Include the 14 missing keys, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, `REDIS_PASSWORD`, health ports and production host ports. Do not include a real value from `.env` or `.env.production`.

- [ ] **Step 5: Verify and commit**

Run: `node --test tests/env-config.test.mjs tests/production-readiness.test.mjs`

Expected: PASS.

```powershell
git add lib/config/env.ts tests/env-config.test.mjs .env.example .gitignore
git commit -m "feat: validate production environment safely"
```

### Task 3: Remove global TLS bypass while preserving SSRF defenses

**Files:**
- Modify: `lib/security/urlValidation.ts`
- Modify: `tests/source-health.test.mjs`
- Modify: `tests/production-readiness.test.mjs`

- [ ] **Step 1: Add the failing static security contract**

```js
test("source health never disables TLS globally", () => {
  const files = ["lib/security/urlValidation.ts", "lib/sources/sourceHealth.ts"];
  for (const file of files) {
    const source = fs.readFileSync(file, "utf8");
    assert.doesNotMatch(source, /NODE_TLS_REJECT_UNAUTHORIZED\s*=\s*["']0["']/);
    assert.doesNotMatch(source, /rejectUnauthorized\s*:\s*false/);
  }
});
```

- [ ] **Step 2: Confirm RED**

Run: `node --test tests/production-readiness.test.mjs tests/source-health.test.mjs`

Expected: FAIL on `urlValidation.ts`.

- [ ] **Step 3: Remove the unused unsafe function**

Use CodeGraph impact for `testOfficialSourceConnection`, confirm zero callers, and delete only that export and its private helpers if exclusively owned by it. Preserve `validateUrlSafety`, private-IP checks, DNS resolution and redirect validation. Keep `checkSourceHealth` as the route-handler implementation.

- [ ] **Step 4: Verify source-health and SSRF tests**

Run: `node --test tests/production-readiness.test.mjs tests/source-health.test.mjs tests/security.test.mjs`

Expected: PASS with invalid certificates represented as degraded/error results.

- [ ] **Step 5: Commit**

```powershell
git add lib/security/urlValidation.ts tests/source-health.test.mjs tests/production-readiness.test.mjs
git commit -m "security: remove global TLS bypass"
```

### Task 4: Liveness, readiness and graceful shutdown

**Files:**
- Create: `lib/health/checks.ts`
- Create: `lib/health/server.ts`
- Create: `app/api/health/live/route.ts`
- Create: `app/api/health/ready/route.ts`
- Modify: `app/api/health/route.ts`
- Modify: `worker/ingestWorker.ts`
- Modify: `worker/legalReportWorker.ts`
- Modify: `worker/dashboardWorker.ts`
- Create: `tests/health.test.mjs`

- [ ] **Step 1: Write failing health contract tests**

Test that liveness does not touch dependencies, readiness reports DB/Redis separately, worker health returns 503 when a dependency fails, and each worker registers `SIGTERM` and closes its resources.

```js
test("readiness distinguishes database and Redis failures", async () => {
  const result = await checkReadiness({
    db: async () => { throw new Error("db unavailable"); },
    redis: async () => "PONG",
  });
  assert.equal(result.ok, false);
  assert.equal(result.db.ok, false);
  assert.equal(result.redis.ok, true);
});
```

- [ ] **Step 2: Confirm RED**

Run: `node --test tests/health.test.mjs`

Expected: FAIL because shared health modules and endpoints do not exist.

- [ ] **Step 3: Implement shared checks and HTTP server**

`checkReadiness` accepts injectable DB/Redis probes. `startHealthServer({ port, check })` serves `/health/live` with 200 and `/health/ready` with 200/503 JSON. It returns an async `close()` function.

- [ ] **Step 4: Integrate Next endpoints and workers**

Keep `/api/health` response fields. Add `/api/health/live` and `/api/health/ready`. Start health servers on distinct env-configured ports for ingest and legal-report workers. Refactor `dashboardWorker` to `createServer()` plus `WebSocketServer({ server })`, serving HTTP health on port 3002. Register idempotent shutdown handlers.

- [ ] **Step 5: Verify and commit**

Run: `node --test tests/health.test.mjs tests/docker-runtime.test.mjs`

Expected: PASS.

```powershell
git add lib/health app/api/health worker tests/health.test.mjs
git commit -m "feat: add production health and shutdown contracts"
```

### Task 5: Multi-stage production images

**Files:**
- Create: `Dockerfile`
- Modify: `next.config.ts`
- Modify: `.dockerignore`
- Modify: `tests/production-readiness.test.mjs`

- [ ] **Step 1: Add failing Dockerfile assertions**

Assert the Dockerfile contains Node 22, multiple stages, `npm ci`, a non-root `USER`, web/worker/migrate targets and no runtime `npm install` command. Assert `.dockerignore` excludes `.env*`, tests, docs, `.git`, `.codegraph`, logs and build caches while allowing `.env.example` exclusion explicitly.

- [ ] **Step 2: Confirm RED**

Run: `node --test tests/production-readiness.test.mjs`

Expected: FAIL because Dockerfile is absent.

- [ ] **Step 3: Implement Docker targets**

Use `node:22-bookworm-slim`; install system packages only in the stage that needs them; run `npm ci`, `prisma generate`, and `npm run build` during build. Configure `output: "standalone"`. Copy the minimal Next runtime into `web-runtime`, and production dependencies plus worker/server code into `worker-runtime`. Run both as the built-in `node` user. The `migrate` target contains Prisma CLI and executes `prisma migrate deploy` only when explicitly invoked.

- [ ] **Step 4: Build all targets**

Run:

```powershell
docker build --target web-runtime -t juridico-radar:web-test .
docker build --target worker-runtime -t juridico-radar:worker-test .
docker build --target migrate -t juridico-radar:migrate-test .
```

Expected: all builds exit 0; image history contains no `.env` files.

- [ ] **Step 5: Commit**

```powershell
git add Dockerfile next.config.ts .dockerignore tests/production-readiness.test.mjs
git commit -m "build: add reproducible production images"
```

### Task 6: Secure production Compose topology

**Files:**
- Create: `docker-compose.prod.yml`
- Modify: `tests/production-readiness.test.mjs`

- [ ] **Step 1: Add failing Compose security tests**

Parse `docker compose -f docker-compose.prod.yml config --format json` and assert PostgreSQL/Redis have no published ports, Redis requires a password, app services wait for healthy dependencies, no source bind mounts exist, restart policies are defined and healthchecks exist for every long-running service.

- [ ] **Step 2: Confirm RED**

Run: `node --test tests/production-readiness.test.mjs`

Expected: FAIL because production Compose is absent.

- [ ] **Step 3: Implement production Compose**

Use mandatory interpolation `${POSTGRES_PASSWORD:?required}`, `${REDIS_PASSWORD:?required}` and `${ADMIN_TOKEN:?required}`. Configure Redis command and healthcheck with authentication. Keep DB/Redis only on internal networks, named volumes, health-conditioned dependencies, `restart: unless-stopped`, read-only/rootfs or tmpfs where compatible, and explicit resource-safe stop periods. Publish frontend only on `${APP_BIND_ADDRESS:-127.0.0.1}:${APP_PORT:-3100}:3000`.

- [ ] **Step 4: Validate effective config**

Provide temporary non-secret test placeholders only in the process environment and run:

```powershell
docker compose -f docker-compose.prod.yml config --quiet
docker compose -f docker-compose.prod.yml config --format json
```

Expected: valid config; published ports contain only frontend loopback.

- [ ] **Step 5: Commit**

```powershell
git add docker-compose.prod.yml tests/production-readiness.test.mjs
git commit -m "feat: add secure production Compose stack"
```

### Task 7: Blocking CI with isolated services

**Files:**
- Modify: `.github/workflows/ci.yml`
- Modify: `tests/production-readiness.test.mjs`

- [ ] **Step 1: Add failing CI assertions**

Assert Node 22, Actions v4, `npm ci`, Prisma migrate deploy, typecheck, lint without `|| true`, tests, build, audit, Compose config, concurrency cancellation and job timeout.

- [ ] **Step 2: Confirm RED**

Run: `node --test tests/production-readiness.test.mjs`

Expected: FAIL on current workflow.

- [ ] **Step 3: Rewrite CI safely**

Use ephemeral CI-only credentials, authenticated Redis, pgvector PostgreSQL, service healthchecks and `DATABASE_URL`/`REDIS_URL` scoped to the job. Apply committed migrations with `npx prisma migrate deploy`; never call reset. Run `npm run typecheck`, `npm run lint -- --max-warnings=500`, `npm test`, `npm run build`, `npm audit --omit=dev --audit-level=high`, and production Compose validation.

- [ ] **Step 4: Verify and commit**

Run: `node --test tests/production-readiness.test.mjs`

Expected: PASS.

```powershell
git add .github/workflows/ci.yml tests/production-readiness.test.mjs
git commit -m "ci: enforce production verification gates"
```

### Task 8: Production operations documentation

**Files:**
- Create: `docs/DEPLOYMENT.md`
- Create: `docs/Caddyfile.example`

- [ ] **Step 1: Write documentation contract assertions**

Assert the guide contains Render, VPS, migration, health, logs, backup, restore, upgrade, rollback, workers, HTTPS, SSH tunnel and secret verification commands.

- [ ] **Step 2: Write exact operations guide**

Document development commands, Render Docker target/commands without initiating a deployment, VPS `.env.production` creation, `docker compose build`, explicit migrate profile, `up -d`, health probes, `pg_dump`, `pg_restore`, image-tag rollback and Caddy reverse proxy configuration.

- [ ] **Step 3: Verify and commit**

Run: `node --test tests/production-readiness.test.mjs`

Expected: PASS.

```powershell
git add docs/DEPLOYMENT.md docs/Caddyfile.example tests/production-readiness.test.mjs
git commit -m "docs: add Render and VPS operations guide"
```

### Task 9: Full security and functional validation

**Files:**
- Modify only when a failing test proves a production-readiness regression.

- [ ] **Step 1: Start isolated infrastructure**

Confirm Docker availability. Start only production PostgreSQL and Redis with explicit test-only environment values, wait for health, run the explicit migrate service against the isolated named volume and never point at Render.

- [ ] **Step 2: Run the full verification matrix**

```powershell
npm ci
npm audit --omit=dev --audit-level=high
npx prisma generate
npm run typecheck
npm run lint
npm test
npm run build
python C:\Users\yahir\.codex\skills\all-deploy\scripts\audit.py C:\Users\yahir\juridico-radar
```

Expected: build/typecheck/tests exit 0; lint has zero errors with warning counts recorded; all-deploy has no critical findings after intentional Git-worktree handling is accounted for.

- [ ] **Step 3: Start complete production stack and probe it**

Run Compose locally with test credentials, wait for all healthchecks, probe frontend, API readiness, worker health endpoints, WebSocket HTTP readiness, PostgreSQL `SELECT 1`, authenticated Redis `PING`, and inspect published ports. Verify only frontend loopback is published.

- [ ] **Step 4: Scan dependencies, source, history and images**

Run available Gitleaks/TruffleHog or equivalent against current files and Git history, suppressing secret values. Inspect Docker image file lists and histories for `.env`, logs, tests, docs and source maps containing server configuration.

- [ ] **Step 5: Re-verify live functionality locally**

Use browser/HTTP checks for `/`, `/legal-hub`, `/search`, `/documents`, `/monitoreo`, `/rag`, `/watchlists`, `/api/health`, `/api/health/live`, `/api/health/ready`, and representative non-destructive API GET routes. Confirm workers start and external-source degradation does not fail readiness.

- [ ] **Step 6: Review final diff and commit any evidence-safe corrections**

Run:

```powershell
git diff --check
git status --short
git diff --stat main...HEAD
git diff -- tests/ai-usage.test.mjs
```

Expected: no whitespace errors; the prior test change remains or its technical correction is explicitly justified.
