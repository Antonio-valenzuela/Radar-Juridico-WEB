import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { spawnSync } from "node:child_process";

const protectedRoutes = [
  ["app/api/admin/backfill-summaries/route.ts", "POST"],
  ["app/api/admin/cleanup/route.ts", "POST"],
  ["app/api/admin/enrich-item/route.ts", "POST"],
  ["app/api/admin/enrich-missing-items/route.ts", "POST"],
  ["app/api/admin/evaluate-alerts/route.ts", "POST"],
  ["app/api/admin/reclassify/route.ts", "POST"],
  ["app/api/admin/refresh/route.ts", "POST"],
  ["app/api/admin/reindex-document/route.ts", "POST"],
  ["app/api/admin/run-weekly-digest/route.ts", "POST"],
  ["app/api/debug/source/route.ts", "GET"],
  ["app/api/ingest/route.ts", "POST"],
  ["app/api/ingest/all/route.ts", "POST"],
  ["app/api/ingest/dof/route.ts", "POST"],
  ["app/api/ingest/leyes/route.ts", "POST"],
  ["app/api/ingest/scjn/route.ts", "POST"],
  ["app/api/ingest/scjn-reformas/route.ts", "POST"],
  ["app/api/ingest/sidof/route.ts", "POST"],
  ["app/api/ingest/sidof-week/route.ts", "POST"],
  ["app/api/ingest/sjf/route.ts", "POST"],
  ["app/api/ingest/source/route.ts", "POST"],
  ["app/api/ingest/status/route.ts", "GET"],
  ["app/api/schedule/route.ts", "POST"],
  ["app/api/schedule-status/route.ts", "GET"],
  ["app/api/run-now/route.ts", "POST"],
  ["app/api/notify/run/route.ts", "POST"],
  ["app/api/notify/test/route.ts", "POST"],
  ["app/api/watchlist/route.ts", "POST"],
];

function invokeWithoutToken(file, method) {
  const modulePath = `./${file.replace(/\.ts$/, "")}`;
  const code = `
    (async () => {
      const imported = await import(${JSON.stringify(modulePath)});
      const route = imported.default ?? imported;
      const req = new Request("http://localhost/test", {
        method: ${JSON.stringify(method)},
        headers: { "content-type": "application/json" },
        body: ${JSON.stringify(method)} === "GET" ? undefined : "{}"
      });
      const handler = route[${JSON.stringify(method)}] ?? imported[${JSON.stringify(method)}];
      const response = await handler(req);
      console.log(JSON.stringify({ status: response.status }));
    })().catch((error) => {
      console.error(error);
      process.exit(1);
    });
  `;
  const result = spawnSync(process.execPath, ["node_modules/tsx/dist/cli.mjs", "--eval", code], {
    encoding: "utf8",
    timeout: 15000,
    env: { ...process.env, ADMIN_TOKEN: "test-admin-token", NODE_ENV: "test" },
  });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || "route invocation failed");
  return JSON.parse(result.stdout.trim());
}

for (const [file, method] of protectedRoutes) {
  test(`${file} ${method} rechaza requests sin token antes de ejecutar efectos`, () => {
    const content = fs.readFileSync(file, "utf8");
    assert.match(content, /requireAdmin\s*\(/, `${file} no aplica la política central`);
    assert.match(content, new RegExp(`export\\s+async\\s+function\\s+${method}\\b`));
    assert.equal(invokeWithoutToken(file, method).status, 401);
  });
}

test("/api/debug/token está desactivado y no referencia secretos", () => {
  const file = "app/api/debug/token/route.ts";
  const content = fs.readFileSync(file, "utf8");
  assert.doesNotMatch(content, /getExpectedAdminToken|ADMIN_TOKEN|expected\s*:/);
  assert.match(content, /status:\s*404/);
});

test("las rutas mutantes de mantenimiento e ingesta no exportan GET", () => {
  const mutatingRoutes = protectedRoutes
    .filter(([file, method]) => method === "POST" && (file.includes("/admin/") || file.includes("/ingest/")))
    .map(([file]) => file);

  for (const file of mutatingRoutes) {
    const content = fs.readFileSync(file, "utf8");
    assert.doesNotMatch(content, /export\s+async\s+function\s+GET\b/, file);
  }
});

test("resolveTenant no crea usuarios, organizaciones ni ownership", () => {
  const content = fs.readFileSync("lib/tenant.ts", "utf8");
  assert.doesNotMatch(content, /\.upsert\s*\(/);
  assert.doesNotMatch(content, /createIfMissing/);
  assert.doesNotMatch(content, /role:\s*["']owner["']/);
});
