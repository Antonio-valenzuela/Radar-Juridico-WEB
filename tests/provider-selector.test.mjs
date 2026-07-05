import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

function runTs(code) {
  const result = spawnSync(process.execPath, ["node_modules/tsx/dist/cli.mjs", "--eval", code], {
    encoding: "utf8",
    env: {
      ...process.env,
      NODE_ENV: "test",
      GEMINI_API_KEY: "mock-gemini-key",
      GROQ_API_KEY: "",
      OPENROUTER_API_KEY: "",
    },
  });

  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || result.error?.message || "tsx execution failed");
  }

  return JSON.parse(result.stdout.trim());
}

test("providerSelector elige el unico provider configurado (gemini)", () => {
  const result = runTs(`
    import { prisma } from "./lib/prisma";
    import { selectLeastUsedProvider } from "./lib/ai/providerSelector";
    (async () => {
      await prisma.aiProviderHealth.deleteMany().catch(() => {});
      await prisma.aiUsageEvent.deleteMany().catch(() => {});
      const selection = await selectLeastUsedProvider("general");
      console.log(JSON.stringify(selection));
    })().catch((error) => {
      console.error(error);
      process.exit(1);
    });
  `);

  assert.equal(result.provider, "gemini");
  assert.equal(result.strategy, "least-used");
});

test("providerSelector elige local si no hay api keys configuradas", () => {
  const result = spawnSync(process.execPath, ["node_modules/tsx/dist/cli.mjs", "--eval", `
    import { prisma } from "./lib/prisma";
    import { selectLeastUsedProvider } from "./lib/ai/providerSelector";
    (async () => {
      await prisma.aiProviderHealth.deleteMany().catch(() => {});
      await prisma.aiUsageEvent.deleteMany().catch(() => {});
      const selection = await selectLeastUsedProvider("general");
      console.log(JSON.stringify(selection));
    })().catch((error) => {
      console.error(error);
      process.exit(1);
    });
  `], {
    encoding: "utf8",
    env: {
      ...process.env,
      NODE_ENV: "test",
      GEMINI_API_KEY: "",
      GROQ_API_KEY: "",
      OPENROUTER_API_KEY: "",
    },
  });

  const parsed = JSON.parse(result.stdout.trim());
  assert.equal(parsed.provider, "local");
  assert.equal(parsed.strategy, "least-used");
});
