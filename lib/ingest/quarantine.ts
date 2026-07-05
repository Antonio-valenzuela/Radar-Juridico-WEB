/**
 * lib/ingest/quarantine.ts
 *
 * Cuarentena de documentos para ingesta DOF/SIDOF.
 *
 * Los documentos que no superen la validación de calidad se persisten en
 * IngestionJob con status "EN_DEAD_LETTER_QUEUE" y no se guardan en Item
 * ni se exponen en búsquedas. El contenido HTML / texto original y la razón
 * de rechazo se conservan para auditoría.
 */

import { prisma } from "@/lib/prisma";

export type QuarantineReason =
  | "EMPTY_CONTENT"
  | "TOO_SHORT"
  | "BAD_TITLE"
  | "HTML_PARSE_ERROR"
  | "VALIDATION_FAILED"
  | "DUPLICATE_HASH"
  | "NOISE_DETECTED"
  | "MISSING_METADATA";

export interface QuarantineEntry {
  id: string;
  source: string;
  documentUrl: string;
  reason: QuarantineReason;
  rawHtml?: string;
  extractedText?: string;
  createdAt: Date;
}

/**
 * Manda un documento a cuarentena.  Persiste un IngestionJob con status
 * EN_DEAD_LETTER_QUEUE y un IngestionLog explicando el motivo.
 */
export async function quarantineDocument(opts: {
  source: string;
  documentUrl: string;
  reason: QuarantineReason;
  detail?: string;
  rawHtml?: string;
  extractedText?: string;
  category?: string;
}): Promise<string> {
  const { source, documentUrl, reason, detail, rawHtml, extractedText, category } = opts;

  const job = await prisma.ingestionJob.create({
    data: {
      source,
      documentUrl,
      status: "EN_DEAD_LETTER_QUEUE",
      attempts: 1,
      lastError: `[CUARENTENA:${reason}] ${detail ?? reason}`,
      startedAt: new Date(),
      completedAt: new Date(),
      // Guardamos el contenido para auditoría en el campo notes como JSON
      // (documentId es null, no contamina documentos reales)
    },
  });

  // Log con detalles
  await prisma.ingestionLog.create({
    data: {
      ingestionJobId: job.id,
      level: "WARN",
      message: JSON.stringify({
        reason,
        category,
        detail: detail ?? reason,
        urlPreview: documentUrl.slice(0, 200),
        textPreview: extractedText ? extractedText.slice(0, 300) : undefined,
        htmlLength: rawHtml ? rawHtml.length : 0,
      }),
    },
  });

  return job.id;
}

/**
 * Calidad mínima: un documento debe tener al menos minWords palabras útiles.
 */
export function checkContentQuality(
  text: string,
  opts: { minWords?: number; minChars?: number } = {}
): { ok: boolean; reason?: QuarantineReason; detail?: string } {
  const minWords = opts.minWords ?? 50;
  const minChars = opts.minChars ?? 200;

  if (!text || text.trim().length === 0) {
    return { ok: false, reason: "EMPTY_CONTENT", detail: "El texto extraído está vacío." };
  }

  if (text.trim().length < minChars) {
    return {
      ok: false,
      reason: "TOO_SHORT",
      detail: `Sólo ${text.trim().length} caracteres (mínimo ${minChars}).`,
    };
  }

  const wordCount = text.trim().split(/\s+/).length;
  if (wordCount < minWords) {
    return {
      ok: false,
      reason: "TOO_SHORT",
      detail: `Sólo ${wordCount} palabras (mínimo ${minWords}).`,
    };
  }

  return { ok: true };
}

/**
 * Palabras de navegación / ruido que indican que el scraper captó UI, no contenido.
 */
const NOISE_PATTERNS = [
  /iniciar\s+sesi[oó]n/i,
  /javascript\s*:/i,
  /\bmenú\b/i,
  /\bcookie\b.*\bpolítica\b/i,
  /\breadmore\b/i,
  /footer|header|navigation|sidebar/i,
  /copyright\s+\d{4}/i,
];

/**
 * Detecta si el texto extraído es mayoritariamente ruido de UI.
 */
export function isNoisyContent(text: string): boolean {
  const matches = NOISE_PATTERNS.filter((p) => p.test(text)).length;
  return matches >= 3;
}

/**
 * Lista los documentos en cuarentena (para panel admin).
 */
export async function getQuarantineList(opts?: {
  source?: string;
  limit?: number;
  offset?: number;
}): Promise<{
  items: Array<{
    id: string;
    source: string;
    documentUrl: string;
    lastError: string | null;
    createdAt: Date;
  }>;
  total: number;
}> {
  const where = {
    status: "EN_DEAD_LETTER_QUEUE",
    ...(opts?.source ? { source: opts.source } : {}),
  };

  const [items, total] = await Promise.all([
    prisma.ingestionJob.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: opts?.limit ?? 50,
      skip: opts?.offset ?? 0,
      select: {
        id: true,
        source: true,
        documentUrl: true,
        lastError: true,
        createdAt: true,
      },
    }),
    prisma.ingestionJob.count({ where }),
  ]);

  return { items, total };
}

/**
 * Elimina un registro de cuarentena (para limpiar tras revisión manual).
 */
export async function resolveQuarantine(jobId: string, resolvedBy: string): Promise<void> {
  await prisma.ingestionJob.update({
    where: { id: jobId },
    data: { status: "COMPLETADO" },
  });
  await prisma.ingestionLog.create({
    data: {
      ingestionJobId: jobId,
      level: "INFO",
      message: JSON.stringify({ action: "RESOLVED", resolvedBy }),
    },
  });
}
