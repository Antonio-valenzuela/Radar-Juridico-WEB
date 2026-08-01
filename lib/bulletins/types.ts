import { z } from 'zod';

export const BULLETIN_STATUSES = [
  'PUBLISHED',
  'NOT_FOUND_AS_OF',
  'SOURCE_UNAVAILABLE',
  'SOURCE_CHANGED',
  'AUTH_REQUIRED',
  'INVALID_QUERY',
  'PENDING_RETRY',
  'MANUAL_REVIEW',
  'UNSUPPORTED',
] as const;

export type BulletinStatus = (typeof BULLETIN_STATUSES)[number];

export const BULLETIN_QUERY_STATUSES = [
  'SUCCESS',
  'SOURCE_UNAVAILABLE',
  'SOURCE_CHANGED',
  'TIMEOUT',
  'RATE_LIMITED',
  'AUTH_REQUIRED',
  'CAPTCHA_REQUIRED',
  'MANUAL_REVIEW',
  'PROVIDER_ERROR',
  'INVALID_QUERY',
  'UNSUPPORTED',
] as const;

export type BulletinQueryStatus = (typeof BULLETIN_QUERY_STATUSES)[number];

export const BULLETIN_PUBLICATION_STATUSES = [
  'NEW_PUBLICATIONS',
  'HAS_PREVIOUS_PUBLICATIONS',
  'NO_PUBLICATION_FOUND_AS_OF',
  'CASE_EXISTS_NOT_BULLETIN_CONFIRMED',
  'CASE_NOT_CONFIGURED',
  'INVALID_CASE_CONFIGURATION',
  'UNKNOWN',
] as const;

export type BulletinPublicationStatus = (typeof BULLETIN_PUBLICATION_STATUSES)[number];

export const BULLETIN_EVIDENCE_ORIGINS = [
  'OFFICIAL_PUBLIC_SOURCE',
  'MANUAL_PDF',
  'MANUAL_TEXT',
  'MANUAL_URL',
  'PRIVATE_PROVIDER',
] as const;

export type BulletinEvidenceOrigin = (typeof BULLETIN_EVIDENCE_ORIGINS)[number];

export const JALISCO_DISCOVERY_CLASSIFICATIONS = [
  'PUBLIC_JSON_ENDPOINT',
  'PUBLIC_HTML_ENDPOINT',
  'JAVASCRIPT_REQUIRED',
  'AUTH_REQUIRED',
  'CAPTCHA_PRESENT',
  'SOURCE_UNAVAILABLE',
  'SOURCE_CHANGED',
] as const;

export type JaliscoDiscoveryClassification = (typeof JALISCO_DISCOVERY_CLASSIFICATIONS)[number];

export type BulletinQuery = {
  sourceSlug: string;
  expedienteNumber: string;
  expedienteYear?: number;
  matter?: string;
  judicialDistrict?: string;
  court?: string;
  chamber?: string;
};

export type BulletinParsedEntry = {
  externalId?: string | null;
  expedienteNumber: string;
  expedienteYear?: number | null;
  matter?: string | null;
  judicialDistrict?: string | null;
  court?: string | null;
  chamber?: string | null;
  bulletinNumber?: string | null;
  publicationDate: Date | null;
  publicationDateRaw?: string | null;
  agreementDate?: Date | null;
  agreementDateRaw?: string | null;
  proceedingType?: string | null;
  heading?: string | null;
  extract?: string | null;
  parties?: Record<string, unknown> | null;
  sourceUrl: string;
  evidenceKind?: 'bulletin_publication' | 'electronic_expedient_match' | 'manual_import';
  raw?: unknown;
};

export type BulletinAdapterResult = {
  status: BulletinStatus;
  queryStatus: BulletinQueryStatus;
  publicationStatus: BulletinPublicationStatus;
  checkedAt: Date;
  sourceUrl: string;
  results: BulletinParsedEntry[];
  warnings: string[];
  responseHash?: string | null;
  httpStatus?: number | null;
  contentType?: string | null;
  durationMs?: number;
  errorCode?: string | null;
  errorMessage?: string | null;
  requestParams?: Record<string, string>;
  adapterVersion?: string;
  origin?: BulletinEvidenceOrigin;
  responseSnapshot?: string | null;
  discoveryClassification?: JaliscoDiscoveryClassification[];
};

export type ProviderHealth = {
  status: 'healthy' | 'degraded' | 'failed' | 'unknown';
  checkedAt: Date;
  queryStatus: BulletinQueryStatus;
  sourceUrl: string;
  httpStatus?: number | null;
  message?: string;
};

export type JudicialSubject = { id: string; name: string };
export type JudicialDistrict = { id: string; name: string };
export type JudicialCourt = { id: string; name: string };

export type JudicialBulletinResult = BulletinAdapterResult;

export interface JudicialBulletinAdapter {
  readonly provider: string;
  readonly version: string;
  checkHealth(): Promise<ProviderHealth>;
  listSubjects(): Promise<JudicialSubject[]>;
  listJudicialDistricts(subjectId: string): Promise<JudicialDistrict[]>;
  listCourts(subjectId: string, districtId: string): Promise<JudicialCourt[]>;
  fetchDailyBulletin(input: {
    subjectId: string;
    districtId: string;
    courtId: string;
    publicationDate: string;
  }): Promise<JudicialBulletinResult>;
}

const optionalText = (max: number) => z.preprocess(
  (value) => typeof value === 'string' && value.trim() ? value.replace(/\s+/g, ' ').trim() : undefined,
  z.string().max(max).optional(),
);

export const bulletinQuerySchema = z.object({
  sourceSlug: z.string().trim().min(1).max(100).regex(/^[a-z0-9_-]+$/i).transform((value) => value.toLowerCase()),
  expedienteNumber: z.string().trim().min(1).max(120).regex(/^[A-Za-z0-9\s]{1,40}(?:[/-][A-Za-z0-9\s]{1,12})?$/),
  expedienteYear: z.preprocess(
    (value) => value === undefined || value === null || value === '' ? undefined : Number(value),
    z.number().int().min(1900).max(2200).optional(),
  ),
  matter: optionalText(120),
  judicialDistrict: optionalText(180),
  court: optionalText(240),
  chamber: optionalText(180),
}).strict();

export function normalizeCaseNumber(value: string) {
  const compact = value
    .normalize('NFKC')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '')
    .replace(/-/g, '/');
  const [rawNumber, rawYear, ...rest] = compact.split('/');
  if (!rawNumber || !rawYear || rest.length > 0) return compact;
  const number = /^\d+$/.test(rawNumber) ? String(Number(rawNumber)) : rawNumber;
  const year = /^\d{2}$/.test(rawYear) ? `20${rawYear}` : rawYear;
  return `${number}/${year}`;
}

export function normalizeBulletinQuery(input: Record<string, unknown>): BulletinQuery {
  const parsed = bulletinQuerySchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw new Error(`INVALID_QUERY: ${issue?.message || 'datos inválidos'}`);
  }
  return { ...parsed.data, expedienteNumber: normalizeCaseNumber(parsed.data.expedienteNumber) };
}

export function queryFailureResult(input: {
  queryStatus: Exclude<BulletinQueryStatus, 'SUCCESS'>;
  sourceUrl: string;
  errorCode?: string;
  errorMessage?: string;
  warnings?: string[];
  checkedAt?: Date;
  httpStatus?: number | null;
  discoveryClassification?: JaliscoDiscoveryClassification[];
}): BulletinAdapterResult {
  const result: BulletinAdapterResult = {
    status: 'SOURCE_UNAVAILABLE',
    queryStatus: input.queryStatus,
    publicationStatus: input.queryStatus === 'INVALID_QUERY'
      ? 'INVALID_CASE_CONFIGURATION'
      : 'UNKNOWN',
    checkedAt: input.checkedAt || new Date(),
    sourceUrl: input.sourceUrl,
    results: [],
    warnings: input.warnings || [],
    responseHash: null,
    httpStatus: input.httpStatus ?? null,
    errorCode: input.errorCode || input.queryStatus,
    errorMessage: input.errorMessage,
    discoveryClassification: input.discoveryClassification,
  };
  result.status = deriveLegacyBulletinStatus(result);
  return result;
}

export function deriveLegacyBulletinStatus(result: Pick<BulletinAdapterResult, 'queryStatus' | 'publicationStatus'>): BulletinStatus {
  if (result.queryStatus === 'SUCCESS') {
    if (result.publicationStatus === 'NEW_PUBLICATIONS' || result.publicationStatus === 'HAS_PREVIOUS_PUBLICATIONS') return 'PUBLISHED';
    if (result.publicationStatus === 'NO_PUBLICATION_FOUND_AS_OF') return 'NOT_FOUND_AS_OF';
    return 'MANUAL_REVIEW';
  }
  if (result.queryStatus === 'SOURCE_CHANGED') return 'SOURCE_CHANGED';
  if (result.queryStatus === 'AUTH_REQUIRED' || result.queryStatus === 'CAPTCHA_REQUIRED') return 'AUTH_REQUIRED';
  if (result.queryStatus === 'INVALID_QUERY') return 'INVALID_QUERY';
  if (result.queryStatus === 'RATE_LIMITED' || result.queryStatus === 'TIMEOUT') return 'PENDING_RETRY';
  if (result.queryStatus === 'MANUAL_REVIEW') return 'MANUAL_REVIEW';
  if (result.queryStatus === 'UNSUPPORTED') return 'UNSUPPORTED';
  return 'SOURCE_UNAVAILABLE';
}

export function classifyBulletinFailure(error: unknown | null): BulletinStatus {
  if (!error) return 'NOT_FOUND_AS_OF';
  const message = error instanceof Error ? error.message : String(error);
  const normalized = message.toLowerCase();
  if (/401|403|auth|captcha|firma|firel|login|credencial|sesión|session/.test(normalized)) return 'AUTH_REQUIRED';
  if (/changed|html|parser|estructura|schema/.test(normalized)) return 'SOURCE_CHANGED';
  if (/invalid_query/.test(normalized)) return 'INVALID_QUERY';
  if (/unsupported|no compatible/.test(normalized)) return 'UNSUPPORTED';
  if (/429|too many requests|rate limit/.test(normalized)) return 'PENDING_RETRY';
  if (/timeout|abort|network|fetch|econn|5\d\d|unavailable|servidor/.test(normalized)) return 'SOURCE_UNAVAILABLE';
  return 'SOURCE_UNAVAILABLE';
}

export function legacyStatusToQueryStatus(status: BulletinStatus): BulletinQueryStatus {
  if (status === 'PUBLISHED' || status === 'NOT_FOUND_AS_OF') return 'SUCCESS';
  if (status === 'SOURCE_CHANGED') return 'SOURCE_CHANGED';
  if (status === 'AUTH_REQUIRED') return 'AUTH_REQUIRED';
  if (status === 'INVALID_QUERY') return 'INVALID_QUERY';
  if (status === 'PENDING_RETRY') return 'RATE_LIMITED';
  if (status === 'MANUAL_REVIEW') return 'MANUAL_REVIEW';
  if (status === 'UNSUPPORTED') return 'UNSUPPORTED';
  return 'SOURCE_UNAVAILABLE';
}

export function statusIsFailure(status: BulletinStatus) {
  return !['PUBLISHED', 'NOT_FOUND_AS_OF'].includes(status);
}
