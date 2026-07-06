import { createHash } from "node:crypto";
import { prisma } from "../prisma";
import { DEFAULT_MONITORED_DOCUMENTS, canonicalKeyForMonitoredDocument } from "./monitoredDocuments";

type MonitorableDocument = {
  id: string | null;
  title: string;
  shortCode: string | null;
  matter: string | null;
  jurisdiction: string;
  officialUrl: string;
  currentHash: string | null;
  etag: string | null;
  lastModified: Date | null;
  fileSize: bigint | null;
};

type RemoteDocumentMetadata = {
  ok: boolean;
  blocked: boolean;
  error: string | null;
  hash: string | null;
  etag: string | null;
  lastModified: Date | null;
  fileSize: bigint | null;
  httpStatus: number | null;
};

export type MonitorResultStatus = "baseline" | "unchanged" | "changed" | "error" | "blocked";

export type LegalDocumentMonitorResult = {
  documentId: string | null;
  shortCode: string | null;
  title: string;
  matter: string | null;
  jurisdiction: string;
  officialUrl: string;
  status: MonitorResultStatus;
  message: string;
  previousHash: string | null;
  newHash: string | null;
  etag: string | null;
  lastModified: Date | null;
  fileSize: bigint | null;
  httpStatus: number | null;
};

export type LegalDocumentMonitorSummary = {
  dryRun: boolean;
  reviewed: number;
  unchanged: number;
  changed: number;
  baselines: number;
  errors: number;
  blocked: number;
  results: LegalDocumentMonitorResult[];
};

export type RunLegalDocumentMonitorOptions = {
  dryRun: boolean;
  timeoutMs?: number;
  useCatalogWhenEmpty?: boolean;
};

function parseLastModified(value: string | null) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function parseFileSize(value: string | null) {
  if (!value || !/^\d+$/.test(value)) return null;
  return BigInt(value);
}

function classifyStatus(status: number) {
  if (status >= 200 && status < 400) return { ok: true, blocked: false, error: null };
  if ([401, 403, 405, 429].includes(status)) {
    return {
      ok: false,
      blocked: true,
      error: `La fuente oficial respondio HTTP ${status}; requiere revision manual.`,
    };
  }

  return {
    ok: false,
    blocked: false,
    error: `La fuente oficial respondio HTTP ${status}.`,
  };
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      ...init,
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "User-Agent": "JuridicoRadar/1.0 legal-change-monitor",
        ...(init.headers || {}),
      },
    });
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchSha256(url: string, timeoutMs: number) {
  const response = await fetchWithTimeout(url, { method: "GET" }, timeoutMs);
  const classified = classifyStatus(response.status);

  if (!classified.ok || !response.body) {
    return {
      hash: null,
      httpStatus: response.status,
      blocked: classified.blocked,
      error: classified.error || "La fuente oficial no entrego contenido para verificar.",
    };
  }

  const hash = createHash("sha256");
  const reader = response.body.getReader();

  while (true) {
    const chunk = await reader.read();
    if (chunk.done) break;
    hash.update(chunk.value);
  }

  return {
    hash: hash.digest("hex"),
    httpStatus: response.status,
    blocked: false,
    error: null,
  };
}

export async function fetchRemoteDocumentMetadata(url: string, timeoutMs = 15000): Promise<RemoteDocumentMetadata> {
  try {
    const head = await fetchWithTimeout(url, { method: "HEAD" }, timeoutMs);
    const classified = classifyStatus(head.status);
    const etag = head.headers.get("etag");
    const lastModified = parseLastModified(head.headers.get("last-modified"));
    const fileSize = parseFileSize(head.headers.get("content-length"));

    if (!classified.ok) {
      return {
        ok: false,
        blocked: classified.blocked,
        error: classified.error,
        hash: null,
        etag,
        lastModified,
        fileSize,
        httpStatus: head.status,
      };
    }

    const digest = await fetchSha256(url, timeoutMs);
    if (!digest.hash) {
      return {
        ok: false,
        blocked: digest.blocked,
        error: digest.error,
        hash: null,
        etag,
        lastModified,
        fileSize,
        httpStatus: digest.httpStatus,
      };
    }

    return {
      ok: true,
      blocked: false,
      error: null,
      hash: digest.hash,
      etag,
      lastModified,
      fileSize,
      httpStatus: head.status,
    };
  } catch (error) {
    const message = error instanceof Error && error.name === "AbortError"
      ? "La fuente oficial no respondio dentro del tiempo limite."
      : error instanceof Error
        ? error.message
        : "No fue posible revisar la fuente oficial.";

    return {
      ok: false,
      blocked: false,
      error: message,
      hash: null,
      etag: null,
      lastModified: null,
      fileSize: null,
      httpStatus: null,
    };
  }
}

async function loadDocuments(options: RunLegalDocumentMonitorOptions): Promise<MonitorableDocument[]> {
  try {
    const documents = await prisma.document.findMany({
      where: {
        officialUrl: { not: null },
        shortCode: { not: null },
      },
      orderBy: [{ shortCode: "asc" }],
      select: {
        id: true,
        title: true,
        shortCode: true,
        matter: true,
        jurisdiction: true,
        officialUrl: true,
        currentHash: true,
        etag: true,
        lastModified: true,
        fileSize: true,
      },
    });

    if (documents.length > 0 || !options.dryRun || options.useCatalogWhenEmpty === false) {
      return documents
        .filter((document) => document.officialUrl)
        .map((document) => ({
          ...document,
          officialUrl: document.officialUrl || "",
        }));
    }
  } catch (error) {
    if (!options.dryRun || options.useCatalogWhenEmpty === false) throw error;
  }

  return DEFAULT_MONITORED_DOCUMENTS.map((document) => ({
    id: null,
    title: document.title,
    shortCode: document.shortCode,
    matter: document.matter,
    jurisdiction: document.jurisdiction,
    officialUrl: document.officialUrl,
    currentHash: null,
    etag: null,
    lastModified: null,
    fileSize: null,
  }));
}

function buildResult(
  document: MonitorableDocument,
  status: MonitorResultStatus,
  metadata: RemoteDocumentMetadata,
  message: string,
): LegalDocumentMonitorResult {
  return {
    documentId: document.id,
    shortCode: document.shortCode,
    title: document.title,
    matter: document.matter,
    jurisdiction: document.jurisdiction,
    officialUrl: document.officialUrl,
    status,
    message,
    previousHash: document.currentHash,
    newHash: metadata.hash,
    etag: metadata.etag,
    lastModified: metadata.lastModified,
    fileSize: metadata.fileSize,
    httpStatus: metadata.httpStatus,
  };
}

async function persistError(document: MonitorableDocument, result: LegalDocumentMonitorResult) {
  if (!document.id) return;

  await prisma.document.update({
    where: { id: document.id },
    data: {
      lastCheckedAt: new Date(),
      lastError: result.message,
      monitoringStatus: result.status,
      etag: result.etag,
      lastModified: result.lastModified,
      fileSize: result.fileSize,
    },
  });
}

async function persistUnchanged(document: MonitorableDocument, result: LegalDocumentMonitorResult) {
  if (!document.id) return;

  await prisma.document.update({
    where: { id: document.id },
    data: {
      lastCheckedAt: new Date(),
      lastError: null,
      monitoringStatus: "unchanged",
      etag: result.etag,
      lastModified: result.lastModified,
      fileSize: result.fileSize,
      currentHash: result.newHash,
      latestVersionHash: result.newHash,
      changeSummary: "Sin cambios detectados en la fuente oficial durante la ultima revision.",
    },
  });
}

async function nextVersionNumber(documentId: string) {
  const current = await prisma.documentVersion.aggregate({
    where: { documentId },
    _max: { versionNumber: true },
  });

  return (current._max.versionNumber || 0) + 1;
}

async function persistBaseline(document: MonitorableDocument, result: LegalDocumentMonitorResult) {
  if (!document.id || !result.newHash) return;

  const versionNumber = await nextVersionNumber(document.id);

  await prisma.documentVersion.create({
    data: {
      documentId: document.id,
      versionNumber,
      versionLabel: `linea-base-${new Date().toISOString().slice(0, 10)}`,
      contentHash: result.newHash,
      rawRef: document.officialUrl,
      rawText: null,
      originalText: null,
      diffSummary: {
        tipo: "linea_base",
        descripcion: "Linea base registrada para futuras comparaciones.",
      },
      etag: result.etag,
      lastModified: result.lastModified,
      fileSize: result.fileSize,
      sourceUrl: document.officialUrl,
      metadata: {
        shortCode: document.shortCode,
        matter: document.matter,
        jurisdiction: document.jurisdiction,
      },
    },
  });

  await prisma.document.update({
    where: { id: document.id },
    data: {
      hasVersions: true,
      latestVersionHash: result.newHash,
      currentHash: result.newHash,
      etag: result.etag,
      lastModified: result.lastModified,
      fileSize: result.fileSize,
      lastCheckedAt: new Date(),
      lastError: null,
      monitoringStatus: "unchanged",
      changeSummary: "Linea base registrada para futuras comparaciones.",
    },
  });
}

async function persistChange(document: MonitorableDocument, result: LegalDocumentMonitorResult) {
  if (!document.id || !result.newHash) return;

  const versionNumber = await nextVersionNumber(document.id);
  const description = `Se detecto un cambio en ${document.title}. Verificar el documento oficial antes de usarlo en un asunto.`;

  const version = await prisma.documentVersion.create({
    data: {
      documentId: document.id,
      versionNumber,
      versionLabel: `cambio-${new Date().toISOString().slice(0, 10)}`,
      contentHash: result.newHash,
      rawRef: document.officialUrl,
      rawText: null,
      originalText: null,
      diffSummary: {
        tipo: "cambio_detectado",
        descripcion: description,
      },
      etag: result.etag,
      lastModified: result.lastModified,
      fileSize: result.fileSize,
      sourceUrl: document.officialUrl,
      metadata: {
        previousHash: result.previousHash,
        newHash: result.newHash,
        shortCode: document.shortCode,
      },
    },
  });

  await prisma.documentChange.create({
    data: {
      documentVersionId: version.id,
      changeType: "modified",
      before: null,
      after: null,
      changeDescription: description,
      sourceUrl: document.officialUrl,
      previousHash: result.previousHash,
      newHash: result.newHash,
      priority: "alta",
      reviewStatus: "nueva",
      matter: document.matter,
      jurisdiction: document.jurisdiction,
    },
  });

  await prisma.document.update({
    where: { id: document.id },
    data: {
      hasVersions: true,
      latestVersionHash: result.newHash,
      currentHash: result.newHash,
      etag: result.etag,
      lastModified: result.lastModified,
      fileSize: result.fileSize,
      lastCheckedAt: new Date(),
      lastError: null,
      monitoringStatus: "changed",
      changeSummary: description,
    },
  });
}

async function monitorOneDocument(
  document: MonitorableDocument,
  options: RunLegalDocumentMonitorOptions,
): Promise<LegalDocumentMonitorResult> {
  const metadata = await fetchRemoteDocumentMetadata(document.officialUrl, options.timeoutMs);

  if (!metadata.ok) {
    const result = buildResult(
      document,
      metadata.blocked ? "blocked" : "error",
      metadata,
      metadata.error || "No fue posible revisar la fuente oficial.",
    );

    if (options.dryRun) {
      return result;
    }

    await persistError(document, result);
    return result;
  }

  if (!document.currentHash) {
    const result = buildResult(
      document,
      "baseline",
      metadata,
      "Linea base pendiente de registrar; no se considera reforma detectada.",
    );

    if (options.dryRun) {
      return result;
    }

    await persistBaseline(document, result);
    return result;
  }

  if (document.currentHash === metadata.hash) {
    const result = buildResult(document, "unchanged", metadata, "Sin cambios detectados en la fuente oficial.");

    if (options.dryRun) {
      return result;
    }

    await persistUnchanged(document, result);
    return result;
  }

  const result = buildResult(
    document,
    "changed",
    metadata,
    "Cambio detectado en la fuente oficial. Requiere revision profesional.",
  );

  if (options.dryRun) {
    return result;
  }

  await persistChange(document, result);
  return result;
}

function summarize(options: RunLegalDocumentMonitorOptions, results: LegalDocumentMonitorResult[]): LegalDocumentMonitorSummary {
  return {
    dryRun: options.dryRun,
    reviewed: results.length,
    unchanged: results.filter((result) => result.status === "unchanged").length,
    changed: results.filter((result) => result.status === "changed").length,
    baselines: results.filter((result) => result.status === "baseline").length,
    errors: results.filter((result) => result.status === "error").length,
    blocked: results.filter((result) => result.status === "blocked").length,
    results,
  };
}

export async function runLegalDocumentMonitor(
  options: RunLegalDocumentMonitorOptions,
): Promise<LegalDocumentMonitorSummary> {
  const documents = await loadDocuments(options);
  const results: LegalDocumentMonitorResult[] = [];

  for (const document of documents) {
    results.push(await monitorOneDocument(document, options));
  }

  return summarize(options, results);
}

export function serializeMonitorResult(result: LegalDocumentMonitorResult) {
  return {
    ...result,
    lastModified: result.lastModified?.toISOString() ?? null,
    fileSize: result.fileSize?.toString() ?? null,
  };
}

export function serializeMonitorSummary(summary: LegalDocumentMonitorSummary) {
  return {
    ...summary,
    results: summary.results.map(serializeMonitorResult),
  };
}
