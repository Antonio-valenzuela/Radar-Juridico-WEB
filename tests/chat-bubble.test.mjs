import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

function runTs(code, envOverrides = {}) {
  const result = spawnSync(process.execPath, ["node_modules/tsx/dist/cli.mjs", "--eval", code], {
    encoding: "utf8",
    env: {
      ...process.env,
      NODE_ENV: "test",
      GEMINI_API_KEY: "mock-key",
      GROQ_API_KEY: "",
      OPENROUTER_API_KEY: "",
      ...envOverrides,
    },
  });

  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || result.error?.message || "tsx execution failed");
  }

  return JSON.parse(result.stdout.trim());
}

test("API Chat Bubble retorna estructura JSON valida", () => {
  const result = runTs(`
    import { POST } from "./app/api/ai/chat-bubble/route";
    import { NextRequest } from "next/server";
    import { prisma } from "./lib/prisma";

    (async () => {
      // Limpiar db locks
      await prisma.aiProviderHealth.deleteMany().catch(() => {});
      await prisma.aiUsageEvent.deleteMany().catch(() => {});

      const req = new NextRequest("http://localhost/api/ai/chat-bubble", {
        method: "POST",
        body: JSON.stringify({
          message: "Hola, necesito cambios de derecho penal de esta semana",
          currentPath: "/search",
          mode: "latest_changes"
        })
      });

      const response = await POST(req);
      const data = await response.json();
      console.log(JSON.stringify(data));
    })().catch((err) => {
      console.error(err);
      process.exit(1);
    });
  `);

  assert.equal(typeof result.answer, "string");
  assert.equal(typeof result.usedLocalData, "boolean");
  assert.equal(Array.isArray(result.citations), true);
  assert.equal(Array.isArray(result.actions), true);
  assert.equal(result.mode, "latest_changes");
});

test("API Chat Bubble valida token para rutas admin", () => {
  const result = runTs(`
    import { POST } from "./app/api/ai/chat-bubble/route";
    import { NextRequest } from "next/server";

    (async () => {
      const req = new NextRequest("http://localhost/api/ai/chat-bubble", {
        method: "POST",
        headers: {
          "x-admin-token": "wrong-token"
        },
        body: JSON.stringify({
          message: "hola",
          currentPath: "/admin/sources"
        })
      });

      const response = await POST(req);
      console.log(JSON.stringify({ status: response.status }));
    })().catch((err) => {
      console.error(err);
      process.exit(1);
    });
  `);

  assert.equal(result.status, 401);
});

test("API Chat Bubble no muestra mensajes técnicos cuando la IA externa falla", () => {
  const result = runTs(`
    import { POST } from "./app/api/ai/chat-bubble/route";
    import { NextRequest } from "next/server";

    (async () => {
      const req = new NextRequest("http://localhost/api/ai/chat-bubble", {
        method: "POST",
        body: JSON.stringify({
          message: "Necesito preparar una demanda laboral por despido injustificado, ¿qué debo revisar?",
          currentPath: "/search",
          mode: "general"
        })
      });

      const response = await POST(req);
      const data = await response.json();
      console.log(JSON.stringify({
        status: response.status,
        answer: data.answer,
        mode: data.mode
      }));
    })().catch((err) => {
      console.error(err);
      process.exit(1);
    });
  `, {
    AI_PROVIDER_CHAIN: "local",
    AI_ENABLE_USAGE_TRACKING: "false"
  });

  assert.equal(result.status, 200);
  assert.equal(result.mode, "general_platform_help");
  assert.equal(/degradad|sin conexión|IA externa|base local|indexad/i.test(result.answer), false);
  assert.match(result.answer, /informativa|fuentes oficiales|verifica/i);
  assert.match(result.answer, /laboral|despido|demanda/i);
});

test("API Chat Bubble convierte JSON cercado del proveedor en texto legible", () => {
  const result = runTs(`
    import { POST } from "./app/api/ai/chat-bubble/route";
    import { NextRequest } from "next/server";

    let call = 0;
    globalThis.fetch = async () => {
      call += 1;
      const text = call === 1
        ? '{"intent":"general_platform_help","materia":"laboral","tema":"despido","relativeDate":null,"source":null,"confidence":0.9}'
        : "\\\`\\\`\\\`json\\n" + JSON.stringify({
          answer: "Guía laboral limpia para revisar despido injustificado.\\n\\n⚠️ Respuesta generada por IA; verifica con fuentes oficiales.",
          citations: [],
          suggestedActions: [{ label: "Buscar LFT", type: "search_query", payload: { query: "Ley Federal del Trabajo" } }]
        }) + "\\n\\\`\\\`\\\`";
      return new Response(JSON.stringify({
        candidates: [{ content: { parts: [{ text }] } }],
        usageMetadata: { promptTokenCount: 1, candidatesTokenCount: 1, totalTokenCount: 2 }
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    };

    (async () => {
      const req = new NextRequest("http://localhost/api/ai/chat-bubble", {
        method: "POST",
        body: JSON.stringify({
          message: "Revisa despido injustificado",
          currentPath: "/search",
          mode: "general"
        })
      });

      const response = await POST(req);
      const data = await response.json();
      console.log(JSON.stringify({
        status: response.status,
        answer: data.answer,
        actions: data.actions
      }));
    })().catch((err) => {
      console.error(err);
      process.exit(1);
    });
  `, {
    AI_PROVIDER_CHAIN: "gemini",
    GEMINI_API_KEY: "mock-key",
    AI_ENABLE_USAGE_TRACKING: "false"
  });

  assert.equal(result.status, 200);
  assert.equal(result.answer.includes("```"), false);
  assert.match(result.answer, /Guía laboral limpia/);
  assert.equal(result.actions[0].label, "Buscar LFT");
});

test("API Chat Bubble fuerza latest_changes para consultas de cambios penales esta semana", () => {
  const result = runTs(`
    import { POST } from "./app/api/ai/chat-bubble/route";
    import { NextRequest } from "next/server";

    (async () => {
      const req = new NextRequest("http://localhost/api/ai/chat-bubble", {
        method: "POST",
        body: JSON.stringify({
          message: "derecho penal dame los ultimos cambios en las leyes de esta semana",
          currentPath: "/search",
          mode: "general"
        })
      });

      const response = await POST(req);
      const data = await response.json();
      console.log(JSON.stringify({
        status: response.status,
        mode: data.mode,
        actions: data.actions,
        answer: data.answer
      }));
    })().catch((err) => {
      console.error(err);
      process.exit(1);
    });
  `, {
    AI_PROVIDER_CHAIN: "local",
    AI_ENABLE_USAGE_TRACKING: "false"
  });

  assert.equal(result.status, 200);
  assert.equal(result.mode, "latest_changes");
  assert.equal(result.actions.some((action) => action.type === "search_query" && action.payload?.query?.includes("reformas derecho penal")), true);
  assert.equal(result.actions.some((action) => action.type === "create_alert" && action.payload?.query === "derecho penal"), true);
  assert.equal(/no genera un resumen en tiempo real/i.test(result.answer), false);
});

test("API Chat Bubble no fuerza DOF en acción penal reciente si debe consultar resultados reales", () => {
  const result = runTs(`
    import { POST } from "./app/api/ai/chat-bubble/route";
    import { NextRequest } from "next/server";

    (async () => {
      const req = new NextRequest("http://localhost/api/ai/chat-bubble", {
        method: "POST",
        body: JSON.stringify({
          message: "derecho penal dame los ultimos cambios en las leyes de esta semana",
          currentPath: "/search",
          mode: "general"
        })
      });

      const response = await POST(req);
      const data = await response.json();
      const searchAction = data.actions.find((action) => action.type === "search_query");
      console.log(JSON.stringify({
        status: response.status,
        mode: data.mode,
        searchAction,
        answer: data.answer
      }));
    })().catch((err) => {
      console.error(err);
      process.exit(1);
    });
  `, {
    AI_PROVIDER_CHAIN: "local",
    AI_ENABLE_USAGE_TRACKING: "false"
  });

  assert.equal(result.status, 200);
  assert.equal(result.mode, "latest_changes");
  assert.equal(result.searchAction?.payload?.matter, "penal");
  assert.notEqual(result.searchAction?.payload?.source, "DOF");
  assert.equal(/No tengo una publicación específica recuperada/i.test(result.answer), false);
});

test("API Chat Bubble reemplaza respuesta evasiva ante cambios penales semanales", () => {
  const result = runTs(`
    import { POST } from "./app/api/ai/chat-bubble/route";
    import { NextRequest } from "next/server";

    let call = 0;
    globalThis.fetch = async () => {
      call += 1;
      const text = call === 1
        ? '{"intent":"latest_changes","materia":"penal"}'
        : "\\\`\\\`\\\`json\\n" + JSON.stringify({
          answer: "Puedo ayudarte a revisar cambios recientes con una búsqueda jurídica filtrada por materia y fecha. Usa la acción de búsqueda para consultar registros oficiales disponibles.",
          followUpQuestions: ["¿Existe alguna reforma reciente sobre este tema?"]
        }) + "\\n\\\`\\\`\\\`";
      return new Response(JSON.stringify({
        candidates: [{ content: { parts: [{ text }] } }],
        usageMetadata: { promptTokenCount: 1, candidatesTokenCount: 1, totalTokenCount: 2 }
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    };

    (async () => {
      const req = new NextRequest("http://localhost/api/ai/chat-bubble", {
        method: "POST",
        body: JSON.stringify({
          message: "Dame los cambios en el derecho penal esta semana",
          currentPath: "/search",
          mode: "general"
        })
      });

      const response = await POST(req);
      const data = await response.json();
      console.log(JSON.stringify({
        status: response.status,
        mode: data.mode,
        answer: data.answer,
        actions: data.actions
      }));
    })().catch((err) => {
      console.error(err);
      process.exit(1);
    });
  `, {
    AI_PROVIDER_CHAIN: "gemini",
    GEMINI_API_KEY: "mock-key",
    AI_ENABLE_USAGE_TRACKING: "false"
  });

  assert.equal(result.status, 200);
  assert.equal(result.mode, "latest_changes");
  assert.doesNotMatch(result.answer, /usa la acción de búsqueda|puedo ayudarte a revisar cambios recientes/i);
  assert.match(result.answer, /Revisé los documentos indexados|No encontré una reforma penal/i);
  assert.equal(result.actions.some((action) => action.type === "search_query" && action.payload?.matter === "penal"), true);
});
