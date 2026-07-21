import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

test("frontend Docker usa un puerto host configurable sin competir por 3000", () => {
  const compose = readFileSync("docker-compose.yml", "utf8");
  const envExample = readFileSync(".env.example", "utf8");
  const pkg = JSON.parse(readFileSync("package.json", "utf8"));

  assert.match(compose, /NEXT_PUBLIC_APP_URL:\s*\$\{NEXT_PUBLIC_APP_URL:-http:\/\/localhost:\$\{FRONTEND_PORT:-3100\}\}/);
  assert.match(compose, /-\s*"127\.0\.0\.1:\$\{FRONTEND_PORT:-3100\}:3000"/);
  assert.match(envExample, /^FRONTEND_PORT=3100$/m);
  assert.match(pkg.scripts.dev, /--port 3100$/);
});
