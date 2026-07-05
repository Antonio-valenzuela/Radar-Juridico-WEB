import { ingestManualUrl } from "../lib/ingest/manualUrl";

const cases = [
  {
    name: "HTML Diputados index",
    url: "https://www.diputados.gob.mx/LeyesBiblio/index.htm",
    matter: "constitucional",
    jurisdiction: "federal",
    sourceName: "Cámara de Diputados",
    tags: ["diputados", "leyes federales", "constitucional"],
    indexNow: true,
  },
  {
    name: "PDF CPEUM",
    url: "https://www.diputados.gob.mx/LeyesBiblio/pdf/CPEUM.pdf",
    matter: "constitucional",
    jurisdiction: "federal",
    sourceName: "Cámara de Diputados",
    tags: ["constitución", "cpeum"],
    indexNow: true,
  },
  {
    name: "PDF LFT",
    url: "https://www.diputados.gob.mx/LeyesBiblio/pdf/LFT.pdf",
    matter: "laboral",
    jurisdiction: "federal",
    sourceName: "Cámara de Diputados",
    tags: ["laboral", "lft"],
    indexNow: true,
  },
  {
    name: "SSRF localhost blocked",
    url: "https://localhost:3000/secret",
    matter: "otro",
    jurisdiction: "federal",
    sourceName: "Localhost",
    tags: [],
    indexNow: false,
  },
];

async function main() {
  const results = [];
  for (const item of cases) {
    console.log(`[test-manual-url-ingest] running ${item.name}`);
    const result = await ingestManualUrl(item);
    results.push({
      name: item.name,
      ok: result.ok,
      status: result.status,
      message: result.message,
      detail: result.detail,
      found: result.found,
      saved: result.saved,
      duplicates: result.duplicates,
      documentId: result.documentId,
      canonicalDocumentId: result.canonicalDocumentId,
      documentVersionId: result.documentVersionId,
      indexingStatus: result.indexingStatus,
      warnings: result.warnings,
    });
  }

  console.log(JSON.stringify(results, null, 2));
  const localhost = results.find((result) => result.name === "SSRF localhost blocked");
  const failedUnexpectedly = results.some((result) => result.name !== "SSRF localhost blocked" && !result.ok);
  if (failedUnexpectedly || localhost?.ok) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error("[test-manual-url-ingest] failed", error);
  process.exit(1);
});
