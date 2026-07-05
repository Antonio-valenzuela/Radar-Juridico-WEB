import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";

function runTs(code, env = {}) {
  const result = spawnSync(
    process.execPath,
    ["node_modules/tsx/dist/cli.mjs", "--eval", code],
    {
      encoding: "utf8",
      env: { ...process.env, NODE_ENV: "development", ...env },
      timeout: 45000,
    }
  );

  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || result.error?.message || "tsx execution failed");
  }

  return JSON.parse(result.stdout.trim());
}

test("validación SSRF acepta URLs HTTPS públicas", () => {
  const result = runTs(`
    import { validatePublicHttpUrl } from "./lib/security/urlValidation";
    const validation = validatePublicHttpUrl("https://www.dof.gob.mx/nota_detalle.php?codigo=123&fecha=01/01/2026");
    console.log(JSON.stringify(validation));
  `);

  assert.equal(result.ok, true);
  assert.equal(result.url, "https://www.dof.gob.mx/nota_detalle.php?codigo=123&fecha=01/01/2026");
});

test("validación SSRF rechaza protocolos, localhost, IPs privadas y metadata cloud", () => {
  const result = runTs(`
    import { validatePublicHttpUrl } from "./lib/security/urlValidation";
    const urls = [
      "file:///etc/passwd",
      "http://localhost:3000",
      "http://127.0.0.1:3000",
      "http://10.0.0.2/secret",
      "http://172.16.0.1/secret",
      "http://192.168.1.4/secret",
      "http://169.254.169.254/latest/meta-data",
      "http://metadata.google.internal/computeMetadata/v1"
    ];
    console.log(JSON.stringify(urls.map((url) => validatePublicHttpUrl(url))));
  `);

  assert.ok(result.every((validation) => validation.ok === false));
  assert.ok(result.some((validation) => validation.reason.includes("protocolo")));
  assert.ok(result.some((validation) => validation.reason.includes("privada") || validation.reason.includes("localhost")));
});

test("validación de redirects rechaza saltos hacia destinos inseguros", () => {
  const result = runTs(`
    import { validateRedirectTarget } from "./lib/security/urlValidation";
    const safe = validateRedirectTarget("https://www.dof.gob.mx/index.php", "/nota_detalle.php?codigo=1");
    const unsafe = validateRedirectTarget("https://www.dof.gob.mx/index.php", "http://127.0.0.1/admin");
    console.log(JSON.stringify({ safe, unsafe }));
  `);

  assert.equal(result.safe.ok, true);
  assert.equal(result.safe.url, "https://www.dof.gob.mx/nota_detalle.php?codigo=1");
  assert.equal(result.unsafe.ok, false);
});

test("extractor HTML elimina menú/login/scripts y conserva texto jurídico", () => {
  const result = runTs(`
    import { extractLegalContentFromHtml } from "./lib/ingest/manualUrl";
    const html = \`
      <html>
        <head><title>DOF - Diario Oficial</title><style>.x{}</style><script>alert(1)</script></head>
        <body>
          <nav>Inicio Trámites Login Su navegador no soporta JavaScript</nav>
          <main>
            <h1>DECRETO por el que se reforman disposiciones fiscales</h1>
            <p>Secretaría de Hacienda y Crédito Público</p>
            <p>El Congreso de los Estados Unidos Mexicanos decreta reformas a la Ley del Impuesto sobre la Renta.</p>
            <p>Transitorios. Primero. El presente Decreto entrará en vigor al día siguiente.</p>
          </main>
          <footer>Contacto mapa del sitio</footer>
        </body>
      </html>\`;
    const extracted = extractLegalContentFromHtml(html, "https://www.dof.gob.mx/nota_detalle.php?codigo=1");
    console.log(JSON.stringify(extracted));
  `);

  assert.equal(result.quality.status, "valid");
  assert.match(result.title, /DECRETO/);
  assert.match(result.text, /Ley del Impuesto sobre la Renta/);
  assert.doesNotMatch(result.text, /Login|JavaScript|Contacto|alert/);
  assert.equal(result.authority, "Secretaría de Hacienda y Crédito Público");
});

test("extractor manda HTML sin contenido jurídico a ruido", () => {
  const result = runTs(`
    import { extractLegalContentFromHtml } from "./lib/ingest/manualUrl";
    const extracted = extractLegalContentFromHtml("<html><body><nav>Login Menú</nav><p>Bienvenido al portal</p></body></html>", "https://example.com");
    console.log(JSON.stringify(extracted.quality));
  `);

  assert.equal(result.status, "noise");
  assert.ok(result.reasons.length > 0);
});

test("ingesta manual guarda documento válido y lo marca para búsqueda/RAG", () => {
  const result = runTs(`
    import { ingestManualUrl } from "./lib/ingest/manualUrl";
    (async () => {
      const calls = [];
      const prisma = {
        item: {
          upsert: async (args) => {
            calls.push(["item.upsert", args]);
            return { id: "item_1", ...args.create };
          }
        },
        document: {
          upsert: async (args) => {
            calls.push(["document.upsert", args]);
            return { id: "doc_1", ...args.create };
          }
        },
        documentVersion: {
          upsert: async (args) => {
            calls.push(["documentVersion.upsert", args]);
            return { id: "version_1", ...args.create };
          }
        },
        processingJob: {
          create: async (args) => {
            calls.push(["processingJob.create", args]);
            return { id: "job_1", ...args.data };
          }
        },
        auditLog: {
          create: async (args) => {
            calls.push(["auditLog.create", args]);
            return { id: "audit_1", ...args.data };
          }
        }
      };
      const html = \`
        <main>
          <h1>ACUERDO General en materia laboral</h1>
          <p>Secretaría del Trabajo y Previsión Social</p>
          <p>Se emiten lineamientos laborales aplicables a los centros de trabajo y obligaciones patronales.</p>
          <p>El presente Acuerdo entrará en vigor al día siguiente de su publicación.</p>
        </main>\`;
      const response = await ingestManualUrl({
        url: "https://www.dof.gob.mx/nota_detalle.php?codigo=2",
        matter: "laboral",
        jurisdiction: "federal",
        tags: ["stps"],
        indexNow: true
      }, {
        prisma,
        fetchText: async () => ({
          ok: true,
          finalUrl: "https://www.dof.gob.mx/nota_detalle.php?codigo=2",
          contentType: "text/html",
          body: html
        }),
        indexDocumentVersion: async (id) => {
          calls.push(["indexDocumentVersion", id]);
          return { ok: true, chunks: 1, skipped: false };
        }
      });
      console.log(JSON.stringify({ response, calls: calls.map((call) => call[0]) }));
    })().catch((error) => {
      console.error(error);
      process.exit(1);
    });
  `);

  assert.equal(result.response.ok, true);
  assert.equal(result.response.status, "stored");
  assert.equal(result.response.documentId, "item_1");
  assert.equal(result.response.documentVersionId, "version_1");
  assert.ok(result.calls.includes("item.upsert"));
  assert.ok(result.calls.includes("documentVersion.upsert"));
  assert.ok(result.calls.includes("indexDocumentVersion"));
});

test("ingesta manual de índice Diputados guarda PDFs descubiertos sin embeddings obligatorios", () => {
  const result = runTs(`
    import { ingestManualUrl } from "./lib/ingest/manualUrl";
    (async () => {
      const calls = [];
      const existing = new Map();
      const prisma = {
        item: {
          findFirst: async () => null,
          create: async (args) => {
            calls.push(["item.create", args]);
            const id = "item_" + calls.filter((c) => c[0] === "item.create").length;
            existing.set(args.data.url, { id, ...args.data });
            return { id, ...args.data };
          },
          update: async (args) => {
            calls.push(["item.update", args]);
            return { id: args.where.id, ...args.data };
          }
        },
        document: {
          findFirst: async () => null,
          create: async (args) => {
            calls.push(["document.create", args]);
            return { id: "doc_" + calls.filter((c) => c[0] === "document.create").length, ...args.data };
          },
          update: async (args) => {
            calls.push(["document.update", args]);
            return { id: args.where.id, ...args.data };
          }
        },
        documentVersion: {
          findFirst: async () => null,
          create: async (args) => {
            calls.push(["documentVersion.create", args]);
            return { id: "version_" + calls.filter((c) => c[0] === "documentVersion.create").length, ...args.data };
          },
          update: async (args) => {
            calls.push(["documentVersion.update", args]);
            return { id: args.where.id, ...args.data };
          }
        },
        processingJob: { create: async (args) => ({ id: "job_1", ...args.data }) },
        auditLog: { create: async (args) => ({ id: "audit_1", ...args.data }) }
      };
      const html = \`
        <html><body>
          <a href="pdf/CPEUM.pdf">Constitución Política de los Estados Unidos Mexicanos</a>
          <a href="/LeyesBiblio/pdf/LFT.pdf">Ley Federal del Trabajo</a>
        </body></html>\`;
      const response = await ingestManualUrl({
        url: "https://www.diputados.gob.mx/LeyesBiblio/index.htm",
        matter: "constitucional",
        jurisdiction: "federal",
        sourceName: "Cámara de Diputados",
        tags: ["diputados"],
        indexNow: true
      }, {
        prisma,
        fetchText: async () => ({
          ok: true,
          finalUrl: "https://www.diputados.gob.mx/LeyesBiblio/index.htm",
          contentType: "text/html",
          body: html
        }),
        indexDocumentVersion: async () => {
          calls.push(["indexDocumentVersion"]);
          throw new Error("no debe indexar metadata de índice");
        }
      });
      console.log(JSON.stringify({ response, calls: calls.map((call) => call[0]) }));
    })().catch((error) => {
      console.error(error);
      process.exit(1);
    });
  `);

  assert.equal(result.response.ok, true);
  assert.equal(result.response.status, "stored");
  assert.equal(result.response.found, 2);
  assert.equal(result.response.saved, 2);
  assert.equal(result.response.indexingStatus, "pending");
  assert.equal(result.calls.filter((name) => name === "item.create").length, 2);
  assert.equal(result.calls.includes("indexDocumentVersion"), false);
});

test("reingesta manual reutiliza la última versión del documento si el contenido cambió", () => {
  const result = runTs(`
    import { ingestManualUrl } from "./lib/ingest/manualUrl";
    (async () => {
      const calls = [];
      const prisma = {
        item: {
          upsert: async (args) => {
            calls.push(["item.upsert", args]);
            return { id: "item_1", ...args.create };
          }
        },
        document: {
          findFirst: async () => ({ id: "doc_1", canonicalKey: "old_hash", canonicalUrl: "https://www.dof.gob.mx/nota_detalle.php?codigo=2" }),
          update: async (args) => {
            calls.push(["document.update", args]);
            return { id: "doc_1", ...args.data };
          },
          create: async (args) => {
            calls.push(["document.create", args]);
            return { id: "doc_new", ...args.data };
          }
        },
        documentVersion: {
          findFirst: async (args) => {
            calls.push(["documentVersion.findFirst", args]);
            if (args.where?.OR) return null;
            return { id: "version_existing", documentId: "doc_1", contentHash: "old_hash" };
          },
          update: async (args) => {
            calls.push(["documentVersion.update", args]);
            return { id: "version_existing", ...args.data };
          },
          create: async (args) => {
            calls.push(["documentVersion.create", args]);
            throw new Error("Unique constraint failed on the fields: (documentId,versionNumber)");
          }
        },
        processingJob: { create: async (args) => ({ id: "job_1", ...args.data }) },
        auditLog: { create: async (args) => ({ id: "audit_1", ...args.data }) }
      };
      const html = \`
        <main>
          <h1>ACUERDO General en materia laboral actualizado</h1>
          <p>Secretaría del Trabajo y Previsión Social</p>
          <p>Se emiten lineamientos laborales aplicables a centros de trabajo con nuevas obligaciones patronales.</p>
          <p>El presente Acuerdo entrará en vigor al día siguiente de su publicación.</p>
        </main>\`;
      const response = await ingestManualUrl({
        url: "https://www.dof.gob.mx/nota_detalle.php?codigo=2",
        matter: "laboral",
        jurisdiction: "federal",
        indexNow: false
      }, {
        prisma,
        fetchText: async () => ({
          ok: true,
          finalUrl: "https://www.dof.gob.mx/nota_detalle.php?codigo=2",
          contentType: "text/html",
          body: html
        }),
        indexDocumentVersion: async () => ({ ok: true })
      });
      console.log(JSON.stringify({ response, calls: calls.map((call) => call[0]) }));
    })().catch((error) => {
      console.error(error);
      process.exit(1);
    });
  `);

  assert.equal(result.response.ok, true);
  assert.equal(result.response.status, "stored");
  assert.equal(result.response.documentVersionId, "version_existing");
  assert.ok(result.calls.includes("documentVersion.update"));
  assert.equal(result.calls.includes("documentVersion.create"), false);
});

test("ingesta manual manda ruido a cuarentena y no indexa", () => {
  const result = runTs(`
    import { ingestManualUrl } from "./lib/ingest/manualUrl";
    (async () => {
      const calls = [];
      const prisma = {
        item: {
          upsert: async (args) => {
            calls.push(["item.upsert", args]);
            return { id: "noise_item", ...args.create };
          }
        },
        document: { upsert: async (args) => { calls.push(["document.upsert", args]); return { id: "doc_noise" }; } },
        documentVersion: { upsert: async (args) => { calls.push(["documentVersion.upsert", args]); return { id: "version_noise" }; } },
        processingJob: {
          create: async (args) => {
            calls.push(["processingJob.create", args]);
            return { id: "quarantine_1", ...args.data };
          }
        },
        auditLog: { create: async (args) => ({ id: "audit_noise", ...args.data }) }
      };
      const response = await ingestManualUrl({
        url: "https://www.dof.gob.mx/empty",
        matter: "otro",
        jurisdiction: "federal",
        tags: [],
        indexNow: true
      }, {
        prisma,
        fetchText: async () => ({
          ok: true,
          finalUrl: "https://www.dof.gob.mx/empty",
          contentType: "text/html",
          body: "<html><body><nav>Login</nav><p>Bienvenido</p></body></html>"
        }),
        indexDocumentVersion: async () => {
          calls.push(["indexDocumentVersion"]);
          return { ok: true };
        }
      });
      console.log(JSON.stringify({ response, calls: calls.map((call) => call[0]) }));
    })().catch((error) => {
      console.error(error);
      process.exit(1);
    });
  `);

  assert.equal(result.response.ok, true);
  assert.equal(result.response.status, "quarantined");
  assert.equal(result.response.quarantineId, "quarantine_1");
  assert.ok(result.calls.includes("processingJob.create"));
  assert.equal(result.calls.includes("indexDocumentVersion"), false);
});

test("ruta manual-url está protegida y no expone errores crudos", () => {
  const content = fs.readFileSync("app/api/admin/ingest/manual-url/route.ts", "utf8");

  assert.match(content, /requireAdmin/);
  assert.match(content, /ingestManualUrl/);
  assert.doesNotMatch(content, /stack/);
});

test("ruta manual-url devuelve 400 para JSON inválido sin exponer 500", () => {
  const result = runTs(`
    import { POST } from "./app/api/admin/ingest/manual-url/route";

    (async () => {
      const req = new Request("http://localhost/api/admin/ingest/manual-url", {
        method: "POST",
        headers: {
          "x-admin-token": "dev-admin-token",
          "Content-Type": "application/json"
        },
        body: "{url:bad-json}"
      });
      const response = await POST(req);
      const data = await response.json();
      console.log(JSON.stringify({ status: response.status, data }));
    })().catch((error) => {
      console.error(error);
      process.exit(1);
    });
  `);

  assert.equal(result.status, 400);
  assert.equal(result.data.ok, false);
  assert.match(result.data.message, /datos|JSON|solicitud/i);
});

test("UI de ingesta manual expone formulario y estados esperados", () => {
  const content = fs.readFileSync("app/admin/ingest/manual-url/page.tsx", "utf8");

  assert.match(content, /Pegar URL|URL/);
  assert.match(content, /Materia/);
  assert.match(content, /value="civil">Civil/);
  assert.match(content, /value="mercantil">Mercantil/);
  assert.match(content, /Jurisdicci/);
  assert.match(content, /Indexar ahora/);
  assert.match(content, /stored|quarantined|failed|cuarentena/i);
  assert.ok(content.includes("/api/admin/ingest/manual-url"));
  assert.match(content, /sourceName:\s*sourceOptional/);
  assert.match(content, /jurisdiction,\s*\n/);
});
