import { z } from 'zod';
import { hashBulletinContent } from '@/lib/bulletins/dedupe';
import type {
  BulletinAdapterResult,
  BulletinParsedEntry,
  BulletinQuery,
  BulletinQueryStatus,
  JudicialBulletinAdapter,
  JudicialCourt,
  JudicialDistrict,
  JudicialSubject,
  ProviderHealth,
} from '@/lib/bulletins/types';
import {
  classifyBulletinFailure,
  deriveLegacyBulletinStatus,
  legacyStatusToQueryStatus,
  queryFailureResult,
} from '@/lib/bulletins/types';

export const JALISCO_BULLETIN_URL = 'https://ciudadano.cjj.gob.mx/boletin_judicial/consultar';
export const JALISCO_ADAPTER_VERSION = '2.0.0';
const JALISCO_API_BASE = 'https://nilo.cjj.gob.mx/api/v1';
const MAX_RESPONSE_BYTES = 2_000_000;
const CATALOG_TTL_MS = 15 * 60 * 1000;
const catalogCache = new Map<string, { expiresAt: number; payload: unknown }>();

const optionSchema = z.object({
  value: z.union([z.string(), z.number()]),
  label: z.string().trim().min(1).max(300),
}).passthrough();

const rowSchema = z.object({
  id: z.union([z.string(), z.number()]).optional(),
  external_id: z.union([z.string(), z.number()]).optional(),
  uuid: z.string().optional(),
  expedient: z.string().optional(),
  expedient_number: z.string().optional(),
  expediente: z.string().optional(),
  case_number: z.string().optional(),
  actor: z.string().optional(),
  defendant: z.string().optional(),
  judgement_type: z.string().optional(),
  proceeding_type: z.string().optional(),
  via: z.string().optional(),
  publication_date: z.string().optional(),
  publicationDate: z.string().optional(),
  published_at: z.string().optional(),
  date: z.string().optional(),
  agreement_date: z.string().optional(),
  agreementDate: z.string().optional(),
  court: z.union([z.string(), optionSchema]).optional(),
  juzgado: z.union([z.string(), optionSchema]).optional(),
  judicial_party: z.union([z.string(), optionSchema]).optional(),
  judicialDistrict: z.union([z.string(), optionSchema]).optional(),
  chamber: z.string().optional(),
  sala: z.string().optional(),
  bulletin_number: z.union([z.string(), z.number()]).optional(),
  boletin: z.union([z.string(), z.number()]).optional(),
  heading: z.string().optional(),
  title: z.string().optional(),
  rubro: z.string().optional(),
  comment: z.string().optional(),
  extract: z.string().optional(),
  summary: z.string().optional(),
  description: z.string().optional(),
}).passthrough();

type FetchJsonResult = {
  payload: unknown;
  raw: string;
  httpStatus: number;
  contentType: string | null;
};

const text = (value: unknown, max = 2_000): string | null => {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const record = value as Record<string, unknown>;
    return text(record.full_name ?? record.name ?? record.label ?? record.text, max);
  }
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  const normalized = String(value).replace(/\s+/g, ' ').trim();
  return normalized ? normalized.slice(0, max) : null;
};

function parseDate(value: unknown) {
  if (!value) return null;
  const raw = String(value).trim();
  const isoDay = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const mexicanDay = raw.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  const parts = isoDay
    ? { year: Number(isoDay[1]), month: Number(isoDay[2]), day: Number(isoDay[3]) }
    : mexicanDay
      ? { year: Number(mexicanDay[3]), month: Number(mexicanDay[2]), day: Number(mexicanDay[1]) }
      : null;
  if (parts) {
    const parsed = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
    return parsed.getUTCFullYear() === parts.year
      && parsed.getUTCMonth() === parts.month - 1
      && parsed.getUTCDate() === parts.day
      ? parsed
      : null;
  }
  // Sólo los timestamps con zona explícita se delegan al parser nativo.
  if (!/T.*(?:Z|[+-]\d{2}:?\d{2})$/i.test(raw)) return null;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function getRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function nested(value: unknown, ...path: string[]): unknown {
  let current: unknown = value;
  for (const key of path) {
    const record = getRecord(current);
    if (!record) return undefined;
    current = record[key];
  }
  return current;
}

function extractRows(payload: unknown): Array<z.infer<typeof rowSchema>> {
  const candidates = [
    nested(payload, 'response', 'Expedients'),
    nested(payload, 'response', 'expedients'),
    nested(payload, 'data', 'Expedients'),
    nested(payload, 'data', 'expedients'),
    nested(payload, 'data', 'results'),
    nested(payload, 'Expedients'),
    nested(payload, 'expedients'),
    nested(payload, 'response', 'results'),
    nested(payload, 'results'),
  ];
  const candidate = candidates.find(Array.isArray);
  if (!Array.isArray(candidate)) return [];
  return candidate.flatMap((row) => {
    const parsed = rowSchema.safeParse(row);
    return parsed.success ? [parsed.data] : [];
  });
}

function hasKnownRowsContainer(payload: unknown) {
  return [
    nested(payload, 'response', 'Expedients'), nested(payload, 'response', 'expedients'),
    nested(payload, 'data', 'Expedients'), nested(payload, 'data', 'expedients'),
    nested(payload, 'data', 'results'), nested(payload, 'Expedients'),
    nested(payload, 'expedients'), nested(payload, 'response', 'results'), nested(payload, 'results'),
  ].some(Array.isArray);
}

export function parseJaliscoBulletinResponse(payload: unknown, context: {
  sourceUrl: string;
  matter?: string;
  judicialDistrict?: string;
  court?: string;
  publicationDate?: string;
  evidenceKind?: 'bulletin_publication' | 'electronic_expedient_match';
}): BulletinAdapterResult {
  const rows = extractRows(payload);
  const responseObject = getRecord(payload);
  const apiMessage = text(nested(responseObject, 'data', 'message'), 500)
    || text(nested(responseObject, 'response', 'message'), 500);
  const notFoundMessage = apiMessage && /no encontrado|no existe|not found|sin resultados/i.test(apiMessage);
  const evidenceKind = context.evidenceKind || 'bulletin_publication';

  if (evidenceKind === 'electronic_expedient_match' && (notFoundMessage || (hasKnownRowsContainer(payload) && rows.length === 0))) {
    return {
      status: 'MANUAL_REVIEW', queryStatus: 'SUCCESS', publicationStatus: 'CASE_EXISTS_NOT_BULLETIN_CONFIRMED',
      checkedAt: new Date(), sourceUrl: context.sourceUrl, results: [],
      warnings: [apiMessage || 'El endpoint de expediente electrónico no entregó coincidencias; esto no acredita ausencia en el Boletín Judicial.'],
      responseHash: hashBulletinContent(payload), errorCode: 'ELECTRONIC_EXPEDIENT_RESULT_ONLY',
      adapterVersion: JALISCO_ADAPTER_VERSION, origin: 'OFFICIAL_PUBLIC_SOURCE',
    };
  }

  if (notFoundMessage) {
    return {
      status: 'NOT_FOUND_AS_OF', queryStatus: 'SUCCESS', publicationStatus: 'NO_PUBLICATION_FOUND_AS_OF',
      checkedAt: new Date(), sourceUrl: context.sourceUrl, results: [], warnings: [apiMessage],
      responseHash: hashBulletinContent(payload), adapterVersion: JALISCO_ADAPTER_VERSION,
      origin: 'OFFICIAL_PUBLIC_SOURCE',
    };
  }
  if (rows.length === 0 && responseObject && Object.keys(responseObject).length > 0 && !hasKnownRowsContainer(payload)) {
    return queryFailureResult({
      queryStatus: 'SOURCE_CHANGED', sourceUrl: context.sourceUrl, errorCode: 'SOURCE_CHANGED',
      warnings: ['La estructura de la respuesta oficial cambió y requiere revisión del adaptador.'],
    });
  }
  if (evidenceKind === 'electronic_expedient_match' && rows.length > 0) {
    return {
      status: 'MANUAL_REVIEW', queryStatus: 'SUCCESS', publicationStatus: 'CASE_EXISTS_NOT_BULLETIN_CONFIRMED', checkedAt: new Date(),
      sourceUrl: context.sourceUrl, results: [],
      warnings: ['La fuente acreditó la existencia del expediente electrónico, no una publicación en el Boletín Judicial. Requiere revisión manual.'],
      responseHash: hashBulletinContent(payload), errorCode: 'ELECTRONIC_EXPEDIENT_MATCH_ONLY',
      adapterVersion: JALISCO_ADAPTER_VERSION, origin: 'OFFICIAL_PUBLIC_SOURCE',
    };
  }

  const results: BulletinParsedEntry[] = rows.flatMap((row): BulletinParsedEntry[] => {
    const expedienteNumber = text(row.expedient ?? row.expedient_number ?? row.expediente ?? row.case_number, 120);
    if (!expedienteNumber) return [];
    const yearMatch = expedienteNumber.match(/(?:\/|-)(\d{2,4})$/);
    const publicationDateRaw = text(row.publication_date ?? row.publicationDate ?? row.published_at ?? row.date, 100) || context.publicationDate || null;
    const agreementDateRaw = text(row.agreement_date ?? row.agreementDate, 100);
    const actor = text(row.actor, 500);
    const defendant = text(row.defendant, 500);
    return [{
      externalId: text(row.id ?? row.external_id ?? row.uuid, 120),
      expedienteNumber,
      expedienteYear: yearMatch ? Number(yearMatch[1].length === 2 ? `20${yearMatch[1]}` : yearMatch[1]) : null,
      matter: context.matter || null,
      judicialDistrict: context.judicialDistrict || text(row.judicial_party ?? row.judicialDistrict, 180),
      court: context.court || text(row.court ?? row.juzgado, 240),
      chamber: text(row.chamber ?? row.sala, 180),
      bulletinNumber: text(row.bulletin_number ?? row.boletin, 120),
      publicationDate: parseDate(publicationDateRaw), publicationDateRaw,
      agreementDate: parseDate(agreementDateRaw), agreementDateRaw,
      proceedingType: text(row.judgement_type ?? row.proceeding_type ?? row.via, 240),
      heading: text(row.heading ?? row.title ?? row.rubro, 500),
      extract: text(row.comment ?? row.extract ?? row.summary ?? row.description, 10_000),
      parties: actor || defendant ? { ...(actor ? { actor } : {}), ...(defendant ? { defendant } : {}) } : null,
      sourceUrl: context.sourceUrl, evidenceKind: 'bulletin_publication', raw: row,
    }];
  });

  return {
    status: results.length > 0 ? 'PUBLISHED' : 'NOT_FOUND_AS_OF', queryStatus: 'SUCCESS',
    publicationStatus: results.length > 0 ? 'NEW_PUBLICATIONS' : 'NO_PUBLICATION_FOUND_AS_OF',
    checkedAt: new Date(), sourceUrl: context.sourceUrl, results,
    warnings: results.some((entry) => !entry.publicationDate) ? ['La fuente no entregó fecha de publicación para una coincidencia.'] : [],
    responseHash: hashBulletinContent(payload), adapterVersion: JALISCO_ADAPTER_VERSION,
    origin: 'OFFICIAL_PUBLIC_SOURCE',
  };
}

function publicAuthorizationHeader() {
  const configured = process.env.JALISCO_BULLETIN_PUBLIC_AUTH?.trim();
  return configured || Buffer.from('alpha1').toString('base64');
}

async function fetchJson(fetchImpl: typeof fetch, endpoint: string, signal: AbortSignal): Promise<FetchJsonResult> {
  const response = await fetchImpl(endpoint, {
    method: 'GET', signal,
    headers: { Authorization: publicAuthorizationHeader(), Accept: 'application/json', 'User-Agent': 'JuridicoRadar/2.0 (consulta oficial; contacto configurado por el operador)' },
  });
  if (response.status === 401 || response.status === 403) throw new Error('AUTH_REQUIRED: fuente pública no autorizada');
  if (response.status === 429) throw new Error('PENDING_RETRY: HTTP 429');
  if (!response.ok) throw new Error(`SOURCE_UNAVAILABLE: HTTP ${response.status}`);
  const raw = await response.text();
  if (Buffer.byteLength(raw, 'utf8') > MAX_RESPONSE_BYTES) throw new Error('SOURCE_CHANGED: respuesta excede tamaño permitido');
  let payload: unknown;
  try { payload = JSON.parse(raw); } catch { throw new Error('SOURCE_CHANGED: respuesta no es JSON'); }
  const envelope = getRecord(payload);
  const code = Number(envelope?.code ?? nested(envelope, 'data', 'code'));
  const message = text(nested(envelope, 'data', 'message'), 500) || '';
  if (code === 401 || code === 403 || /auth|token|credencial|decodific|autoriz/i.test(message)) throw new Error('AUTH_REQUIRED: fuente pública no autorizada');
  return { payload, raw, httpStatus: response.status, contentType: response.headers.get('content-type') };
}

function optionsFrom(payload: unknown, field: 'matters' | 'options' | 'courts') {
  const parsed = z.array(optionSchema).safeParse(nested(payload, 'data', field));
  if (!parsed.success) throw new Error('SOURCE_CHANGED: catálogo oficial no coincide con el contrato observado');
  return parsed.data.map((item) => ({ id: String(item.value), name: item.label }));
}

async function fetchCatalog(fetchImpl: typeof fetch, endpoint: string, signal: AbortSignal) {
  const cached = catalogCache.get(endpoint);
  if (cached && cached.expiresAt > Date.now()) return cached.payload;
  const result = await fetchJson(fetchImpl, endpoint, signal);
  catalogCache.set(endpoint, { expiresAt: Date.now() + CATALOG_TTL_MS, payload: result.payload });
  return result.payload;
}

function normalizedLabel(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
}

function findCatalogId(rows: Array<{ id: string; name: string }>, value: string) {
  if (/^\d+$/.test(value.trim())) return value.trim();
  const wanted = normalizedLabel(value);
  return rows.find((candidate) => normalizedLabel(candidate.name) === wanted)?.id || null;
}

async function resolveJaliscoIds(query: BulletinQuery, fetchImpl: typeof fetch, signal: AbortSignal) {
  const base = process.env.JALISCO_BULLETIN_API_BASE || JALISCO_API_BASE;
  const matters = optionsFrom(await fetchCatalog(fetchImpl, `${base}/matters/get_all_matters`, signal), 'matters');
  const matterId = findCatalogId(matters, query.matter?.trim() || '');
  if (!matterId) throw new Error('INVALID_QUERY: materia no encontrada en el catálogo oficial');
  const courtInput = query.court?.trim() || '';
  if (/^\d+$/.test(courtInput)) return { matterId, courtId: courtInput, judicialDistrictId: query.judicialDistrict?.trim() || undefined };
  const districtInput = query.judicialDistrict?.trim() || '';
  if (!districtInput) throw new Error('INVALID_QUERY: se requiere partido judicial');
  const districts = optionsFrom(await fetchCatalog(fetchImpl, `${base}/courts_matters/courts_parties/${encodeURIComponent(matterId)}`, signal), 'options');
  const districtId = findCatalogId(districts, districtInput);
  if (!districtId) throw new Error('INVALID_QUERY: partido judicial no encontrado en el catálogo oficial');
  const courts = optionsFrom(await fetchCatalog(fetchImpl, `${base}/courts/get_list/${encodeURIComponent(districtId)}/${encodeURIComponent(matterId)}`, signal), 'courts');
  const courtId = findCatalogId(courts, courtInput);
  if (!courtId) throw new Error('INVALID_QUERY: juzgado no encontrado en el catálogo oficial');
  return { matterId, courtId, judicialDistrictId: districtId };
}

function queryStatusFromLegacy(status: ReturnType<typeof classifyBulletinFailure>): Exclude<BulletinQueryStatus, 'SUCCESS'> {
  if (status === 'PENDING_RETRY') return 'RATE_LIMITED' as const;
  const mapped = legacyStatusToQueryStatus(status);
  return mapped === 'SUCCESS' ? 'PROVIDER_ERROR' : mapped;
}

export async function queryJaliscoBulletin(query: BulletinQuery, options: {
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  allowAutomatedLookup?: boolean;
} = {}): Promise<BulletinAdapterResult> {
  const startedAt = Date.now();
  const fetchImpl = options.fetchImpl || fetch;
  const sourceUrl = JALISCO_BULLETIN_URL;
  if (!query.court || !query.matter) {
    return queryFailureResult({ queryStatus: 'INVALID_QUERY', sourceUrl, warnings: ['Jalisco requiere materia y juzgado.'] });
  }
  if (!options.allowAutomatedLookup) {
    return {
      ...queryFailureResult({
        queryStatus: 'CAPTCHA_REQUIRED', sourceUrl, errorCode: 'CAPTCHA_PRESENT',
        warnings: ['El portal oficial exige reCAPTCHA para ejecutar la búsqueda. Usa el enlace oficial o la importación manual.'],
        discoveryClassification: ['PUBLIC_JSON_ENDPOINT', 'JAVASCRIPT_REQUIRED', 'CAPTCHA_PRESENT', 'AUTH_REQUIRED'],
      }),
      durationMs: Date.now() - startedAt,
      adapterVersion: JALISCO_ADAPTER_VERSION,
    };
  }

  const timeoutMs = Math.min(Math.max(options.timeoutMs || Number(process.env.BULLETIN_SOURCE_TIMEOUT_MS || 20_000), 1_000), 60_000);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const ids = await resolveJaliscoIds(query, fetchImpl, controller.signal);
    const casePart = encodeURIComponent(query.expedienteNumber.replace(/\//g, '-'));
    const endpoint = `${process.env.JALISCO_BULLETIN_API_BASE || JALISCO_API_BASE}/electronic_expedients/find/${casePart}/${encodeURIComponent(ids.courtId)}/${encodeURIComponent(ids.matterId)}`;
    const fetched = await fetchJson(fetchImpl, endpoint, controller.signal);
    const parsed = parseJaliscoBulletinResponse(fetched.payload, {
      sourceUrl: endpoint, matter: query.matter, judicialDistrict: query.judicialDistrict,
      court: query.court, evidenceKind: 'electronic_expedient_match',
    });
    return {
      ...parsed, httpStatus: fetched.httpStatus, contentType: fetched.contentType,
      durationMs: Date.now() - startedAt,
      requestParams: { expediente: query.expedienteNumber, courtId: ids.courtId, matterId: ids.matterId, ...(ids.judicialDistrictId ? { judicialDistrictId: ids.judicialDistrictId } : {}) },
      warnings: [`Portal oficial: ${sourceUrl}`, ...parsed.warnings],
      discoveryClassification: ['PUBLIC_JSON_ENDPOINT', 'JAVASCRIPT_REQUIRED', 'CAPTCHA_PRESENT'],
      responseSnapshot: fetched.raw.slice(0, 2_000), adapterVersion: JALISCO_ADAPTER_VERSION,
    };
  } catch (error) {
    const status = classifyBulletinFailure(error);
    return {
      ...queryFailureResult({
        queryStatus: queryStatusFromLegacy(status), sourceUrl, errorCode: status,
        errorMessage: error instanceof Error ? error.message : undefined,
        warnings: ['No se pudo completar la consulta en la fuente oficial.'],
      }),
      durationMs: Date.now() - startedAt, adapterVersion: JALISCO_ADAPTER_VERSION,
    };
  } finally {
    clearTimeout(timer);
  }
}

export class JaliscoBulletinAdapter implements JudicialBulletinAdapter {
  readonly provider = 'CJJ_JALISCO';
  readonly version = JALISCO_ADAPTER_VERSION;

  constructor(private readonly options: {
    fetchImpl?: typeof fetch;
    timeoutMs?: number;
    allowAutomatedLookup?: boolean;
  } = {}) {}

  private async catalog<T>(operation: (signal: AbortSignal, fetchImpl: typeof fetch) => Promise<T>) {
    const controller = new AbortController();
    const timeoutMs = Math.min(Math.max(this.options.timeoutMs || 20_000, 1_000), 60_000);
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try { return await operation(controller.signal, this.options.fetchImpl || fetch); }
    finally { clearTimeout(timer); }
  }

  async checkHealth(): Promise<ProviderHealth> {
    try {
      await this.listSubjects();
      return { status: 'degraded', checkedAt: new Date(), queryStatus: 'AUTH_REQUIRED', sourceUrl: JALISCO_BULLETIN_URL, message: 'Catálogos públicos disponibles; búsqueda protegida por reCAPTCHA.' };
    } catch {
      return { status: 'failed', checkedAt: new Date(), queryStatus: 'SOURCE_UNAVAILABLE', sourceUrl: JALISCO_BULLETIN_URL };
    }
  }

  listSubjects(): Promise<JudicialSubject[]> {
    return this.catalog(async (signal, fetchImpl) => optionsFrom(await fetchCatalog(fetchImpl, `${JALISCO_API_BASE}/matters/get_all_matters`, signal), 'matters'));
  }

  listJudicialDistricts(subjectId: string): Promise<JudicialDistrict[]> {
    return this.catalog(async (signal, fetchImpl) => optionsFrom(await fetchCatalog(fetchImpl, `${JALISCO_API_BASE}/courts_matters/courts_parties/${encodeURIComponent(subjectId)}`, signal), 'options'));
  }

  listCourts(subjectId: string, districtId: string): Promise<JudicialCourt[]> {
    return this.catalog(async (signal, fetchImpl) => optionsFrom(await fetchCatalog(fetchImpl, `${JALISCO_API_BASE}/courts/get_list/${encodeURIComponent(districtId)}/${encodeURIComponent(subjectId)}`, signal), 'courts'));
  }

  async fetchDailyBulletin(input: { subjectId: string; districtId: string; courtId: string; publicationDate: string }): Promise<BulletinAdapterResult> {
    if (!this.options.allowAutomatedLookup) {
      return queryFailureResult({
        queryStatus: 'CAPTCHA_REQUIRED', sourceUrl: JALISCO_BULLETIN_URL, errorCode: 'CAPTCHA_PRESENT',
        warnings: ['La descarga diaria está protegida por reCAPTCHA; use importación manual.'],
        discoveryClassification: ['PUBLIC_JSON_ENDPOINT', 'JAVASCRIPT_REQUIRED', 'CAPTCHA_PRESENT', 'AUTH_REQUIRED'],
      });
    }
    const startedAt = Date.now();
    try {
      return await this.catalog(async (signal, fetchImpl) => {
        const [year, month, day] = input.publicationDate.split('-');
        if (!/^\d{4}$/.test(year || '') || !/^\d{2}$/.test(month || '') || !/^\d{2}$/.test(day || '')) {
          return queryFailureResult({ queryStatus: 'INVALID_QUERY', sourceUrl: JALISCO_BULLETIN_URL });
        }
        const base = process.env.JALISCO_BULLETIN_API_BASE || JALISCO_API_BASE;
        const subjectId = findCatalogId(
          /^\d+$/.test(input.subjectId.trim())
            ? []
            : optionsFrom(await fetchCatalog(fetchImpl, `${base}/matters/get_all_matters`, signal), 'matters'),
          input.subjectId,
        );
        if (!subjectId) throw new Error('INVALID_QUERY: materia no encontrada en el catálogo oficial');
        const districtId = findCatalogId(
          /^\d+$/.test(input.districtId.trim())
            ? []
            : optionsFrom(await fetchCatalog(fetchImpl, `${base}/courts_matters/courts_parties/${encodeURIComponent(subjectId)}`, signal), 'options'),
          input.districtId,
        );
        if (!districtId) throw new Error('INVALID_QUERY: partido judicial no encontrado en el catálogo oficial');
        const courtId = findCatalogId(
          /^\d+$/.test(input.courtId.trim())
            ? []
            : optionsFrom(await fetchCatalog(fetchImpl, `${base}/courts/get_list/${encodeURIComponent(districtId)}/${encodeURIComponent(subjectId)}`, signal), 'courts'),
          input.courtId,
        );
        if (!courtId) throw new Error('INVALID_QUERY: juzgado no encontrado en el catálogo oficial');
        const endpoint = `${base}/electronic_expedients/by_date/${encodeURIComponent(courtId)}/${year}/${Number(month)}/${Number(day)}/${encodeURIComponent(subjectId)}`;
        const fetched = await fetchJson(fetchImpl, endpoint, signal);
        const parsed = parseJaliscoBulletinResponse(fetched.payload, {
          sourceUrl: endpoint,
          matter: input.subjectId,
          judicialDistrict: input.districtId,
          court: input.courtId,
          publicationDate: input.publicationDate,
          evidenceKind: 'bulletin_publication',
        });
        parsed.httpStatus = fetched.httpStatus;
        parsed.contentType = fetched.contentType;
        parsed.durationMs = Date.now() - startedAt;
        parsed.requestParams = {
          ...input,
          resolvedSubjectId: subjectId,
          resolvedDistrictId: districtId,
          resolvedCourtId: courtId,
        };
        parsed.responseSnapshot = fetched.raw.slice(0, 2_000);
        return parsed;
      });
    } catch (error) {
      const legacy = classifyBulletinFailure(error);
      const result = queryFailureResult({ queryStatus: queryStatusFromLegacy(legacy), sourceUrl: JALISCO_BULLETIN_URL, errorCode: legacy });
      result.durationMs = Date.now() - startedAt;
      return result;
    }
  }
}

export function withDerivedLegacyStatus(result: BulletinAdapterResult) {
  return { ...result, status: deriveLegacyBulletinStatus(result) };
}
