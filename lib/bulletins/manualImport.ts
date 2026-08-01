import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { load } from 'cheerio';

import { prisma as defaultPrisma } from '@/lib/prisma';
import { buildBulletinDedupeKey, hashBulletinEntryContent } from '@/lib/bulletins/dedupe';
import { sanitizeBulletinUrl } from '@/lib/bulletins/evidence';
import { runBulletinCheck } from '@/lib/bulletins/service';
import type { BulletinAdapterResult } from '@/lib/bulletins/types';
import {
  safeFetch as defaultSafeFetch,
  validatePublicHttpUrl,
} from '@/lib/security/urlValidation';

export const MANUAL_BULLETIN_LIMITS = {
  textBytes: 2 * 1024 * 1024,
  pdfBytes: 15 * 1024 * 1024,
  urlBytes: 5 * 1024 * 1024,
  extractionTimeoutMs: 30_000,
  extractChars: 10_000,
} as const;

const MANUAL_PREVIEW_TTL_MS = 10 * 60 * 1_000;

export type ManualBulletinOrigin = 'MANUAL_TEXT' | 'MANUAL_URL' | 'MANUAL_PDF';
export type ManualBulletinMode = 'preview' | 'confirm';

type ManualBulletinInputBase = {
  mode: ManualBulletinMode;
  previewToken?: string;
};

export type ManualBulletinInput =
  | (ManualBulletinInputBase & { type: 'text'; text: string })
  | (ManualBulletinInputBase & { type: 'url'; url: string })
  | {
      type: 'pdf';
      mode: ManualBulletinMode;
      previewToken?: string;
      bytes: Uint8Array;
      mimeType: string;
      filename?: string;
    };

export type ManualBulletinAccess = {
  organizationId: string;
  userId?: string | null;
};

type BulletinWatch = {
  id: string;
  matterId: string;
  sourceId: string;
  expedienteNumber: string;
  expedienteYear?: number | null;
  matterLabel?: string | null;
  judicialDistrict?: string | null;
  court?: string | null;
  chamber?: string | null;
  source?: { id?: string; slug?: string; baseUrl?: string | null } | null;
};

type ManualImportPrisma = {
  caseBulletinWatch: {
    findMany(args: unknown): Promise<BulletinWatch[]>;
  };
  judicialBulletinEntry: {
    findUnique(args: unknown): Promise<{ id: string; matterLinks?: Array<{ matterId: string }> } | null>;
  };
  auditLog?: {
    create(args: { data: Record<string, unknown> }): Promise<unknown>;
  };
};

export type ManualBulletinImportDeps = {
  prisma?: ManualImportPrisma;
  safeFetch?: typeof defaultSafeFetch;
  parsePdf?: (bytes: Uint8Array) => Promise<string>;
  persistMatch?: (watch: BulletinWatch, result: BulletinAdapterResult, access: ManualBulletinAccess) => Promise<{ newResults: number }>;
  now?: () => Date;
  previewSecret?: string;
};

export type DetectedManualBulletinPublication = {
  expedienteNumber: string;
  expedienteYear: number;
  heading: string;
  extract: string;
  contentHash: string;
};

export class ManualBulletinImportError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(code: string, message: string, status = 400) {
    super(message);
    this.name = 'ManualBulletinImportError';
    this.code = code;
    this.status = status;
  }
}

const EXPEDIENTE_PATTERN = /(?<![A-Z0-9/.-])(?:(?:EXP(?:EDIENTE)?\.?|TOCA|AMPARO)\s*(?:N(?:Ú|U)M(?:ERO)?\.?)?\s*[:#-]?\s*)?([A-Z0-9]{1,20})\s*[/-]\s*((?:19|20|21)\d{2})(?!\d)/giu;

function sha256(value: string) {
  return createHash('sha256').update(value).digest('hex');
}

type PreviewTokenPayload = {
  v: 1;
  organizationId: string;
  fingerprint: string;
  expiresAt: number;
};

function previewSigningSecret(deps: ManualBulletinImportDeps) {
  const secret = deps.previewSecret?.trim() || process.env.ADMIN_TOKEN?.trim();
  if (!secret) {
    throw new ManualBulletinImportError(
      'PREVIEW_SIGNING_UNAVAILABLE',
      'La confirmación de importaciones no está disponible temporalmente.',
      503,
    );
  }
  return secret;
}

function signPreviewToken(payload: PreviewTokenPayload, secret: string) {
  const encoded = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const signature = createHmac('sha256', secret).update(encoded).digest('base64url');
  return `${encoded}.${signature}`;
}

function verifyPreviewToken(input: {
  token?: string;
  secret: string;
  organizationId: string;
  fingerprint: string;
  now: Date;
}) {
  if (!input.token?.trim()) {
    throw new ManualBulletinImportError(
      'PREVIEW_REQUIRED',
      'Genera y revisa una vista previa antes de confirmar la importación.',
      409,
    );
  }

  const [encoded, providedSignature, extra] = input.token.split('.');
  if (!encoded || !providedSignature || extra) {
    throw new ManualBulletinImportError('INVALID_PREVIEW_TOKEN', 'La vista previa ya no es válida.', 409);
  }
  const expectedSignature = createHmac('sha256', input.secret).update(encoded).digest();
  let receivedSignature: Buffer;
  try {
    receivedSignature = Buffer.from(providedSignature, 'base64url');
  } catch {
    throw new ManualBulletinImportError('INVALID_PREVIEW_TOKEN', 'La vista previa ya no es válida.', 409);
  }
  if (receivedSignature.length !== expectedSignature.length
    || !timingSafeEqual(receivedSignature, expectedSignature)) {
    throw new ManualBulletinImportError('INVALID_PREVIEW_TOKEN', 'La vista previa ya no es válida.', 409);
  }

  let payload: PreviewTokenPayload;
  try {
    payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as PreviewTokenPayload;
  } catch {
    throw new ManualBulletinImportError('INVALID_PREVIEW_TOKEN', 'La vista previa ya no es válida.', 409);
  }
  if (payload.v !== 1 || payload.organizationId !== input.organizationId) {
    throw new ManualBulletinImportError('INVALID_PREVIEW_TOKEN', 'La vista previa no pertenece a esta organización.', 409);
  }
  if (!Number.isFinite(payload.expiresAt) || payload.expiresAt < input.now.getTime()) {
    throw new ManualBulletinImportError('PREVIEW_EXPIRED', 'La vista previa expiró. Genera una nueva.', 409);
  }
  if (payload.fingerprint !== input.fingerprint) {
    throw new ManualBulletinImportError(
      'PREVIEW_MISMATCH',
      'El contenido cambió después de la vista previa. Genera una nueva antes de confirmar.',
      409,
    );
  }
}

function utf8Bytes(value: string) {
  return Buffer.byteLength(value, 'utf8');
}

function cleanText(value: string) {
  return value
    .replace(/\0/g, '')
    .replace(/\r\n?/g, '\n')
    .replace(/[\t\f\v]+/g, ' ')
    .replace(/[ ]{2,}/g, ' ')
    .trim();
}

function normalizeCasePart(value: string) {
  const compact = value.replace(/[^A-Z0-9]/gi, '').toUpperCase();
  if (!compact) return null;
  if (/^\d+$/.test(compact)) return String(Number(compact));
  return compact;
}

export function normalizeExpedienteNumber(value: string): string | null {
  const normalized = cleanText(String(value || ''));
  EXPEDIENTE_PATTERN.lastIndex = 0;
  const match = EXPEDIENTE_PATTERN.exec(normalized);
  EXPEDIENTE_PATTERN.lastIndex = 0;
  if (!match) return null;
  const casePart = normalizeCasePart(match[1]);
  return casePart ? `${casePart}/${match[2]}` : null;
}

export function detectManualBulletinPublications(
  input: string,
): DetectedManualBulletinPublication[] {
  const normalized = cleanText(input);
  if (!normalized) return [];

  const blocks = normalized
    .split(/\n\s*\n+/)
    .map((block) => block.trim())
    .filter(Boolean);
  const publications: DetectedManualBulletinPublication[] = [];
  const seen = new Set<string>();

  for (const block of blocks) {
    EXPEDIENTE_PATTERN.lastIndex = 0;
    const matches = [...block.matchAll(EXPEDIENTE_PATTERN)];
    EXPEDIENTE_PATTERN.lastIndex = 0;
    for (const match of matches) {
      const casePart = normalizeCasePart(match[1]);
      if (!casePart) continue;
      const expedienteNumber = `${casePart}/${match[2]}`;
      const extract = block.slice(0, MANUAL_BULLETIN_LIMITS.extractChars);
      const contentHash = sha256(`${expedienteNumber}|${extract}`);
      const uniqueKey = `${expedienteNumber}|${contentHash}`;
      if (seen.has(uniqueKey)) continue;
      seen.add(uniqueKey);
      publications.push({
        expedienteNumber,
        expedienteYear: Number(match[2]),
        heading: (block.split('\n').find(Boolean) || `Expediente ${expedienteNumber}`).slice(0, 500),
        extract,
        contentHash,
      });
    }
  }

  return publications;
}

async function parsePdfWithPdfParse(bytes: Uint8Array) {
  const { PDFParse } = await import('pdf-parse');
  const parser = new PDFParse({ data: bytes });
  try {
    const result = await parser.getText();
    return result.text;
  } finally {
    await parser.destroy();
  }
}

async function withExtractionTimeout<T>(operation: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      operation,
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(
          () => reject(new ManualBulletinImportError('EXTRACTION_TIMEOUT', 'La extracción excedió el tiempo permitido.', 504)),
          MANUAL_BULLETIN_LIMITS.extractionTimeoutMs,
        );
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function ensureTextSize(text: string) {
  if (utf8Bytes(text) > MANUAL_BULLETIN_LIMITS.textBytes) {
    throw new ManualBulletinImportError(
      'PAYLOAD_TOO_LARGE',
      `El texto excede el límite de ${MANUAL_BULLETIN_LIMITS.textBytes} bytes.`,
      413,
    );
  }
}

function ensurePdfInput(input: Extract<ManualBulletinInput, { type: 'pdf' }>) {
  const mimeType = input.mimeType.split(';', 1)[0].trim().toLowerCase();
  if (mimeType !== 'application/pdf') {
    throw new ManualBulletinImportError('UNSUPPORTED_MIME', 'Sólo se aceptan archivos application/pdf.', 415);
  }
  if (input.bytes.byteLength > MANUAL_BULLETIN_LIMITS.pdfBytes) {
    throw new ManualBulletinImportError(
      'PAYLOAD_TOO_LARGE',
      `El PDF excede el límite de ${MANUAL_BULLETIN_LIMITS.pdfBytes} bytes.`,
      413,
    );
  }
  ensurePdfSignature(input.bytes);
}

function ensurePdfSignature(bytes: Uint8Array) {
  const signature = [0x25, 0x50, 0x44, 0x46, 0x2d];
  if (bytes.byteLength < signature.length || signature.some((byte, index) => bytes[index] !== byte)) {
    throw new ManualBulletinImportError(
      'INVALID_PDF',
      'El archivo no contiene una firma PDF válida.',
      422,
    );
  }
}

function htmlToText(html: string) {
  const $ = load(html);
  $('script, style, nav, header, footer, form, iframe, noscript').remove();
  return $.root().text().replace(/\s+/g, ' ').trim();
}

async function readUrlInput(
  url: string,
  fetchSafe: typeof defaultSafeFetch,
  parsePdf: (bytes: Uint8Array) => Promise<string>,
) {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new ManualBulletinImportError('INVALID_URL', 'La URL no es válida.');
  }
  if (parsed.protocol !== 'https:') {
    throw new ManualBulletinImportError('URL_NOT_HTTPS', 'La importación sólo acepta URLs HTTPS públicas.');
  }
  const validation = validatePublicHttpUrl(parsed.toString());
  if (!validation.ok) {
    throw new ManualBulletinImportError('URL_BLOCKED', `URL bloqueada: ${validation.reason}`);
  }

  let response: Response;
  try {
    response = await fetchSafe(validation.url, {
      cache: 'no-store',
      headers: {
        Accept: 'application/pdf,text/plain,text/html;q=0.9',
        'User-Agent': 'JuridicoRadar/1.0 (importación manual de boletín)',
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const timeout = /abort|timeout|tiempo/i.test(message);
    throw new ManualBulletinImportError(
      timeout ? 'SOURCE_TIMEOUT' : 'SOURCE_UNAVAILABLE',
      timeout ? 'La fuente excedió el tiempo permitido.' : 'No fue posible descargar la URL pública.',
      timeout ? 504 : 502,
    );
  }
  if (!response.ok) {
    throw new ManualBulletinImportError('SOURCE_HTTP_ERROR', `La fuente respondió HTTP ${response.status}.`, 502);
  }

  const declaredLength = Number(response.headers.get('content-length') || 0);
  if (declaredLength > MANUAL_BULLETIN_LIMITS.urlBytes) {
    throw new ManualBulletinImportError('PAYLOAD_TOO_LARGE', 'La respuesta excede el límite permitido.', 413);
  }
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength > MANUAL_BULLETIN_LIMITS.urlBytes) {
    throw new ManualBulletinImportError('PAYLOAD_TOO_LARGE', 'La respuesta excede el límite permitido.', 413);
  }

  const mimeType = (response.headers.get('content-type') || '').split(';', 1)[0].trim().toLowerCase();
  if (mimeType === 'application/pdf') {
    ensurePdfSignature(bytes);
    return cleanText(await withExtractionTimeout(parsePdf(bytes)));
  }
  if (mimeType === 'text/plain') return cleanText(new TextDecoder('utf-8').decode(bytes));
  if (mimeType === 'text/html') return cleanText(htmlToText(new TextDecoder('utf-8').decode(bytes)));
  throw new ManualBulletinImportError(
    'UNSUPPORTED_MIME',
    `Content-Type no permitido: ${mimeType || 'desconocido'}.`,
    415,
  );
}

function watchExpediente(watch: BulletinWatch) {
  const direct = normalizeExpedienteNumber(watch.expedienteNumber);
  if (direct) return direct;
  if (!watch.expedienteYear) return null;
  return normalizeExpedienteNumber(`${watch.expedienteNumber}/${watch.expedienteYear}`);
}

function manualDedupeKey(
  watch: BulletinWatch,
  publication: DetectedManualBulletinPublication,
) {
  const contentHash = hashBulletinEntryContent({
    expedienteNumber: publication.expedienteNumber,
    court: watch.court,
    publicationDate: null,
    agreementDate: null,
    heading: publication.heading,
    extract: publication.extract,
  });
  return buildBulletinDedupeKey({
    sourceId: watch.sourceId,
    court: watch.court,
    expedienteNumber: publication.expedienteNumber,
    publicationDate: null,
    agreementDate: null,
    contentHash,
  });
}

export async function importManualBulletin(
  input: ManualBulletinInput,
  access: ManualBulletinAccess,
  deps: ManualBulletinImportDeps = {},
) {
  if (input.mode !== 'preview' && input.mode !== 'confirm') {
    throw new ManualBulletinImportError('INVALID_MODE', 'El modo debe ser preview o confirm.');
  }
  if (input.mode === 'confirm' && !input.previewToken?.trim()) {
    throw new ManualBulletinImportError(
      'PREVIEW_REQUIRED',
      'Genera y revisa una vista previa antes de confirmar la importación.',
      409,
    );
  }

  const db = deps.prisma || (defaultPrisma as unknown as ManualImportPrisma);
  const fetchSafe = deps.safeFetch || defaultSafeFetch;
  const parsePdf = deps.parsePdf || parsePdfWithPdfParse;
  const persistMatch = deps.persistMatch || (async (watch: BulletinWatch, result: BulletinAdapterResult, importAccess: ManualBulletinAccess) => runBulletinCheck({
    matterId: watch.matterId,
    sourceId: watch.sourceId,
    watchId: watch.id,
    query: {
      sourceSlug: watch.source?.slug || 'manual_import',
      expedienteNumber: watch.expedienteNumber,
      expedienteYear: watch.expedienteYear || undefined,
      matter: watch.matterLabel || undefined,
      judicialDistrict: watch.judicialDistrict || undefined,
      court: watch.court || undefined,
      chamber: watch.chamber || undefined,
    },
    access: importAccess,
    adapterResult: result,
  }));
  const now = deps.now || (() => new Date());
  let origin: ManualBulletinOrigin;
  let sourceUrl: string;
  let sourceIdentity: string;
  let filename: string | undefined;
  let text: string;

  if (input.type === 'text') {
    origin = 'MANUAL_TEXT';
    sourceUrl = 'urn:juridico-radar:manual:text';
    ensureTextSize(input.text);
    text = cleanText(input.text);
    sourceIdentity = sha256(text);
  } else if (input.type === 'pdf') {
    origin = 'MANUAL_PDF';
    filename = input.filename?.slice(0, 240);
    sourceUrl = `urn:juridico-radar:manual:pdf:${encodeURIComponent(filename || 'boletin.pdf')}`;
    ensurePdfInput(input);
    text = cleanText(await withExtractionTimeout(parsePdf(input.bytes)));
    sourceIdentity = sha256(Buffer.from(input.bytes).toString('base64'));
  } else {
    origin = 'MANUAL_URL';
    sourceUrl = sanitizeBulletinUrl(input.url);
    sourceIdentity = sha256(input.url);
    text = await readUrlInput(input.url, fetchSafe, parsePdf);
  }

  if (!text) {
    throw new ManualBulletinImportError('NO_EXTRACTABLE_TEXT', 'No se encontró texto extraíble.', 422);
  }
  ensureTextSize(text);

  const tokenNow = now();
  const previewFingerprint = sha256(JSON.stringify({
    v: 1,
    organizationId: access.organizationId,
    origin,
    sourceIdentity,
    textHash: sha256(text),
  }));
  const signingSecret = previewSigningSecret(deps);
  if (input.mode === 'confirm') {
    verifyPreviewToken({
      token: input.previewToken,
      secret: signingSecret,
      organizationId: access.organizationId,
      fingerprint: previewFingerprint,
      now: tokenNow,
    });
  }
  const previewExpiresAt = input.mode === 'preview'
    ? new Date(tokenNow.getTime() + MANUAL_PREVIEW_TTL_MS)
    : null;
  const previewToken = previewExpiresAt
    ? signPreviewToken({
        v: 1,
        organizationId: access.organizationId,
        fingerprint: previewFingerprint,
        expiresAt: previewExpiresAt.getTime(),
      }, signingSecret)
    : undefined;

  const publications = detectManualBulletinPublications(text);
  const watches = await db.caseBulletinWatch.findMany({
    where: {
      active: true,
      matter: { organizationId: access.organizationId },
    },
    include: {
      source: { select: { id: true, slug: true, baseUrl: true } },
    },
  });
  const watchesByExpediente = new Map<string, BulletinWatch[]>();
  for (const watch of watches) {
    const normalized = watchExpediente(watch);
    if (!normalized) continue;
    const current = watchesByExpediente.get(normalized) || [];
    current.push(watch);
    watchesByExpediente.set(normalized, current);
  }

  let duplicates = 0;
  let newPublications = 0;
  let saved = 0;
  const matchedWatchIds = new Set<string>();
  const outputPublications = [];

  for (const publication of publications) {
    const matchingWatches = watchesByExpediente.get(publication.expedienteNumber) || [];
    const matches = [];
    for (const watch of matchingWatches) {
      matchedWatchIds.add(watch.id);
      const dedupeKey = manualDedupeKey(watch, publication);
      const existing = await db.judicialBulletinEntry.findUnique({
        where: { dedupeKey },
        select: {
          id: true,
          matterLinks: { where: { matterId: watch.matterId }, select: { matterId: true }, take: 1 },
        },
      });
      let duplicateForMatter = Boolean(existing?.matterLinks?.some((link) => link.matterId === watch.matterId));
      if (input.mode === 'confirm') {
        const checkedAt = now();
        const adapterResult: BulletinAdapterResult = {
          status: 'PUBLISHED',
          queryStatus: 'SUCCESS',
          publicationStatus: 'NEW_PUBLICATIONS',
          checkedAt,
          sourceUrl,
          results: [{
            externalId: `manual:${publication.contentHash}`,
            expedienteNumber: publication.expedienteNumber,
            expedienteYear: publication.expedienteYear,
            matter: watch.matterLabel || null,
            judicialDistrict: watch.judicialDistrict || null,
            court: watch.court || null,
            chamber: watch.chamber || null,
            publicationDate: null,
            agreementDate: null,
            heading: publication.heading,
            extract: publication.extract,
            sourceUrl,
            evidenceKind: 'manual_import',
            raw: { origin, importedAt: checkedAt.toISOString(), filename: filename || null, sourceUrl },
          }],
          warnings: ['Importación manual: requiere revisión profesional contra la fuente oficial.'],
          responseHash: publication.contentHash,
          contentType: input.type === 'pdf' ? 'application/pdf' : input.type === 'url' ? null : 'text/plain',
          adapterVersion: 'manual-import/1.0.0',
          origin,
          responseSnapshot: publication.extract.slice(0, 2_000),
        };
        const persisted = await persistMatch(watch, adapterResult, access);
        saved += persisted.newResults;
        duplicateForMatter = persisted.newResults === 0;
      }
      if (duplicateForMatter) duplicates += 1;
      else newPublications += 1;
      matches.push({
        watchId: watch.id,
        matterId: watch.matterId,
        sourceId: watch.sourceId,
        duplicate: duplicateForMatter,
        ...(existing ? { entryId: existing.id } : {}),
      });
    }
    outputPublications.push({ ...publication, matches });
  }

  const unmatched = outputPublications.filter((publication) => publication.matches.length === 0).length;
  if (input.mode === 'confirm' && saved > 0 && db.auditLog) {
    await db.auditLog.create({
      data: {
        organizationId: access.organizationId,
        userId: access.userId || null,
        action: 'bulletin.manual_import',
        entityType: 'JudicialBulletinEntry',
        entityId: null,
        metadata: {
          origin,
          sourceUrl,
          filename: filename || null,
          publicationsAnalyzed: publications.length,
          watchedCasesFound: matchedWatchIds.size,
          duplicates,
          saved,
        },
      },
    });
  }

  return {
    ok: true as const,
    mode: input.mode,
    origin,
    sourceUrl,
    publicationsAnalyzed: publications.length,
    watchedCasesFound: matchedWatchIds.size,
    newPublications,
    duplicates,
    unmatched,
    saved,
    previewToken,
    previewExpiresAt: previewExpiresAt?.toISOString(),
    publications: outputPublications,
  };
}
