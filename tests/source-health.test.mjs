import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";

function runTs(code) {
  const result = spawnSync(process.execPath, ["node_modules/tsx/dist/cli.mjs", "--eval", code], {
    cwd: process.cwd(),
    encoding: "utf8",
    timeout: 30000,
    env: { ...process.env, NODE_ENV: "test" },
  });

  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || result.error?.message || "tsx execution failed");
  }

  return JSON.parse(result.stdout.trim().split("\n").pop() || "{}");
}

test("SIDOF health usa /apiStatus y no la ruta obsoleta", () => {
  const result = runTs(`
    import { checkSourceHealth } from "./lib/sources/sourceHealth";
    (async () => {
      let requested = "";
      const health = await checkSourceHealth(
        { adapter: "SIDOF", baseUrl: "https://sidof.segob.gob.mx/dof/sidof" },
        {
          fetch: async (url) => {
            requested = String(url);
            return new Response("ok", { status: 200 });
          },
          validate: async () => ({ safe: true })
        }
      );
      console.log(JSON.stringify({ requested, health }));
    })();
  `);

  assert.equal(result.requested, "https://sidof.segob.gob.mx/apiStatus");
  assert.equal(result.health.status, "OK");
});

test("DIPUTADOS health usa LeyesBiblio/index.htm", () => {
  const result = runTs(`
    import { checkSourceHealth } from "./lib/sources/sourceHealth";
    (async () => {
      let requested = "";
      const health = await checkSourceHealth(
        { adapter: "DIPUTADOS", baseUrl: "https://www.diputados.gob.mx" },
        {
          fetch: async (url) => {
            requested = String(url);
            return new Response("<html></html>", { status: 200 });
          },
          validate: async () => ({ safe: true })
        }
      );
      console.log(JSON.stringify({ requested, health }));
    })();
  `);

  assert.equal(result.requested, "https://www.diputados.gob.mx/LeyesBiblio/index.htm");
  assert.equal(result.health.status, "OK");
});

test("SJF clasifica shell JavaScript como BROWSER_REQUIRED", () => {
  const result = runTs(`
    import { checkSourceHealth } from "./lib/sources/sourceHealth";
    (async () => {
      const health = await checkSourceHealth(
        { adapter: "SJF", baseUrl: "https://sjf2.scjn.gob.mx", requiresBrowser: true },
        {
          fetch: async () => new Response("You must enable JavaScript to view this page", { status: 200 }),
          validate: async () => ({ safe: true })
        }
      );
      console.log(JSON.stringify(health));
    })();
  `);

  assert.equal(result.status, "BROWSER_REQUIRED");
  assert.equal(result.accessible, true);
});

test("403 de SCJN se clasifica BLOCKED_BY_PROVIDER", () => {
  const result = runTs(`
    import { checkSourceHealth } from "./lib/sources/sourceHealth";
    (async () => {
      const health = await checkSourceHealth(
        { adapter: "SCJN_LEG", baseUrl: "https://legislacion.scjn.gob.mx" },
        {
          fetch: async () => new Response("Forbidden", { status: 403 }),
          validate: async () => ({ safe: true })
        }
      );
      console.log(JSON.stringify(health));
    })();
  `);

  assert.equal(result.status, "BLOCKED_BY_PROVIDER");
  assert.equal(result.accessible, true);
  assert.notEqual(result.status, "FETCH_ERROR");
});

test("fetch failed conserva error.cause", () => {
  const result = runTs(`
    import { checkSourceHealth } from "./lib/sources/sourceHealth";
    (async () => {
      const health = await checkSourceHealth(
        { adapter: "DOF", baseUrl: "https://www.dof.gob.mx" },
        {
          fetch: async () => {
            const error = new TypeError("fetch failed", {
              cause: { code: "ENOTFOUND", message: "getaddrinfo ENOTFOUND", hostname: "www.dof.gob.mx" }
            });
            throw error;
          },
          validate: async () => ({ safe: true })
        }
      );
      console.log(JSON.stringify(health));
    })();
  `);

  assert.equal(result.status, "FETCH_ERROR");
  assert.equal(result.error.name, "TypeError");
  assert.equal(result.error.message, "fetch failed");
  assert.equal(result.error.causeCode, "ENOTFOUND");
  assert.equal(result.error.causeMessage, "getaddrinfo ENOTFOUND");
  assert.equal(result.error.causeHostname, "www.dof.gob.mx");
});

test("redirect HTTP del mismo host oficial se reescribe a HTTPS", () => {
  const result = runTs(`
    import { checkSourceHealth } from "./lib/sources/sourceHealth";
    (async () => {
      const requested = [];
      const health = await checkSourceHealth(
        { adapter: "DIPUTADOS", baseUrl: "https://www.diputados.gob.mx" },
        {
          fetch: async (url) => {
            requested.push(String(url));
            if (requested.length === 1) {
              return new Response(null, { status: 302, headers: { location: "http://www.diputados.gob.mx/LeyesBiblio/index.htm" } });
            }
            return new Response("<html></html>", { status: 200 });
          },
          validate: async () => ({ safe: true })
        }
      );
      console.log(JSON.stringify({ requested, health }));
    })();
  `);

  assert.deepEqual(result.requested, [
    "https://www.diputados.gob.mx/LeyesBiblio/index.htm",
    "https://www.diputados.gob.mx/LeyesBiblio/index.htm",
  ]);
  assert.equal(result.health.status, "OK");
});

test("redirect HTTP fuera de allowlist se bloquea", () => {
  const result = runTs(`
    import { checkSourceHealth } from "./lib/sources/sourceHealth";
    (async () => {
      const health = await checkSourceHealth(
        { adapter: "DIPUTADOS", baseUrl: "https://www.diputados.gob.mx" },
        {
          fetch: async () => new Response(null, { status: 302, headers: { location: "http://example.com/collect" } }),
          validate: async () => ({ safe: true })
        }
      );
      console.log(JSON.stringify(health));
    })();
  `);

  assert.equal(result.status, "REDIRECT_BLOCKED");
  assert.equal(result.accessible, true);
  assert.equal(result.statusCode, 302);
});

test("OfficialSource persiste configuración de health compatible", () => {
  const schema = fs.readFileSync("prisma/schema.prisma", "utf8");
  assert.match(schema, /adapter\s+String\s+@default\("GENERIC_HTML"\)/);
  assert.match(schema, /healthUrl\s+String\?/);
  assert.match(schema, /requiresBrowser\s+Boolean\s+@default\(false\)/);
});

test("seed usa slugs canónicos y health URLs correctas", () => {
  const seed = fs.readFileSync("prisma/seed_sources.ts", "utf8");
  for (const slug of ["SIDOF", "DIPUTADOS", "SCJN_LEG", "SCJN_SJF", "DOF_WEB"]) {
    assert.match(seed, new RegExp(`slug:\\s*["']${slug}["']`), slug);
  }
  assert.match(seed, /https:\/\/sidof\.segob\.gob\.mx\/apiStatus/);
  assert.match(seed, /https:\/\/www\.diputados\.gob\.mx\/LeyesBiblio\/index\.htm/);
  assert.doesNotMatch(seed, /sidof\.segob\.gob\.mx\/dof\/sidof/);
});

test("CRUD acepta campos opcionales del health service", () => {
  const createRoute = fs.readFileSync("app/api/admin/sources/route.ts", "utf8");
  const updateRoute = fs.readFileSync("app/api/admin/sources/[id]/route.ts", "utf8");
  for (const field of ["adapter", "healthUrl", "requiresBrowser"]) {
    assert.match(createRoute, new RegExp(`\\b${field}\\b`), `create ${field}`);
    assert.match(updateRoute, new RegExp(`\\b${field}\\b`), `update ${field}`);
  }
});

test("endpoint admin usa SourceHealthService y conserva requireAdmin", () => {
  const route = fs.readFileSync("app/api/admin/sources/[id]/test/route.ts", "utf8");
  assert.match(route, /requireAdmin\s*\(/);
  assert.match(route, /checkSourceHealth\s*\(/);
  assert.doesNotMatch(route, /testOfficialSourceConnection/);
  assert.match(route, /BLOCKED_BY_PROVIDER/);
  assert.match(route, /BROWSER_REQUIRED/);
  assert.match(route, /WARNING_ACCESSIBLE_WITH_LIMITATIONS/);
});

test("TLS inválido en dominio oficial usa fallback acotado y devuelve advertencia", () => {
  const result = runTs(`
    import { checkSourceHealth } from "./lib/sources/sourceHealth";
    (async () => {
      let normalCalls = 0;
      let relaxedCalls = 0;
      const health = await checkSourceHealth(
        { adapter: "DOF", baseUrl: "https://www.dof.gob.mx" },
        {
          fetch: async () => {
            normalCalls++;
            throw new TypeError("fetch failed", { cause: { code: "UNABLE_TO_VERIFY_LEAF_SIGNATURE" } });
          },
          relaxedFetch: async () => {
            relaxedCalls++;
            return new Response("<html></html>", { status: 200 });
          },
          validate: async () => ({ safe: true })
        }
      );
      console.log(JSON.stringify({ normalCalls, relaxedCalls, health }));
    })();
  `);

  assert.equal(result.normalCalls, 1);
  assert.equal(result.relaxedCalls, 1);
  assert.equal(result.health.accessible, true);
  assert.equal(result.health.status, "WARNING_ACCESSIBLE_WITH_LIMITATIONS");
});
