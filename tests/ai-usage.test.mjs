import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";

function runTs(code, env = {}) {
  const result = spawnSync(process.execPath, ["node_modules/tsx/dist/cli.mjs", "--eval", code], {
    encoding: "utf8",
    env: {
      ...process.env,
      NODE_ENV: "test",
      AI_ENABLE_USAGE_TRACKING: "true",
      ...env,
    },
  });

  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || result.error?.message || "tsx execution failed");
  }

  return JSON.parse(result.stdout.trim());
}

test("router unificado registra consumo real en DB y hace fallback", async () => {
  const result = runTs(`
    import { routeLlmCompletion } from "./lib/ai/router";
    import { prisma } from "./lib/prisma";

    (async () => {
      // Clear logs first
      await prisma.aiUsageLog.deleteMany();

      // Mock fetch
      const originalFetch = globalThis.fetch;
      globalThis.fetch = async (url, options) => {
        if (url.includes("googleapis.com")) {
          return {
            ok: true,
            status: 200,
            text: async () => JSON.stringify({
              candidates: [{ content: { parts: [{ text: "gemini response" }] } }],
              usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 5, totalTokenCount: 15 }
            }),
            headers: new Map()
          };
        }
        return { ok: false, status: 500, text: async () => "error" };
      };

      process.env.AI_PROVIDER_CHAIN = "gemini,groq,local";
      process.env.GEMINI_API_KEY = "mock-key";
      
      const res = await routeLlmCompletion("test prompt", "rag_answer", "req-1");
      const dbLogs = await prisma.aiUsageLog.findMany({ where: { requestId: "req-1" } });

      globalThis.fetch = originalFetch;

      console.log(JSON.stringify({ res, dbLogs }));
    })().catch((err) => {
      console.error(err);
      process.exit(1);
    });
  `);

  assert.equal(result.res.provider, "gemini");
  assert.equal(result.dbLogs.length, 1);
  assert.equal(result.dbLogs[0].provider, "gemini");
  assert.equal(result.dbLogs[0].status, "success");
  assert.equal(result.dbLogs[0].totalTokens, 15);
});

test("si Gemini falla, hace fallback a Groq y registra ambos", async () => {
  const result = runTs(`
    import { routeLlmCompletion } from "./lib/ai/router";
    import { prisma } from "./lib/prisma";

    (async () => {
      await prisma.aiUsageLog.deleteMany();

      const originalFetch = globalThis.fetch;
      globalThis.fetch = async (url, options) => {
        if (url.includes("googleapis.com")) {
          return {
            ok: false,
            status: 429,
            text: async () => "Rate limit exceeded",
            headers: new Map()
          };
        }
        if (url.includes("groq.com")) {
          const headers = new Map();
          headers.set("x-ratelimit-limit-requests", "100");
          headers.set("x-ratelimit-remaining-requests", "99");
          headers.set("x-ratelimit-reset-requests", "1s");
          return {
            ok: true,
            status: 200,
            text: async () => JSON.stringify({
              choices: [{ message: { content: "groq response" } }],
              usage: { prompt_tokens: 20, completion_tokens: 10, total_tokens: 30 }
            }),
            headers
          };
        }
        return { ok: false, status: 500, text: async () => "error" };
      };

      process.env.AI_PROVIDER_CHAIN = "gemini,groq,local";
      process.env.GEMINI_API_KEY = "mock-key";
      process.env.GROQ_API_KEY = "mock-key";

      const res = await routeLlmCompletion("test prompt", "rag_answer", "req-2");
      const dbLogs = await prisma.aiUsageLog.findMany({ where: { requestId: "req-2" }, orderBy: { createdAt: "asc" } });

      globalThis.fetch = originalFetch;

      console.log(JSON.stringify({ res, dbLogs }));
    })().catch((err) => {
      console.error(err);
      process.exit(1);
    });
  `);

  assert.equal(result.res.provider, "groq");
  assert.equal(result.dbLogs.length, 2);
  assert.equal(result.dbLogs[0].provider, "gemini");
  assert.equal(result.dbLogs[0].status, "failed");
  assert.equal(result.dbLogs[0].reasonCategory, "rate_limited");
  assert.equal(result.dbLogs[1].provider, "groq");
  assert.equal(result.dbLogs[1].status, "success");
  assert.equal(result.dbLogs[1].rateLimitRemaining, 99);
});

test("si Gemini y Groq fallan, hace fallback a OpenRouter y registra los tres", async () => {
  const result = runTs(`
    import { routeLlmCompletion } from "./lib/ai/router";
    import { prisma } from "./lib/prisma";

    (async () => {
      await prisma.aiUsageLog.deleteMany();

      const originalFetch = globalThis.fetch;
      globalThis.fetch = async (url, options) => {
        if (url.includes("googleapis.com")) {
          return {
            ok: false,
            status: 429,
            text: async () => "Quota exceeded",
            headers: new Map()
          };
        }
        if (url.includes("groq.com")) {
          return {
            ok: false,
            status: 402,
            text: async () => "Insufficient credits",
            headers: new Map()
          };
        }
        if (url.includes("openrouter.ai")) {
          return {
            ok: true,
            status: 200,
            text: async () => JSON.stringify({
              choices: [{ message: { content: "openrouter response" } }],
              usage: { prompt_tokens: 15, completion_tokens: 15, total_tokens: 30 }
            }),
            headers: new Map()
          };
        }
        return { ok: false, status: 500, text: async () => "error" };
      };

      process.env.AI_PROVIDER_CHAIN = "gemini,groq,openrouter,local";
      process.env.GEMINI_API_KEY = "mock-key";
      process.env.GROQ_API_KEY = "mock-key";
      process.env.OPENROUTER_API_KEY = "mock-key";

      const res = await routeLlmCompletion("test prompt", "rag_answer", "req-3");
      const dbLogs = await prisma.aiUsageLog.findMany({ where: { requestId: "req-3" }, orderBy: { createdAt: "asc" } });

      globalThis.fetch = originalFetch;

      console.log(JSON.stringify({ res, dbLogs }));
    })().catch((err) => {
      console.error(err);
      process.exit(1);
    });
  `);

  assert.equal(result.res.provider, "openrouter");
  assert.equal(result.dbLogs.length, 3);
  assert.equal(result.dbLogs[0].provider, "gemini");
  assert.equal(result.dbLogs[0].reasonCategory, "quota_exceeded");
  assert.equal(result.dbLogs[1].provider, "groq");
  assert.equal(result.dbLogs[1].reasonCategory, "insufficient_credits");
  assert.equal(result.dbLogs[2].provider, "openrouter");
  assert.equal(result.dbLogs[2].status, "success");
});

test("si todos los externos fallan, local responde y se registra fallback local", async () => {
  const result = runTs(`
    import { routeLlmCompletion } from "./lib/ai/router";
    import { prisma } from "./lib/prisma";

    (async () => {
      await prisma.aiUsageLog.deleteMany();

      const originalFetch = globalThis.fetch;
      globalThis.fetch = async (url, options) => {
        return {
          ok: false,
          status: 500,
          text: async () => "Server Error",
          headers: new Map()
        };
      };

      process.env.AI_PROVIDER_CHAIN = "gemini,local";
      process.env.GEMINI_API_KEY = "mock-key";

      const res = await routeLlmCompletion("test prompt", "rag_answer", "req-4");
      const dbLogs = await prisma.aiUsageLog.findMany({ where: { requestId: "req-4" }, orderBy: { createdAt: "asc" } });

      globalThis.fetch = originalFetch;

      console.log(JSON.stringify({ res, dbLogs }));
    })().catch((err) => {
      console.error(err);
      process.exit(1);
    });
  `);

  assert.equal(result.res.provider, "local");
  assert.equal(result.dbLogs.length, 2);
  assert.equal(result.dbLogs[0].provider, "gemini");
  assert.equal(result.dbLogs[0].status, "failed");
  assert.equal(result.dbLogs[1].provider, "local");
  assert.equal(result.dbLogs[1].status, "success");
  assert.equal(result.dbLogs[1].fallbackUsed, true);
});

test("endpoint /api/ai/usage requiere admin token", () => {
  const fileContent = fs.readFileSync("app/api/ai/usage/route.ts", "utf8");
  assert.match(fileContent, /requireAdmin/);
});

test("weekly-changes route does not import generateLlmCompletion", () => {
  const fileContent = fs.readFileSync("app/api/legal/weekly-changes/route.ts", "utf8");
  assert.ok(!fileContent.includes("generateLlmCompletion"));
});

test("GET /api/ai/usage sin registros devuelve summary en ceros y requiere token", async () => {
  const result = runTs(`
    import { GET } from "./app/api/ai/usage/route";
    import { prisma } from "./lib/prisma";

    (async () => {
      await prisma.aiUsageLog.deleteMany();

      // Test 1: Without admin token (Unauthorized)
      const reqNoToken = new Request("http://localhost:3000/api/ai/usage");
      const resNoToken = await GET(reqNoToken);
      const dataNoToken = await resNoToken.json();

      // Test 2: With valid admin token (Success, returns zeros)
      const reqToken = new Request("http://localhost:3000/api/ai/usage", {
        headers: { "x-admin-token": "dev-admin-token" }
      });
      const resToken = await GET(reqToken);
      const dataToken = await resToken.json();

      console.log(JSON.stringify({
        statusNoToken: resNoToken.status,
        dataNoToken,
        statusToken: resToken.status,
        dataToken
      }));
    })().catch(err => {
      console.error(err);
      process.exit(1);
    });
  `);

  assert.equal(result.statusNoToken, 401);
  assert.equal(result.dataNoToken.ok, false);
  assert.equal(result.statusToken, 200);
  assert.equal(result.dataToken.ok, true);
  assert.equal(result.dataToken.summary.totalAttempts, 0);
  assert.equal(result.dataToken.summary.estimatedCostUsd, "0.000000");
  assert.ok(Array.isArray(result.dataToken.providers));
});

test("/ai render variables previene crashes de limitsResult y summary", () => {
  const fileContent = fs.readFileSync("app/ai/page.tsx", "utf8");
  assert.match(fileContent, /EMPTY_USAGE_SUMMARY/);
  assert.match(fileContent, /EMPTY_PROVIDERS/);
  assert.match(fileContent, /limitsResult\?.summary/);
  assert.match(fileContent, /limitsResult\?.providers/);
  assert.match(fileContent, /usageSummary\.totalAttempts/);
});

