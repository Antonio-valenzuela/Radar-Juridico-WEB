import crypto from "node:crypto";
import * as cheerio from "cheerio";
import type { PrismaClient } from "@prisma/client";
import { prisma as defaultPrisma } from "@/lib/prisma";
import { classifyItem } from "@/lib/classifier";
import { cleanText, canonicalizeUrl, parseMxDate } from "@/lib/ingest/normalize";
import { DEFAULT_HEADERS } from "@/lib/sources/http";
import { INGEST_FETCH_MS } from "@/lib/config/timeouts";
import { validatePublicHttpUrl, validateRedirectTarget } from "@/lib/security/urlValidation";
import { indexDocumentVersion as defaultIndexDocumentVersion } from "@/lib/documents/indexDocument";

type ManualMatter =
  | "fiscal"
  | "laboral"
  | "constitucional"
  | "familiar"
  | "administrativo"
  | "otro";

export type ManualUrlInput = {
  url: string;
  matter?: ManualMatter | string;
  sourceName?: string;
  jurisdiction?: string;
  tags?: string[];
  indexNow?: boolean;
};

export type ManualFetchResult =
  | { ok: true; finalUrl: string; contentType: string; body: string }
  | { ok: false; finalUrl?: string; error: string };

export type ManualIngestResponse = {
  ok: boolean;
  status: "stored" | "quarantined" | "failed";
  documentId?: string;
  canonicalDocumentId?: string;
  documentVersionId?: string;
  quarantineId?: string;
  indexingStatus?: "requested" | "indexed" | "pending" | "failed";
  ragReady?: boolean;
  message: string;
  warnings: string[];
  timings: {
    validationMs: number;
    fetchMs: number;
    extractMs: number;
    persistMs: number;
    indexMs: number;
  };
};

type ManualIngestDeps = {
  prisma?: any;
  fetchText?: (url: string) => Promise<ManualFetchResult>;
  indexDocumentVersion?: (documentVersionId: string) => Promise<unknown>;
};

export type ExtractedManualContent = {
  title: string;
  text: string;
  summary: string;
  authority: string | null;
  publishedAt: string | null;
  sourceName: string;
  documentType: string;
  quality: {
    status: "valid" | "noise";
    score: number;
    reasons: string[];
  };
};

const LEGAL_MARKERS = [
  /\bDECRETO\b/i,
  /\bACUERDO\b/i,
  /\bLEY\b/i,
  /\bC[ÓO]DIGO\b/i,
  /\bREGLAMENTO\b/i,
  /\bLINEAMIENTOS\b/i,
  /\bJURISPRUDENCIA\b/i,
  /\bSENTENCIA\b/i,
  /\bSECRETAR[IÍ]A\b/i,
  /\bCONGRESO\b/i,
  /\bTRANSITORIOS?\b/i,
  /\bENTRAR[ÁA]? EN VIGOR\b/i,
  /\bART[ÍI]CULO\b/i,
  /\bOBLIGACIONES?\b/i,
];

const CHROME_PATTERNS = [
  /su navegador no soporta javascript/gi,
  /iniciar sesi[oó]n/gi,
  /\blogin\b/gi,
  /mapa del sitio/gi,
  /tr[aá]mites y servicios/gi,
];

function nowMs() {
  return Date.now();
}

function elapsed(startedAt: number) {
  return Date.now() - startedAt;
}

function sha256(value: string) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function inferDocumentType(text: string) {
  const classified = classifyItem(text.slice(0, 300), text.slice(0, 3000));
  return classified.tipo || "DOCUMENTO";
}

function findAuthority(text: string) {
  const secretaria = text.match(/Secretar[ií]a\s+(?:de|del|la)\s+[A-ZÁÉÍÓÚÑa-záéíóúñ\s]+/u)?.[0];
  if (secretaria) {
    const stopWords = /\s+(?:Al margen|El|La|Los|Las|Se|Por|Transitorios?|Art[íi]culo|Decreto)\b/u;
    return cleanText(secretaria.split(stopWords)[0]);
  }

  const patterns = [
    /Suprema Corte de Justicia de la Naci[oó]n/u,
    /C[aá]mara de Diputados/u,
    /Senado de la Rep[uú]blica/u,
    /Instituto Nacional [A-ZÁÉÍÓÚÑa-záéíóúñ\s]+/u,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[0]) return cleanText(match[0]);
  }
  return null;
}

function computeQuality(text: string) {
  const reasons: string[] = [];
  const markerCount = LEGAL_MARKERS.filter((pattern) => pattern.test(text)).length;
  const lengthScore = Math.min(text.length / 900, 1);
  const markerScore = Math.min(markerCount / 4, 1);
  const score = Number(((lengthScore * 0.45 + markerScore * 0.55) * 100).toFixed(2));

  if (text.length < 120) reasons.push("contenido demasiado corto");
  if (markerCount < 2) reasons.push("no se detectaron suficientes marcadores jurídicos");

  return {
    status: reasons.length === 0 ? "valid" as const : "noise" as const,
    score,
    reasons,
  };
}

function cleanChromeText(text: string) {
  let cleaned = text;
  for (const pattern of CHROME_PATTERNS) cleaned = cleaned.replace(pattern, " ");
  return cleanText(cleaned);
}

function decodeResponseBody(body: ArrayBuffer, contentType: string) {
  const charset = contentType.match(/charset=([^;]+)/i)?.[1]?.trim().replace(/^["']|["']$/g, "");
  const preferredEncoding = charset || "utf-8";

  try {
    const decoded = new TextDecoder(preferredEncoding).decode(body);
    if (!decoded.includes("�")) return decoded;
  } catch {
    // Fall through to UTF-8/windows-1252 heuristic.
  }

  const utf8 = new TextDecoder("utf-8").decode(body);
  if (!utf8.includes("�")) return utf8;

  try {
    return new TextDecoder("windows-1252").decode(body);
  } catch {
    return utf8;
  }
}

export function extractLegalContentFromHtml(html: string, url: string): ExtractedManualContent {
  const $ = cheerio.load(html);
  $("script,style,noscript,nav,header,footer,iframe,svg,form,button,input,select,aside").remove();
  $("[role='navigation'],[aria-label*='nav' i],.menu,.navbar,.login,.footer,.header").remove();

  const title =
    cleanText($("main h1").first().text()) ||
    cleanText($("article h1").first().text()) ||
    cleanText($("h1").first().text()) ||
    cleanText($("title").first().text()).replace(/DOF\s*-\s*Diario Oficial.*/i, "").trim() ||
    `Documento ${new URL(url).hostname}`;

  const candidates = [
    $("main").text(),
    $("article").text(),
    $("#content").text(),
    $(".content").first().text(),
    $("body").text(),
  ].map(cleanChromeText).filter(Boolean);

  const text = candidates.sort((a, b) => b.length - a.length)[0] || "";
  const quality = computeQuality(`${title}\n${text}`);
  const sourceName = new URL(url).hostname.replace(/^www\./, "");
  const maybeDate = text.match(/\d{1,2}\s+de\s+[a-záéíóúñ]+\s+(?:de\s+)?\d{4}|\d{1,2}[/-]\d{1,2}[/-]\d{4}/i)?.[0] || "";
  const parsedDate = maybeDate ? parseMxDate(maybeDate) : null;

  return {
    title: title || `Documento ${sourceName}`,
    text,
    summary: text.slice(0, 2000),
    authority: findAuthority(`${title}\n${text}`),
    publishedAt: parsedDate ? parsedDate.toISOString() : null,
    sourceName,
    documentType: inferDocumentType(`${title}\n${text}`),
    quality,
  };
}

export function extractLegalContentFromText(text: string, url: string): ExtractedManualContent {
  const cleaned = cleanChromeText(text);
  const firstLine = cleaned.split(/[.!?\n]/).find((line) => line.trim().length > 20);
  const title = cleanText(firstLine || `Documento ${new URL(url).hostname}`).slice(0, 240);
  const quality = computeQuality(`${title}\n${cleaned}`);
  const sourceName = new URL(url).hostname.replace(/^www\./, "");
  return {
    title,
    text: cleaned,
    summary: cleaned.slice(0, 2000),
    authority: findAuthority(`${title}\n${cleaned}`),
    publishedAt: null,
    sourceName,
    documentType: inferDocumentType(`${title}\n${cleaned}`),
    quality,
  };
}

export async function fetchManualUrlText(url: string): Promise<ManualFetchResult> {
  let current = url;
  const timeoutMs = INGEST_FETCH_MS;

  for (let redirectCount = 0; redirectCount <= 5; redirectCount++) {
    const controller = new AbortController();
    const timer = timeoutMs > 0 ? setTimeout(() => controller.abort(), timeoutMs) : undefined;
    try {
      const response = await fetch(current, {
        redirect: "manual",
        cache: "no-store",
        headers: { ...DEFAULT_HEADERS, Accept: "text/html,application/pdf,text/plain,*/*" },
        signal: controller.signal,
      });
      if (timer) clearTimeout(timer);

      if ([301, 302, 303, 307, 308].includes(response.status)) {
        const validation = validateRedirectTarget(current, response.headers.get("location"));
        if (!validation.ok) return { ok: false, finalUrl: current, error: validation.reason };
        current = validation.url;
        continue;
      }

      if (!response.ok) {
        return { ok: false, finalUrl: current, error: `Fuente inaccesible (HTTP ${response.status})` };
      }

      const contentType = response.headers.get("content-type") || "text/plain";
      const body = decodeResponseBody(await response.arrayBuffer(), contentType);
      return { ok: true, finalUrl: current, contentType, body };
    } catch (error) {
      if (timer) clearTimeout(timer);
      return {
        ok: false,
        finalUrl: current,
        error: error instanceof Error && error.name === "AbortError"
          ? "Tiempo de descarga agotado"
          : "No se pudo descargar la fuente",
      };
    }
  }

  return { ok: false, finalUrl: current, error: "Demasiados redirects" };
}

function jsonSafe(value: unknown) {
  return JSON.parse(JSON.stringify(value));
}

async function createAudit(prisma: any, action: string, entityId: string | null, metadata: Record<string, unknown>) {
  try {
    await prisma.auditLog?.create?.({
      data: {
        action,
        entityType: "manual_url_ingest",
        entityId,
        metadata: jsonSafe(metadata),
      },
    });
  } catch {
    // Audit logging must not break ingestion.
  }
}

export async function ingestManualUrl(
  input: ManualUrlInput,
  deps: ManualIngestDeps = {}
): Promise<ManualIngestResponse> {
  const timings = { validationMs: 0, fetchMs: 0, extractMs: 0, persistMs: 0, indexMs: 0 };
  const warnings: string[] = [];
  const db = deps.prisma || defaultPrisma;
  const fetchText = deps.fetchText || fetchManualUrlText;
  const indexDocumentVersion = deps.indexDocumentVersion || defaultIndexDocumentVersion;

  let startedAt = nowMs();
  const validation = validatePublicHttpUrl(input.url);
  timings.validationMs = elapsed(startedAt);
  if (!validation.ok) {
    return {
      ok: false,
      status: "failed",
      message: `URL inválida o bloqueada: ${validation.reason}`,
      warnings,
      timings,
    };
  }

  startedAt = nowMs();
  const fetched = await fetchText(validation.url);
  timings.fetchMs = elapsed(startedAt);
  if (!fetched.ok) {
    return {
      ok: false,
      status: "failed",
      message: fetched.error,
      warnings,
      timings,
    };
  }

  startedAt = nowMs();
  const finalValidation = validatePublicHttpUrl(fetched.finalUrl);
  if (!finalValidation.ok) {
    timings.extractMs = elapsed(startedAt);
    return {
      ok: false,
      status: "failed",
      message: `URL final bloqueada: ${finalValidation.reason}`,
      warnings,
      timings,
    };
  }

  const contentType = fetched.contentType.toLowerCase();
  if (contentType.includes("pdf")) {
    warnings.push("PDF recibido; se guardará cuando el extractor PDF dedicado esté activo para ingesta manual.");
  }

  const extracted = contentType.includes("html") || /<html|<body|<main|<article/i.test(fetched.body)
    ? extractLegalContentFromHtml(fetched.body, finalValidation.url)
    : extractLegalContentFromText(fetched.body, finalValidation.url);
  timings.extractMs = elapsed(startedAt);

  const canonicalUrl = canonicalizeUrl(finalValidation.url);
  const contentHash = sha256(extracted.text || fetched.body);
  const source = input.sourceName?.trim() || extracted.sourceName || new URL(canonicalUrl).hostname;
  const published = extracted.publishedAt ? new Date(extracted.publishedAt) : new Date();
  const classification = classifyItem(extracted.title, extracted.text);
  const tema = input.matter && input.matter !== "otro" ? String(input.matter) : classification.tema;
  const searchableText = [extracted.title, extracted.summary, extracted.text, tema, extracted.authority]
    .filter(Boolean)
    .join("\n");
  let indexingStatus: "requested" | "indexed" | "pending" | "failed" =
    input.indexNow === false ? "pending" : "requested";

  startedAt = nowMs();
  if (extracted.quality.status === "noise") {
    const quarantine = await db.processingJob.create({
      data: {
        queueName: "manual-ingest",
        jobName: "manual-url",
        jobId: contentHash,
        type: "manual_url_quarantine",
        source,
        status: "quarantined",
        payload: jsonSafe({
          input,
          url: validation.url,
          finalUrl: finalValidation.url,
          contentType: fetched.contentType,
        }),
        result: jsonSafe({
          title: extracted.title,
          textPreview: extracted.text.slice(0, 500),
          quality: extracted.quality,
        }),
        finishedAt: new Date(),
      },
    });
    timings.persistMs = elapsed(startedAt);
    await createAudit(db, "manual_url.quarantined", quarantine.id, {
      url: finalValidation.url,
      reasons: extracted.quality.reasons,
    });

    return {
      ok: true,
      status: "quarantined",
      quarantineId: quarantine.id,
      message: "La URL fue descargada, pero el contenido parece ruido y quedó en cuarentena.",
      warnings: [...warnings, ...extracted.quality.reasons],
      timings,
    };
  }

  const item = await db.item.upsert({
    where: { url: finalValidation.url },
    update: {
      source,
      title: extracted.title,
      canonicalUrl,
      hash: contentHash,
      published,
      retrievedAt: new Date(),
      summary: extracted.summary,
      impacto: classification.impacto,
      tipo: extracted.documentType || classification.tipo,
      tema,
      category: "normativo",
      keywordsHit: classification.keywordsHit.length ? classification.keywordsHit.join(",") : null,
      rawRef: finalValidation.url,
      raw: jsonSafe({
        ingestion: "manual_url",
        finalUrl: finalValidation.url,
        authority: extracted.authority,
        jurisdiction: input.jurisdiction || null,
        tags: input.tags || [],
        quality: extracted.quality,
        searchableText,
        indexingStatus,
        ragReady: input.indexNow !== false,
        documentVersionId: null,
      }),
    },
    create: {
      source,
      sourceId: contentHash,
      title: extracted.title,
      url: finalValidation.url,
      canonicalUrl,
      hash: contentHash,
      published,
      retrievedAt: new Date(),
      summary: extracted.summary,
      impacto: classification.impacto,
      tipo: extracted.documentType || classification.tipo,
      tema,
      category: "normativo",
      keywordsHit: classification.keywordsHit.length ? classification.keywordsHit.join(",") : null,
      rawRef: finalValidation.url,
      raw: jsonSafe({
        ingestion: "manual_url",
        finalUrl: finalValidation.url,
        authority: extracted.authority,
        jurisdiction: input.jurisdiction || null,
        tags: input.tags || [],
        quality: extracted.quality,
        searchableText,
        indexingStatus,
        ragReady: input.indexNow !== false,
        documentVersionId: null,
      }),
    },
  });

  const documentData = {
    source,
    jurisdiction: input.jurisdiction || "federal",
    documentType: extracted.documentType || classification.tipo,
    title: extracted.title,
    canonicalUrl,
    status: "active",
    summary: extracted.summary,
    hasVersions: true,
    latestVersionHash: contentHash,
  };

  let document;
  if (typeof db.document.findFirst === "function" && typeof db.document.update === "function" && typeof db.document.create === "function") {
    const existingDocument = await db.document.findFirst({
      where: {
        OR: [
          { canonicalUrl },
          { canonicalKey: contentHash },
        ],
      },
    });
    document = existingDocument
      ? await db.document.update({
          where: { id: existingDocument.id },
          data: {
            ...documentData,
            canonicalKey: contentHash,
          },
        })
      : await db.document.create({
          data: {
            ...documentData,
            canonicalKey: contentHash,
          },
        });
  } else {
    document = await db.document.upsert({
      where: { canonicalKey: contentHash },
      update: documentData,
      create: {
        ...documentData,
        canonicalKey: contentHash,
      },
    });
  }

  const versionData = {
    publishedAt: published,
    rawRef: finalValidation.url,
    rawText: extracted.text,
    originalText: extracted.text,
    sourceItemId: item.id,
  };

  let version;
  if (typeof db.documentVersion.findFirst === "function" && typeof db.documentVersion.update === "function" && typeof db.documentVersion.create === "function") {
    const existingVersion = await db.documentVersion.findFirst({
      where: {
        documentId: document.id,
        OR: [
          { contentHash },
          { rawRef: finalValidation.url },
          { sourceItemId: item.id },
        ],
      },
      orderBy: { createdAt: "desc" },
    });
    const reusableVersion = existingVersion || await db.documentVersion.findFirst({
      where: { documentId: document.id },
      orderBy: { createdAt: "desc" },
    });
    if (reusableVersion && reusableVersion.contentHash !== contentHash) {
      await db.documentChunk?.deleteMany?.({
        where: { documentVersionId: reusableVersion.id },
      });
    }
    version = reusableVersion
      ? await db.documentVersion.update({
          where: { id: reusableVersion.id },
          data: {
            ...versionData,
            contentHash,
            versionLabel: published.toISOString().slice(0, 10),
          },
        })
      : await db.documentVersion.create({
          data: {
            documentId: document.id,
            versionLabel: published.toISOString().slice(0, 10),
            versionNumber: 1,
            contentHash,
            ...versionData,
          },
        });
  } else {
    version = await db.documentVersion.upsert({
      where: {
        documentId_contentHash: {
          documentId: document.id,
          contentHash,
        },
      },
      update: versionData,
      create: {
        documentId: document.id,
        versionLabel: published.toISOString().slice(0, 10),
        versionNumber: 1,
        contentHash,
        ...versionData,
      },
    });
  }
  timings.persistMs = elapsed(startedAt);

  if (input.indexNow !== false) {
    startedAt = nowMs();
    try {
      await indexDocumentVersion(version.id);
      indexingStatus = "indexed";
    } catch {
      indexingStatus = "failed";
      warnings.push("El documento se guardó, pero la indexación quedó pendiente por un error de embeddings.");
    }
    timings.indexMs = elapsed(startedAt);
  }

  await createAudit(db, "manual_url.stored", item.id, {
    url: finalValidation.url,
    documentId: document.id,
    documentVersionId: version.id,
  });

  return {
    ok: true,
    status: "stored",
    documentId: item.id,
    canonicalDocumentId: document.id,
    documentVersionId: version.id,
    indexingStatus,
    ragReady: indexingStatus === "indexed",
    message: indexingStatus === "indexed"
      ? "Documento jurídico guardado correctamente, indexado y disponible para búsqueda/RAG."
      : "Documento jurídico guardado correctamente y disponible para búsqueda; RAG queda pendiente de indexación.",
    warnings,
    timings,
  };
}
