import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

function runTs(code) {
  const result = spawnSync(process.execPath, ["node_modules/tsx/dist/cli.mjs", "--eval", code], {
    encoding: "utf8",
    env: { ...process.env, LLM_PROVIDER: "local", NODE_ENV: "test" },
    timeout: 30000
  });

  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || result.error?.message || "tsx execution failed");
  }

  try {
    return JSON.parse(result.stdout.trim().split("\n").pop() || "{}");
  } catch (e) {
    console.error("Failed to parse stdout:", result.stdout);
    throw new Error("Invalid JSON returned: " + result.stdout);
  }
}

// 1. Admin crea fuente válida / 2. Sin admin token se rechaza creación
test("Admin crea fuente válida y se rechaza sin token", () => {
  const res = runTs(`
    import { POST } from "./app/api/admin/sources/route";
    import { prisma } from "./lib/prisma";

    (async () => {
      // 1. Sin admin token
      const reqNoToken = new Request("http://localhost/api/admin/sources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Test Source",
          slug: "test_temp_slug_" + Date.now(),
          baseUrl: "https://example.com/test",
          type: "manual_url"
        })
      });
      const resNoToken = await POST(reqNoToken);

      // 2. Con admin token válido
      const testSlug = "test_temp_slug_" + Date.now();
      const reqValid = new Request("http://localhost/api/admin/sources", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-token": "dev-admin-token"
        },
        body: JSON.stringify({
          name: "Test Source Admin Valid",
          slug: testSlug,
          baseUrl: "https://example.com/valid",
          type: "manual_url"
        })
      });
      const resValid = await POST(reqValid);
      const dataValid = await resValid.json();

      // Limpiar BD
      if (dataValid.ok && dataValid.source?.id) {
        await prisma.officialSource.delete({
          where: { id: dataValid.source.id }
        });
      }

      console.log(JSON.stringify({
        noTokenStatus: resNoToken.status,
        validOk: dataValid.ok,
        validName: dataValid.source?.name
      }));
    })();
  `);

  assert.equal(res.noTokenStatus, 401);
  assert.equal(res.validOk, true);
  assert.equal(res.validName, "Test Source Admin Valid");
});

// 3. URL http pública se rechaza si no está permitida / 7. Protocolos peligrosos
test("SSRF: Rechaza URLs HTTP inseguras y protocolos peligrosos", () => {
  const res = runTs(`
    import { validateUrlSafety } from "./lib/security/urlValidation";

    (async () => {
      const httpSafety = await validateUrlSafety("http://google.com");
      const fileSafety = await validateUrlSafety("file:///etc/passwd");
      const dataSafety = await validateUrlSafety("data:text/html,test");
      const jsSafety = await validateUrlSafety("javascript:alert(1)");

      console.log(JSON.stringify({
        httpSafe: httpSafety.safe,
        fileSafe: fileSafety.safe,
        dataSafe: dataSafety.safe,
        jsSafe: jsSafety.safe
      }));
    })();
  `);

  assert.equal(res.httpSafe, false);
  assert.equal(res.fileSafe, false);
  assert.equal(res.dataSafe, false);
  assert.equal(res.jsSafe, false);
});

// 4. localhost se rechaza / 5. 127.0.0.1 se rechaza / 6. IP privadas
test("SSRF: Rechaza localhost, 127.0.0.1 e IPs privadas", () => {
  const res = runTs(`
    import { validateUrlSafety } from "./lib/security/urlValidation";

    (async () => {
      const localhostSafe = await validateUrlSafety("https://localhost/path");
      const loopbackSafe = await validateUrlSafety("https://127.0.0.1/path");
      const rfc1918_10 = await validateUrlSafety("https://10.0.0.1/path");
      const rfc1918_172 = await validateUrlSafety("https://172.16.0.1/path");
      const rfc1918_192 = await validateUrlSafety("https://192.168.1.1/path");
      const ipv6Local = await validateUrlSafety("https://[fe80::1]/path");

      console.log(JSON.stringify({
        localhost: localhostSafe.safe,
        loopback: loopbackSafe.safe,
        ip10: rfc1918_10.safe,
        ip172: rfc1918_172.safe,
        ip192: rfc1918_192.safe,
        ipv6: ipv6Local.safe
      }));
    })();
  `);

  assert.equal(res.localhost, false);
  assert.equal(res.loopback, false);
  assert.equal(res.ip10, false);
  assert.equal(res.ip172, false);
  assert.equal(res.ip192, false);
  assert.equal(res.ipv6, false);
});

// 8. Fuente se desactiva con DELETE lógico
test("DELETE lógico desactiva la fuente oficial", () => {
  const res = runTs(`
    import { DELETE } from "./app/api/admin/sources/[id]/route";
    import { prisma } from "./lib/prisma";

    (async () => {
      // Crear temporal
      const testSource = await prisma.officialSource.create({
        data: {
          name: "Test Delete Logico",
          slug: "test_delete_logico_" + Date.now(),
          baseUrl: "https://example.com/todelete",
          type: "manual_url",
          isActive: true
        }
      });

      const req = new Request("http://localhost/api/admin/sources/" + testSource.id, {
        method: "DELETE",
        headers: { "x-admin-token": "dev-admin-token" }
      });
      const response = await DELETE(req, { params: Promise.resolve({ id: testSource.id }) });
      const data = await response.json();

      // Verificar en BD
      const fresh = await prisma.officialSource.findUnique({
        where: { id: testSource.id }
      });

      // Limpiar BD
      await prisma.officialSource.delete({
        where: { id: testSource.id }
      });

      console.log(JSON.stringify({
        ok: data.ok,
        isActiveBefore: testSource.isActive,
        isActiveAfter: fresh?.isActive
      }));
    })();
  `);

  assert.equal(res.ok, true);
  assert.equal(res.isActiveBefore, true);
  assert.equal(res.isActiveAfter, false);
});

// 9. Test connection no guarda documentos
test("Test connection no persiste documentos en la base de datos", () => {
  const res = runTs(`
    import { POST } from "./app/api/admin/sources/[id]/test/route";
    import { prisma } from "./lib/prisma";

    (async () => {
      const testSource = await prisma.officialSource.create({
        data: {
          name: "Test Conn Non-persistent",
          slug: "test_conn_temp_" + Date.now(),
          baseUrl: "https://example.com/test",
          type: "manual_url",
          isActive: true
        }
      });

      const countBefore = await prisma.item.count();
      
      const req = new Request("http://localhost/api/admin/sources/" + testSource.id + "/test", {
        method: "POST",
        headers: { "x-admin-token": "dev-admin-token" }
      });
      
      await POST(req, { params: Promise.resolve({ id: testSource.id }) });
      const countAfter = await prisma.item.count();

      // Limpiar
      await prisma.officialSource.delete({
        where: { id: testSource.id }
      });

      console.log(JSON.stringify({
        countBefore,
        countAfter
      }));
    })();
  `);

  assert.equal(res.countBefore, res.countAfter);
});

// 10. Ingesta manual requiere admin / 11. Ingesta registra fetch log
test("Ingesta manual requiere admin y registra fetch log", () => {
  const res = runTs(`
    import { POST } from "./app/api/admin/sources/[id]/ingest/route";
    import { prisma } from "./lib/prisma";

    (async () => {
      const testSource = await prisma.officialSource.create({
        data: {
          name: "Test Ingest Inactive",
          slug: "test_ingest_temp_" + Date.now(),
          baseUrl: "https://example.com/ingest",
          type: "manual_url",
          isActive: true
        }
      });

      // 1. Sin token
      const reqNoToken = new Request("http://localhost/api/admin/sources/" + testSource.id + "/ingest", {
        method: "POST"
      });
      const resNoToken = await POST(reqNoToken, { params: Promise.resolve({ id: testSource.id }) });

      // 2. Con token (Como example.com/ingest fallará o retornará mock, debería registrar logs de sincronización)
      const reqToken = new Request("http://localhost/api/admin/sources/" + testSource.id + "/ingest", {
        method: "POST",
        headers: { "x-admin-token": "dev-admin-token" }
      });
      await POST(reqToken, { params: Promise.resolve({ id: testSource.id }) });

      const logsCount = await prisma.officialSourceFetchLog.count({
        where: { sourceId: testSource.id }
      });

      // Limpiar
      await prisma.officialSourceFetchLog.deleteMany({ where: { sourceId: testSource.id } });
      await prisma.officialSource.delete({ where: { id: testSource.id } });

      console.log(JSON.stringify({
        noTokenStatus: resNoToken.status,
        logsRegistered: logsCount > 0
      }));
    })();
  `);

  assert.equal(res.noTokenStatus, 401);
  assert.equal(res.logsRegistered, true);
});

// 12. Búsqueda local suficiente no llama búsqueda externa
test("Búsqueda local suficiente no llama búsqueda externa", () => {
  const res = runTs(`
    import { POST } from "./app/api/legal/radar/route";
    import { prisma } from "./lib/prisma";

    (async () => {
      // Registrar un documento con score alto en la BD local
      const testItem = await prisma.item.create({
        data: {
          title: "Suficiencia de búsqueda local y RAG seguro",
          source: "DOF",
          url: "https://example.com/radar-test-local-sufficient-" + Date.now(),
          published: new Date(),
          summary: "Evidencia de prueba local para resolver la consulta legal de forma satisfactoria sin búsquedas externas.",
          category: "oficial"
        }
      });

      // Crear Documento
      const testDoc = await prisma.document.create({
        data: {
          source: "DOF",
          documentType: "ley",
          title: "Suficiencia de búsqueda local y RAG seguro",
          canonicalKey: "canonical-test-key-" + Date.now(),
        }
      });

      // Crear versión del documento
      await prisma.documentVersion.create({
        data: {
          documentId: testDoc.id,
          sourceItemId: testItem.id,
          rawText: "Evidencia de prueba local para resolver la consulta legal de forma satisfactoria sin búsquedas externas.",
          contentHash: "hash-" + Date.now(),
        }
      });

      const req = new Request("http://localhost/api/legal/radar", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-token": "dev-admin-token"
        },
        body: JSON.stringify({
          query: "Suficiencia de búsqueda local y RAG seguro",
          forceExternal: false
        })
      });

      const response = await POST(req);
      const data = await response.json();

      // Limpiar
      await prisma.documentVersion.deleteMany({ where: { sourceItemId: testItem.id } });
      await prisma.document.delete({ where: { id: testDoc.id } });
      await prisma.item.delete({ where: { id: testItem.id } });

      console.log(JSON.stringify({
        externalQueried: data.debug?.externalSourcesQueried?.length || 0,
        localDocsFound: data.localResults?.length || 0
      }));
      await prisma.$disconnect();
      setTimeout(() => process.exit(0), 200);
    })();
  `);

  assert.equal(res.externalQueried, 0);
  assert.ok(res.localDocsFound > 0);
});

// 13. Búsqueda externa usa solo fuentes registradas activas
test("Búsqueda externa usa solo fuentes registradas activas", () => {
  const res = runTs(`
    import { searchOfficialSources } from "./lib/search/officialFederatedSearch";
    import { prisma } from "./lib/prisma";

    (async () => {
      // Intentar buscar usando un dominio no registrado
      const { results, warnings } = await searchOfficialSources([
        { domain: "hacker-domain-unregistered.com", name: "Hacker Portal", searchQuery: "test" }
      ]);
      
      const hasUnregisteredResult = results.some(r => r.results && r.results.length > 0);
      const warnMsg = warnings.join(", ");

      console.log(JSON.stringify({
        hasUnregisteredResult,
        warnMsg
      }));
    })();
  `);

  assert.equal(res.hasUnregisteredResult, false);
  assert.ok(res.warnMsg.includes("Dominio o fuente inactiva"));
});

// 14. Respuesta RAG incluye URL/evidencia si usó fuente externa / 15. Si no hay evidencia, la IA no inventa
test("RAG responde mensaje controlado ante falta de evidencia", () => {
  const res = runTs(`
    import { POST } from "./app/api/legal/radar/route";
    import { prisma } from "./lib/prisma";

    (async () => {
      // Mock global fetch to resolve immediately with empty search results
      globalThis.fetch = async () => {
        return new Response(JSON.stringify({ ok: true, results: [] }), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        });
      };

      // Realizar una búsqueda de un término imposible y asegurar que no hay resultados
      const req = new Request("http://localhost/api/legal/radar", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-token": "dev-admin-token"
        },
        body: JSON.stringify({
          query: "termino-inexistente-sin-evidencia-" + Date.now(),
          forceExternal: true // Forzar búsqueda externa
        })
      });

      const response = await POST(req);
      const data = await response.json();

      console.log(JSON.stringify({
        summary: data.aiAnalysis?.summary || ""
      }));
      await prisma.$disconnect();
      process.exit(0);
    })();
  `);

  assert.equal(res.summary, "No se encontró evidencia suficiente en fuentes oficiales registradas.");
});

// 16. GET /api/legal/weekly-changes no dispara ingesta
test("Weekly-changes no dispara ingesta automática", () => {
  const res = runTs(`
    import { GET } from "./app/api/legal/weekly-changes/route";
    import { prisma } from "./lib/prisma";

    (async () => {
      const runsBefore = await prisma.ingestRun.count();
      const req = new Request("http://localhost/api/legal/weekly-changes");
      await GET(req);
      const runsAfter = await prisma.ingestRun.count();

      console.log(JSON.stringify({
        runsBefore,
        runsAfter
      }));
    })();
  `);

  assert.equal(res.runsBefore, res.runsAfter);
});

// 17. POST /api/legal/radar sigue protegido
test("POST /api/legal/radar requiere token de administrador", () => {
  const res = runTs(`
    import { POST } from "./app/api/legal/radar/route";

    (async () => {
      const req = new Request("http://localhost/api/legal/radar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: "test" })
      });
      const response = await POST(req);
      console.log(JSON.stringify({ status: response.status }));
    })();
  `);

  assert.equal(res.status, 401);
});

// 18. Test endpoint devuelve JSON incluso en error interno
test("Test connection devuelve JSON estructurado ante source inexistente", () => {
  const res = runTs(`
    import { POST } from "./app/api/admin/sources/[id]/test/route";

    (async () => {
      const req = new Request("http://localhost/api/admin/sources/nonexistent-id/test", {
        method: "POST",
        headers: { "x-admin-token": "dev-admin-token" }
      });
      const response = await POST(req, { params: Promise.resolve({ id: "nonexistent-id" }) });
      const contentType = response.headers.get("content-type") || "";
      const data = await response.json();
      console.log(JSON.stringify({
        status: response.status,
        isJson: contentType.includes("application/json"),
        hasOk: typeof data.ok === "boolean",
        ok: data.ok
      }));
    })();
  `);

  assert.equal(res.status, 404);
  assert.equal(res.isJson, true);
  assert.equal(res.hasOk, true);
  assert.equal(res.ok, false);
});

// 18b. Endpoint estático para Next dev: evita 404 HTML en rutas dinámicas anidadas
test("Test connection endpoint estático devuelve JSON ante source inexistente", () => {
  const res = runTs(`
    import { POST } from "./app/api/admin/source-test/route";

    (async () => {
      const req = new Request("http://localhost/api/admin/source-test", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-token": "dev-admin-token"
        },
        body: JSON.stringify({ id: "nonexistent-id" })
      });
      const response = await POST(req);
      const contentType = response.headers.get("content-type") || "";
      const data = await response.json();
      console.log(JSON.stringify({
        status: response.status,
        isJson: contentType.includes("application/json"),
        hasOk: typeof data.ok === "boolean",
        ok: data.ok
      }));
    })();
  `);

  assert.equal(res.status, 404);
  assert.equal(res.isJson, true);
  assert.equal(res.hasOk, true);
  assert.equal(res.ok, false);
});

// 19. Ingesta manual_url con homepage devuelve MANUAL_URL_REQUIRED
test("Ingesta manual_url sin URL específica devuelve MANUAL_URL_REQUIRED", () => {
  const res = runTs(`
    import { POST } from "./app/api/admin/sources/[id]/ingest/route";
    import { prisma } from "./lib/prisma";

    (async () => {
      const testSource = await prisma.officialSource.create({
        data: {
          name: "Test Manual URL Homepage",
          slug: "test_manual_url_homepage_" + Date.now(),
          baseUrl: "https://www.example.com/",
          type: "manual_url",
          crawlMode: "manual_url",
          isActive: true
        }
      });

      const req = new Request("http://localhost/api/admin/sources/" + testSource.id + "/ingest", {
        method: "POST",
        headers: { "x-admin-token": "dev-admin-token" }
      });
      const response = await POST(req, { params: Promise.resolve({ id: testSource.id }) });
      const data = await response.json();

      // Limpiar
      await prisma.officialSource.delete({ where: { id: testSource.id } });

      console.log(JSON.stringify({
        status: response.status,
        errorCode: data.errorCode,
        ok: data.ok
      }));
    })();
  `);

  assert.equal(res.status, 400);
  assert.equal(res.errorCode, "MANUAL_URL_REQUIRED");
  assert.equal(res.ok, false);
});

// 19b. Endpoint estático para Next dev: evita 404 HTML en ingesta dinámica anidada
test("Ingesta endpoint estático devuelve JSON ante source inexistente", () => {
  const res = runTs(`
    import { POST } from "./app/api/admin/source-ingest/route";

    (async () => {
      const req = new Request("http://localhost/api/admin/source-ingest", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-token": "dev-admin-token"
        },
        body: JSON.stringify({ id: "nonexistent-id" })
      });
      const response = await POST(req);
      const contentType = response.headers.get("content-type") || "";
      const data = await response.json();
      console.log(JSON.stringify({
        status: response.status,
        isJson: contentType.includes("application/json"),
        hasOk: typeof data.ok === "boolean",
        ok: data.ok
      }));
    })();
  `);

  assert.equal(res.status, 404);
  assert.equal(res.isJson, true);
  assert.equal(res.hasOk, true);
  assert.equal(res.ok, false);
});

// 20. DOF web adapter se resuelve correctamente a DOF
test("DOF html usa adapter DOF correctamente", () => {
  const res = runTs(`
    import { resolveSourceAdapter } from "./lib/sources/sourceHealth";
    import { resolveIngestPolicy } from "./lib/sources/ingestPolicy";

    (async () => {
      const adapterDof = resolveSourceAdapter({ slug: "dof_web", type: "dof" });
      const adapterSidof = resolveSourceAdapter({ slug: "sidof", type: "sidof" });
      const adapterManual = resolveSourceAdapter({ slug: "custom_source", type: "manual_url" });

      const policyDof = resolveIngestPolicy({ slug: "dof_web", type: "dof" });
      const policySidof = resolveIngestPolicy({ slug: "sidof", type: "sidof" });

      console.log(JSON.stringify({
        adapterDof,
        adapterSidof,
        adapterManual,
        policyDofHandler: policyDof.handler,
        policySidofHandler: policySidof.handler
      }));
    })();
  `);

  assert.equal(res.adapterDof, "DOF");
  assert.equal(res.adapterSidof, "SIDOF");
  assert.equal(res.adapterManual, "GENERIC_HTML");
  assert.equal(res.policyDofHandler, "dof-web");
  assert.equal(res.policySidofHandler, "registry");
});

// 21. fetchJsonSafe: respuesta HTML produce error descriptivo, no SyntaxError
test("fetchJsonSafe equivalente detecta respuesta HTML sin crash", () => {
  const res = runTs(`
    (async () => {
      // Simular lo que hace fetchJsonSafe del frontend
      async function fetchJsonSafe(res) {
        const contentType = res.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
          return res.json();
        }
        const text = await res.text();
        const preview = text.slice(0, 300).replace(/\\n/g, ' ');
        throw new Error(
          "La API devolvió " + (contentType || "contenido desconocido") + " (HTTP " + res.status + ") en lugar de JSON. " +
          "Preview: " + preview
        );
      }

      // Test con respuesta HTML
      const htmlResponse = new Response("<!DOCTYPE html><html><body>Error</body></html>", {
        status: 500,
        headers: { "Content-Type": "text/html" }
      });
      let htmlError = null;
      try {
        await fetchJsonSafe(htmlResponse);
      } catch (e) {
        htmlError = e.message;
      }

      // Test con respuesta JSON válida
      const jsonResponse = new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
      const jsonResult = await fetchJsonSafe(jsonResponse);

      console.log(JSON.stringify({
        htmlErrorContainsApi: htmlError?.includes("La API") || false,
        htmlErrorContainsHtml: htmlError?.includes("text/html") || false,
        htmlErrorNoSyntaxError: !htmlError?.includes("Unexpected token") || false,
        jsonOk: jsonResult.ok
      }));
    })();
  `);

  assert.equal(res.htmlErrorContainsApi, true);
  assert.equal(res.htmlErrorContainsHtml, true);
  assert.equal(res.htmlErrorNoSyntaxError, true);
  assert.equal(res.jsonOk, true);
});
