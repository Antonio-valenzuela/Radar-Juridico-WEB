import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

test("official source checks never disable TLS globally", () => {
  const urlValidation = fs.readFileSync("lib/security/urlValidation.ts", "utf8");
  const sourceHealthRoute = fs.readFileSync("app/api/admin/source-test/route.ts", "utf8");

  assert.doesNotMatch(urlValidation, /NODE_TLS_REJECT_UNAUTHORIZED/);
  assert.match(sourceHealthRoute, /checkSourceHealth/);
});

test("state-changing item and alert endpoints require administrator authorization", () => {
  const itemsRoute = fs.readFileSync("app/api/items/route.ts", "utf8");
  const overrideRoute = fs.readFileSync(
    "app/api/items/[id]/norma-override/route.ts",
    "utf8",
  );
  const alertsRoute = fs.readFileSync("app/api/alerts/route.ts", "utf8");

  for (const source of [itemsRoute, overrideRoute, alertsRoute]) {
    assert.match(source, /requireAdmin/);
  }
  assert.doesNotMatch(alertsRoute, /searchParams\.get\(["']email["']\)/);
});

test("browser responses use baseline security headers and hide framework branding", () => {
  const config = fs.readFileSync("next.config.ts", "utf8");

  assert.match(config, /poweredByHeader:\s*false/);
  for (const header of [
    "Content-Security-Policy",
    "Strict-Transport-Security",
    "X-Content-Type-Options",
    "X-Frame-Options",
    "Referrer-Policy",
    "Permissions-Policy",
  ]) {
    assert.match(config, new RegExp(header));
  }
});

test("the production web process validates its environment during startup", () => {
  const dockerfile = fs.readFileSync("Dockerfile", "utf8");

  assert.match(dockerfile, /runtime-env-check\.mjs/);
  assert.match(dockerfile, /node runtime-env-check\.mjs && exec node server\.js/);
});

test("AI report printing escapes model-controlled HTML", () => {
  const chat = fs.readFileSync("components/ai/FloatingLegalChat.tsx", "utf8");

  assert.match(chat, /escapeHtml/);
  assert.match(chat, /new Blob/);
  assert.match(chat, /URL\.createObjectURL/);
  assert.match(chat, /URL\.revokeObjectURL/);
  assert.match(chat, /noopener,noreferrer/);
  assert.doesNotMatch(chat, /printWindow\.document\.write/);
  assert.doesNotMatch(chat, />\$\{content\}<\/div>/);
});

test("dashboard WebSocket authenticates clients, validates origin and caps connections", () => {
  const worker = fs.readFileSync("worker/dashboardWorker.ts", "utf8");
  const page = fs.readFileSync("app/admin/dashboard/page.tsx", "utf8");

  assert.match(worker, /verifyClient/);
  assert.match(worker, /getExpectedAdminToken/);
  assert.match(worker, /DASHBOARD_MAX_CLIENTS/);
  assert.match(worker, /NEXT_PUBLIC_APP_URL/);
  assert.match(page, /juridico_admin_token/);
  assert.match(page, /auth\./);
});

test("CI pins third-party actions and audits all locked dependencies", () => {
  const workflow = fs.readFileSync(".github/workflows/ci.yml", "utf8");

  assert.match(workflow, /actions\/checkout@[a-f0-9]{40}/);
  assert.match(workflow, /actions\/setup-node@[a-f0-9]{40}/);
  assert.match(workflow, /npm ci --ignore-scripts/);
  assert.match(workflow, /npm audit(?:\s|$)/m);
});

test("public health responses do not expose dependency exception messages", () => {
  const checks = fs.readFileSync("lib/health/checks.ts", "utf8");
  const server = fs.readFileSync("lib/health/server.ts", "utf8");
  const route = fs.readFileSync("app/api/health/route.ts", "utf8");

  for (const source of [checks, server, route]) {
    assert.doesNotMatch(source, /error instanceof Error \? error\.message : String\(error\)/);
  }
});

test("user-controlled downloads pin validated DNS and enforce streamed byte limits", () => {
  const validation = fs.readFileSync("lib/security/urlValidation.ts", "utf8");
  const manual = fs.readFileSync("lib/ingest/manualUrl.ts", "utf8");
  const worker = fs.readFileSync("worker/documentIngestProcessor.ts", "utf8");

  assert.match(validation, /fetchPinnedPublicHttpUrl/);
  assert.match(validation, /dispatcher/);
  assert.match(validation, /all:\s*true/);
  for (const source of [manual, worker]) {
    assert.match(source, /fetchPinnedPublicHttpUrl/);
    assert.match(source, /readResponseBodyWithLimit/);
  }

  assert.doesNotMatch(validation, /testOfficialSourceConnection/);
  assert.doesNotMatch(validation, /await fetch\(/);
  assert.match(manual, /finally\s*\{[\s\S]*clearTimeout\(timer\)/);
  assert.match(worker, /finally\s*\{[\s\S]*clearTimeout\(timerId\)/);
});
