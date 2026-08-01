import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const routePath = "app/api/admin/telemetry/route.ts";
const telemetryPath = "worker/telemetry.ts";
const dashboardWorkerPath = "worker/dashboardWorker.ts";
const dashboardPath = "app/admin/dashboard/page.tsx";

function read(path) {
  assert.equal(fs.existsSync(path), true, `${path} debe existir`);
  return fs.readFileSync(path, "utf8");
}

test("telemetría administrativa expone GET protegido y colector separado", () => {
  const route = read(routePath);
  const telemetry = read(telemetryPath);

  assert.match(route, /export\s+async\s+function\s+GET/);
  assert.match(route, /requireAdmin\s*\(/);
  assert.match(route, /x-admin-token/);
  assert.match(route, /collectTelemetry/);
  assert.match(telemetry, /dashboardClients/);
  assert.match(telemetry, /activeWorkers/);
  assert.match(telemetry, /jobs\s*:/);
});

test("GET de telemetría delega la autorización al token administrativo", () => {
  const route = read(routePath);

  assert.match(route, /requireAdmin\s*\(request\)/);
  assert.match(route, /if\s*\(!adminCheck\.ok\)/);
  assert.match(route, /return\s+adminCheck\.response/);
});

test("dashboard usa polling HTTP pausado en segundo plano y no WebSocket", () => {
  const page = read(dashboardPath);

  assert.doesNotMatch(page, /new\s+WebSocket\s*\(/);
  assert.match(page, /\/api\/admin\/telemetry/);
  assert.match(page, /15000/);
  assert.match(page, /AbortController/);
  assert.match(page, /visibilitychange/);
  assert.match(page, /Actualizar/);
});

test("estado de fuentes distingue nunca revisada y degradada", () => {
  const telemetry = read(telemetryPath);

  assert.match(telemetry, /never_checked/);
  assert.match(telemetry, /degraded/);
  assert.match(telemetry, /failed/);
  assert.match(telemetry, /lastCheckedAt/);
});

test("worker publica el snapshot con clientes dashboard y workers separados", () => {
  const worker = read(dashboardWorkerPath);

  assert.match(worker, /collectTelemetry/);
  assert.match(worker, /dashboardClients/);
});
