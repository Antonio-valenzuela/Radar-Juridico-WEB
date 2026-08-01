import type {
  BulletinEvidenceOrigin,
  BulletinPublicationStatus,
  BulletinQueryStatus,
} from '@/lib/bulletins/types';

const MAX_SNAPSHOT_CHARS = 2_000;
const SENSITIVE_KEY = /authorization|cookie|csrf|token|password|secret|firma|firel|certificate|credential|session|api[-_]?key|signature/i;

export type BulletinEvidence = {
  provider: string;
  sourceUrl: string;
  requestParams: Record<string, string>;
  checkedAt: string;
  httpStatus: number | null;
  contentType: string | null;
  responseHash: string | null;
  adapterVersion: string;
  durationMs: number | null;
  queryStatus: BulletinQueryStatus;
  publicationStatus: BulletinPublicationStatus;
  origin: BulletinEvidenceOrigin;
  responseSnapshot: string | null;
  warnings: string[];
};

export function sanitizeBulletinUrl(value: string) {
  try {
    const url = new URL(value);
    if (url.username) url.username = '[REDACTED]';
    if (url.password) url.password = '[REDACTED]';
    for (const key of [...url.searchParams.keys()]) {
      if (SENSITIVE_KEY.test(key)) url.searchParams.set(key, '[REDACTED]');
    }
    url.hash = '';
    return url.toString();
  } catch {
    return value.slice(0, 2_000);
  }
}

function sanitizeSnapshot(value?: string | null) {
  if (!value) return null;
  return value
    .replace(/(authorization|cookie|csrf(?:token)?|token|password|secret)\s*[:=]\s*[^\s,;&]+/gi, '$1=[REDACTED]')
    .slice(0, MAX_SNAPSHOT_CHARS);
}

export function buildBulletinEvidence(input: {
  provider: string;
  sourceUrl: string;
  requestParams?: Record<string, string>;
  checkedAt?: Date;
  httpStatus?: number | null;
  contentType?: string | null;
  responseHash?: string | null;
  adapterVersion: string;
  durationMs?: number | null;
  queryStatus: BulletinQueryStatus;
  publicationStatus: BulletinPublicationStatus;
  origin?: BulletinEvidenceOrigin;
  responseSnapshot?: string | null;
  warnings?: string[];
}): BulletinEvidence {
  const requestParams = Object.fromEntries(
    Object.entries(input.requestParams || {})
      .filter(([key]) => !SENSITIVE_KEY.test(key))
      .map(([key, value]) => [key.slice(0, 100), String(value).slice(0, 500)]),
  );
  return {
    provider: input.provider.slice(0, 100),
    sourceUrl: sanitizeBulletinUrl(input.sourceUrl),
    requestParams,
    checkedAt: (input.checkedAt || new Date()).toISOString(),
    httpStatus: input.httpStatus ?? null,
    contentType: input.contentType?.slice(0, 200) || null,
    responseHash: input.responseHash?.slice(0, 128) || null,
    adapterVersion: input.adapterVersion.slice(0, 50),
    durationMs: input.durationMs ?? null,
    queryStatus: input.queryStatus,
    publicationStatus: input.publicationStatus,
    origin: input.origin || 'OFFICIAL_PUBLIC_SOURCE',
    responseSnapshot: sanitizeSnapshot(input.responseSnapshot),
    warnings: (input.warnings || []).map((warning) => warning.slice(0, 500)).slice(0, 20),
  };
}
