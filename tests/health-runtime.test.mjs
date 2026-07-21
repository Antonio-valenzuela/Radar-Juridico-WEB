import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { spawnSync } from "node:child_process";

test("process health server separates liveness from readiness", () => {
  const result = spawnSync(
    process.execPath,
    [
      "node_modules/tsx/dist/cli.mjs",
      "--eval",
      `import { once } from "node:events";
       import { createHealthServer, closeHealthServer } from "./lib/health/server";
       void (async () => {
         let ready = false;
         const server = createHealthServer({ name: "test-worker", readiness: async () => ({ ok: ready, checks: { dependency: ready } }) });
         server.listen(0, "127.0.0.1");
         await once(server, "listening");
         const address = server.address();
         const base = "http://127.0.0.1:" + address.port;
         const live = await fetch(base + "/health/live");
         const notReady = await fetch(base + "/health/ready");
         ready = true;
         const isReady = await fetch(base + "/health/ready");
         console.log(JSON.stringify({ live: live.status, notReady: notReady.status, ready: isReady.status }));
         await closeHealthServer(server);
       })();`,
    ],
    { encoding: "utf8", timeout: 15_000 },
  );

  if (result.status !== 0) throw new Error(result.stderr || "tsx execution failed");
  assert.deepEqual(JSON.parse(result.stdout.trim()), { live: 200, notReady: 503, ready: 200 });
});

test("web and background processes expose health and graceful shutdown hooks", () => {
  assert.equal(fs.existsSync("app/api/health/live/route.ts"), true);
  assert.equal(fs.existsSync("app/api/health/ready/route.ts"), true);

  for (const file of [
    "worker/ingestWorker.ts",
    "worker/legalReportWorker.ts",
  ]) {
    const source = fs.readFileSync(file, "utf8");
    assert.match(source, /startHealthServer/);
    assert.match(source, /SIGTERM/);
    assert.match(source, /SIGINT/);
    assert.match(source, /\$disconnect/);
  }

  const dashboard = fs.readFileSync("worker/dashboardWorker.ts", "utf8");
  assert.match(dashboard, /createHealthServer/);
  assert.match(dashboard, /new WebSocketServer\(\{ server:/);
  assert.match(dashboard, /SIGTERM/);
  assert.match(dashboard, /SIGINT/);
  assert.match(dashboard, /\$disconnect/);
});

test("dashboard websocket has a configurable public URL", () => {
  const page = fs.readFileSync("app/admin/dashboard/page.tsx", "utf8");
  const dockerfile = fs.readFileSync("Dockerfile", "utf8");
  const compose = fs.readFileSync("docker-compose.prod.yml", "utf8");

  assert.match(page, /NEXT_PUBLIC_WEBSOCKET_URL/);
  assert.match(dockerfile, /ARG NEXT_PUBLIC_WEBSOCKET_URL/);
  assert.match(compose, /NEXT_PUBLIC_WEBSOCKET_URL/);
});
