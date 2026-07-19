import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

function evaluate(env) {
  const encoded = Buffer.from(JSON.stringify(env)).toString("base64url");
  const result = spawnSync(
    process.execPath,
    [
      "node_modules/tsx/dist/cli.mjs",
      "--eval",
      `import { getRuntimeEnvErrors } from "./lib/config/env";
       const env = JSON.parse(Buffer.from("${encoded}", "base64url").toString("utf8"));
       console.log(JSON.stringify(getRuntimeEnvErrors(env)));`,
    ],
    { encoding: "utf8", timeout: 15_000 },
  );

  if (result.status !== 0) throw new Error(result.stderr || "tsx execution failed");
  return JSON.parse(result.stdout.trim());
}

test("development keeps local defaults available", () => {
  assert.deepEqual(evaluate({ NODE_ENV: "development" }), []);
});

test("production rejects missing, unauthenticated, or placeholder secrets", () => {
  const errors = evaluate({
    NODE_ENV: "production",
    DATABASE_URL: "postgresql://app:apppass@postgres:5432/juridico",
    REDIS_URL: "redis://redis:6379",
    ADMIN_TOKEN: "dev-admin-token",
    NEXT_PUBLIC_APP_URL: "not-a-url",
  });

  assert.ok(errors.some((error) => error.includes("DATABASE_URL")));
  assert.ok(errors.some((error) => error.includes("REDIS_URL")));
  assert.ok(errors.some((error) => error.includes("ADMIN_TOKEN")));
  assert.ok(errors.some((error) => error.includes("NEXT_PUBLIC_APP_URL")));
});

test("production accepts authenticated service URLs and a strong admin token", () => {
  assert.deepEqual(
    evaluate({
      NODE_ENV: "production",
      DATABASE_URL: "postgresql://radar:correct-horse-battery@postgres:5432/radar",
      REDIS_URL: "redis://:correct-horse-cache@redis:6379/0",
      ADMIN_TOKEN: "0123456789abcdef0123456789abcdef",
      NEXT_PUBLIC_APP_URL: "https://radar.example.com",
    }),
    [],
  );
});
