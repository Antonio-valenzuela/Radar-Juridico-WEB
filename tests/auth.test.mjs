import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

function runTs(code) {
  const result = spawnSync(process.execPath, ["node_modules/tsx/dist/cli.mjs", "--eval", code], {
    encoding: "utf8",
    timeout: 15000
  });
  if (result.status !== 0) throw new Error(result.stderr || "tsx execution failed");
  return JSON.parse(result.stdout.trim());
}

test("requireAdmin acepta dev-admin-token en desarrollo si no hay ADMIN_TOKEN", () => {
  const result = runTs(`
    import { requireAdmin } from "./lib/security/adminAuth";
    delete process.env.ADMIN_TOKEN;
    process.env.NODE_ENV = "development";
    const req = new Request("http://localhost", {
      headers: { "x-admin-token": "dev-admin-token" }
    });
    const auth = requireAdmin(req);
    console.log(JSON.stringify({ ok: auth.ok }));
  `);
  assert.equal(result.ok, true);
});

test("requireAdmin rechaza sin token", () => {
  const result = runTs(`
    import { requireAdmin } from "./lib/security/adminAuth";
    const req = new Request("http://localhost", {
      headers: {}
    });
    const auth = requireAdmin(req);
    console.log(JSON.stringify({ ok: auth.ok }));
  `);
  assert.equal(result.ok, false);
});
