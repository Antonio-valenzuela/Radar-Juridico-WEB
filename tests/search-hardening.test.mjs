import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";

function runTs(code, env = {}) {
  const result = spawnSync(process.execPath, ["node_modules/tsx/dist/cli.mjs", "--eval", code], {
    cwd: process.cwd(),
    encoding: "utf8",
    timeout: 30_000,
    env: { NODE_PATH: process.cwd() + "/node_modules", ...process.env, ...env  },
  });

  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || "tsx execution failed");
  }

  return JSON.parse(result.stdout.trim().split("\n").pop() || "{}");
}

test("matter helpers toleran filtros inválidos sin lanzar excepciones", () => {
  const result = runTs(`
    import { matchesMatter, normalizeMatterValues } from "./lib/search/matter";
    console.log(JSON.stringify({
      array: normalizeMatterValues([" civil ", 42, null, ""]),
      legacy: normalizeMatterValues(" civil "),
      nullValue: normalizeMatterValues(null),
      undefinedValue: normalizeMatterValues(undefined),
      invalidObject: normalizeMatterValues({ matter: "civil" }),
      nullFilter: matchesMatter(["civil"], null),
      undefinedFilter: matchesMatter(["civil"], undefined),
      arrayFilter: matchesMatter(["civil", "familiar"], ["familiar"]),
    }));
  `);

  assert.deepEqual(result, {
    array: ["civil"],
    legacy: ["civil"],
    nullValue: [],
    undefinedValue: [],
    invalidObject: [],
    nullFilter: false,
    undefinedFilter: false,
    arrayFilter: true,
  });
});

test("filtro de materia cubre civil, mercantil, familiar, penal y amparo", () => {
  const result = runTs(`
    import { matchesMatter } from "./lib/search/matter";
    const values = ["civil", "mercantil", "familiar", "penal", "amparo"];
    console.log(JSON.stringify(values.map((matter) => ({
      matter,
      exact: matchesMatter([matter], matter),
      uppercase: matchesMatter([matter.toUpperCase()], "  " + matter.toUpperCase() + "  "),
      legacy: matchesMatter(matter, matter),
      emptyAi: matchesMatter([], matter),
    }))));
  `);
  for (const item of result) {
    assert.equal(item.exact, true);
    assert.equal(item.uppercase, true);
    assert.equal(item.legacy, true);
    assert.equal(item.emptyAi, false);
  }
});

test("normaliza campos IA y keywords sin invocar métodos sobre valores inválidos", () => {
  const result = runTs(`
    import { normalizeStringArray } from "./lib/search/matter";
    console.log(JSON.stringify({
      arrays: normalizeStringArray([" Civil ", 4, null, "MERCANTIL"]),
      legacy: normalizeStringArray(" Civil, familiar "),
      empty: normalizeStringArray([]),
      invalid: normalizeStringArray({ matter: "civil" }),
    }));
  `);
  assert.deepEqual(result, {
    arrays: ["civil", "mercantil"],
    legacy: ["civil", "familiar"],
    empty: [],
    invalid: [],
  });
});

test("advanced search rechaza cuerpos JSON no objeto con error estable", () => {
  const result = runTs(`
    import { POST } from "./app/api/search/advanced/route";
    (async () => {
      const response = await POST(new Request("http://localhost/api/search/advanced", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(null),
      }));
      console.log(JSON.stringify({ status: response.status, data: await response.json() }));
    })().catch((error) => { console.error(error); process.exit(1); });
  `);

  assert.equal(result.status, 400);
  assert.equal(result.data.ok, false);
  assert.equal(result.data.error, "invalid_filters");
});

test("advanced search clasifica una conexión Prisma caída sin exponer detalles", () => {
  const result = runTs(`
    process.env.NODE_ENV = "production";
    import { POST } from "./app/api/search/advanced/route";
    (async () => {
      const response = await POST(new Request("http://localhost/api/search/advanced", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ mode: "text" }),
      }));
      console.log(JSON.stringify({ status: response.status, data: await response.json() }));
    })().catch((error) => { console.error(error); process.exit(1); });
  `, { DATABASE_URL: "postgresql://invalid:invalid@127.0.0.1:1/invalid" });

  assert.equal(result.status, 503);
  assert.equal(result.data.ok, false);
  assert.equal(result.data.error, "database_unavailable");
  assert.equal("details" in result.data, false);
});

test("advanced search nunca expone detalles técnicos ni warnings crudos en desarrollo", () => {
  const result = runTs(`
    process.env.NODE_ENV = "development";
    import { POST } from "./app/api/search/advanced/route";
    (async () => {
      const response = await POST(new Request("http://localhost/api/search/advanced", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ mode: "text" }),
      }));
      console.log(JSON.stringify({ status: response.status, data: await response.json() }));
    })().catch((error) => { console.error(error); process.exit(1); });
  `, { DATABASE_URL: "postgresql://invalid:invalid@127.0.0.1:1/invalid" });

  assert.equal(result.status, 503);
  assert.equal(result.data.error, "database_unavailable");
  assert.equal("details" in result.data, false);

  const route = fs.readFileSync("app/api/search/advanced/route.ts", "utf8");
  assert.doesNotMatch(route, /Búsqueda federada fallida:\s*\$\{message\}/);
  assert.doesNotMatch(route, /warnings\.push\(\.\.\.federatedWarnings\)/);
});

test("admin token helper centraliza almacenamiento y headers", () => {
  const result = runTs(`
    import {
      clearAdminToken,
      getAdminToken,
      getAdminTokenHeaders,
      setAdminToken,
    } from "./lib/client/adminToken";

    const values = new Map();
    globalThis.window = {
      localStorage: {
        getItem: (key) => values.get(key) ?? null,
        setItem: (key, value) => values.set(key, value),
        removeItem: (key) => values.delete(key),
      },
    };

    const initial = getAdminToken();
    setAdminToken("  secret-token  ");
    const saved = getAdminToken();
    const headers = getAdminTokenHeaders({ "content-type": "application/json" });
    clearAdminToken();

    console.log(JSON.stringify({ initial, saved, headers, cleared: getAdminToken() }));
  `);

  assert.deepEqual(result, {
    initial: "",
    saved: "secret-token",
    headers: { "content-type": "application/json", "x-admin-token": "secret-token" },
    cleared: "",
  });
});

test("chat administrativo acepta el ADMIN_TOKEN configurado", () => {
  const result = runTs(`
    process.env.ADMIN_TOKEN = "0123456789abcdef0123456789abcdef";
    process.env.ENABLE_PUBLIC_DEMO = "false";
    import { POST } from "./app/api/ai/chat-bubble/route";
    (async () => {
      const response = await POST(new Request("http://localhost/api/ai/chat-bubble", {
        method: "POST",
        headers: { "x-admin-token": process.env.ADMIN_TOKEN },
        body: JSON.stringify({ currentPath: "/admin/sources" }),
      }));
      console.log(JSON.stringify({ status: response.status, data: await response.json() }));
    })().catch((error) => { console.error(error); process.exit(1); });
  `, { ADMIN_TOKEN: "0123456789abcdef0123456789abcdef" });

  assert.equal(result.status, 400);
  assert.equal(result.data.error, "invalid_message");
});
