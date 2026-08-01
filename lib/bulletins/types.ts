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
  agreementDate?: Date | null;
  proceedingType?: string | null;
  heading?: string | null;
  extract?: string | null;
  parties?: Record<string, unknown> | null;
  sourceUrl: string;
  raw?: unknown;
};

export type BulletinAdapterResult = {
  status: BulletinStatus;
  checkedAt: Date;
  sourceUrl: string;
  results: BulletinParsedEntry[];
  warnings: string[];
  responseHash?: string | null;
  httpStatus?: number | null;
  durationMs?: number;
  errorCode?: string | null;
  errorMessage?: string | null;
  requestParams?: Record<string, string>;
};

const optionalText = (max: number) => z.preprocess(
  (value) => typeof value === 'string' && value.trim() ? value.replace(/\s+/g, ' ').trim() : undefined,
  z.string().max(max).optional(),
);

export const bulletinQuerySchema = z.object({
  sourceSlug: z.string().trim().min(1).max(100).regex(/^[a-z0-9_-]+$/i).transform((value) => value.toLowerCase()),
  expedienteNumber: z.string().trim().min(1).max(120).regex(/^[A-Za-z0-9]{1,20}(?:[/-][A-Za-z0-9]{1,8})?$/),
  expedienteYear: z.preprocess(
    (value) => value === undefined || value === null || value === '' ? undefined : Number(value),
    z.number().int().min(1900).max(2200).optional(),
  ),
  matter: optionalText(120),
  judicialDistrict: optionalText(180),
  court: optionalText(240),
  chamber: optionalText(180),
}).strict();

export function normalizeBulletinQuery(input: Record<string, unknown>): BulletinQuery {
  const parsed = bulletinQuerySchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw new Error(`INVALID_QUERY: ${issue?.message || 'datos inválidos'}`);
  }
  return parsed.data;
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

export function statusIsFailure(status: BulletinStatus) {
  return !['PUBLISHED', 'NOT_FOUND_AS_OF'].includes(status);
}
import { z } from 'zod';
