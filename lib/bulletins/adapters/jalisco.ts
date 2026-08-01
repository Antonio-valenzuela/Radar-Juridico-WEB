import { hashBulletinContent } from '@/lib/bulletins/dedupe';
import type { BulletinAdapterResult, BulletinParsedEntry, BulletinQuery } from '@/lib/bulletins/types';
import { classifyBulletinFailure } from '@/lib/bulletins/types';

export const JALISCO_BULLETIN_URL = 'https://ciudadano.cjj.gob.mx/boletin_judicial/consultar';
const JALISCO_API_BASE = 'https://nilo.cjj.gob.mx/api/v1';
const MAX_RESPONSE_BYTES = 2_000_000;
const CATALOG_TTL_MS = 15 * 60 * 1000;
const catalogCache = new Map<string, { expiresAt: number; payload: unknown }>();

const text = (value: unknown, max = 2_000): string | null => {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const record = value as Record<string, unknown>;
    return text(record.full_name ?? record.name ?? record.label ?? record.text, max);
  }
  if (typeof value !== 'string') return null;
  const normalized = value.replace(/\s+/g, ' ').trim();
  return normalized ? normalized.slice(0, max) : null;
};

function parseDate(value: unknown) {
  if (!value) return null;
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function extractRows(payload: any): any[] {
  const candidates = [
    payload?.response?.Expedients,
    payload?.response?.expedients,
    payload?.data?.Expedients,
    payload?.data?.expedients,
    payload?.data?.results,
    payload?.Expedients,
    payload?.expedients,
    payload?.response?.results,
    payload?.results,
  ];
  return candidates.find(Array.isArray) || [];
}

function hasKnownRowsContainer(payload: any): boolean {
  return [payload?.response?.Expedients, payload?.response?.expedients, payload?.data?.Expedients, payload?.data?.expedients, payload?.data?.results, payload?.Expedients, payload?.expedients, payload?.response?.results, payload?.results].some(Array.isArray);
}

export function parseJaliscoBulletinResponse(payload: unknown, context: { sourceUrl: string; matter?: string; judicialDistrict?: string; court?: string }): BulletinAdapterResult {
  const rows = extractRows(payload);
  const responseObject = payload && typeof payload === 'object' ? payload as Record<string, unknown> : null;
  const apiMessage = responseObject && typeof responseObject.data === 'object' && responseObject.data !== null
    ? text((responseObject.data as Record<string, unknown>).message, 500)
    : null;
  const notFoundMessage = apiMessage && /no encontrado|no existe|not found|sin resultados/i.test(apiMessage);
  if (notFoundMessage) {
    return { status: 'NOT_FOUND_AS_OF', checkedAt: new Date(), sourceUrl: context.sourceUrl, results: [], warnings: [apiMessage], responseHash: hashBulletinContent(payload) };
  }
  if (rows.length === 0 && responseObject && Object.keys(responseObject).length > 0 && !hasKnownRowsContainer(payload)) {
    return {
      status: 'SOURCE_CHANGED',
      checkedAt: new Date(),
      sourceUrl: context.sourceUrl,
      results: [],
      warnings: ['La estructura de la respuesta oficial cambió y requiere revisión del adaptador.'],
      responseHash: hashBulletinContent(payload),
      errorCode: 'SOURCE_CHANGED',
    };
  }
  const results: BulletinParsedEntry[] = rows
    .filter((row) => row && typeof row === 'object')
    .map((row: Record<string, any>): BulletinParsedEntry | null => {
      const expedienteNumber = text(row.expedient ?? row.expedient_number ?? row.expediente ?? row.case_number, 120);
      if (!expedienteNumber) return null;
      const yearMatch = expedienteNumber.match(/(?:\/|-)(\d{2,4})$/);
      const publicationDate = parseDate(row.publication_date ?? row.publicationDate ?? row.published_at ?? row.date);
      const actor = text(row.actor ?? row.parties?.actor, 500);
      const defendant = text(row.defendant ?? row.parties?.defendant, 500);
      return {
        externalId: text(row.id ?? row.external_id ?? row.uuid, 120),
        expedienteNumber,
        expedienteYear: yearMatch ? Number(yearMatch[1].length === 2 ? `20${yearMatch[1]}` : yearMatch[1]) : null,
        matter: context.matter || null,
        judicialDistrict: context.judicialDistrict || text(row.judicial_party ?? row.judicialDistrict, 180),
        court: context.court || text(row.court ?? row.juzgado, 240),
        chamber: text(row.chamber ?? row.sala, 180),
        bulletinNumber: text(row.bulletin_number ?? row.boletin, 120),
        publicationDate,
        agreementDate: parseDate(row.agreement_date ?? row.agreementDate),
        proceedingType: text(row.judgement_type ?? row.proceeding_type ?? row.via, 240),
        heading: text(row.heading ?? row.title ?? row.rubro, 500),
        extract: text(row.comment ?? row.extract ?? row.summary ?? row.description, 10_000),
        parties: actor || defendant ? { ...(actor ? { actor } : {}), ...(defendant ? { defendant } : {}) } : null,
        sourceUrl: context.sourceUrl,
        raw: row,
      };
    })
    .filter((entry): entry is BulletinParsedEntry => Boolean(entry));

  return {
    status: results.length > 0 ? 'PUBLISHED' : 'NOT_FOUND_AS_OF',
    checkedAt: new Date(),
    sourceUrl: context.sourceUrl,
    results,
    warnings: results.some((entry) => !entry.publicationDate) ? ['La fuente no entregó fecha de publicación para una coincidencia.'] : [],
    responseHash: hashBulletinContent(payload),
  };
}

function publicAuthorizationHeader() {
  const configured = process.env.JALISCO_BULLETIN_PUBLIC_AUTH?.trim();
  if (configured) return configured;
  // The portal's own public client uses Basic(alpha1) for unauthenticated routes.
  return Buffer.from('alpha1').toString('base64');
}

function normalizedLabel(value: unknown) {
  return typeof value === 'string' ? value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase() : '';
}

async function fetchCatalog(fetchImpl: typeof fetch, endpoint: string, signal: AbortSignal) {
  const cached = catalogCache.get(endpoint);
  if (cached && cached.expiresAt > Date.now()) return cached.payload;
  const response = await fetchImpl(endpoint, {
    method: 'GET',
    signal,
    headers: { Authorization: publicAuthorizationHeader(), Accept: 'application/json', 'User-Agent': 'JuridicoRadar/1.0 (consulta oficial de boletín)' },
  });
  if (response.status === 401 || response.status === 403) throw new Error('AUTH_REQUIRED: catálogo público no autorizado');
  if (!response.ok) throw new Error(`SOURCE_UNAVAILABLE: catálogo HTTP ${response.status}`);
  const raw = await response.text();
  if (Buffer.byteLength(raw, 'utf8') > MAX_RESPONSE_BYTES) throw new Error('SOURCE_CHANGED: catálogo excede tamaño permitido');
  let payload: unknown;
  try { payload = JSON.parse(raw); } catch { throw new Error('SOURCE_CHANGED: catálogo no es JSON'); }
  if (payload && typeof payload === 'object') {
    const envelope = payload as Record<string, unknown>;
    const data = envelope.data && typeof envelope.data === 'object'
      ? envelope.data as Record<string, unknown>
      : {};
    const code = Number(envelope.code ?? data.code);
    const message = typeof data.message === 'string' ? data.message : '';
    if (code === 401 || code === 403 || (data.error === true && /auth|token|credencial|decodific|autoriz/i.test(message))) {
      throw new Error('AUTH_REQUIRED: catálogo público no autorizado');
    }
  }
  catalogCache.set(endpoint, { expiresAt: Date.now() + CATALOG_TTL_MS, payload });
  return payload;
}

function rowsFromCatalog(payload: unknown, keys: string[]): Array<Record<string, unknown>> {
  if (!payload || typeof payload !== 'object') return [];
  const root = payload as Record<string, unknown>;
  const data = root.data && typeof root.data === 'object' ? root.data as Record<string, unknown> : root;
  for (const key of keys) {
    const rows = data[key];
    if (Array.isArray(rows)) return rows.filter((row): row is Record<string, unknown> => Boolean(row && typeof row === 'object'));
  }
  return [];
}

function findCatalogId(rows: Array<Record<string, unknown>>, value: string) {
  if (/^\d+$/.test(value.trim())) return value.trim();
  const wanted = normalizedLabel(value);
  const row = rows.find((candidate) => normalizedLabel(candidate.label ?? candidate.name ?? candidate.text ?? candidate.description) === wanted);
  const id = row?.value ?? row?.id ?? row?.code;
  return typeof id === 'number' || typeof id === 'string' ? String(id) : null;
}

async function resolveJaliscoIds(query: BulletinQuery, fetchImpl: typeof fetch, signal: AbortSignal) {
  const base = process.env.JALISCO_BULLETIN_API_BASE || JALISCO_API_BASE;
  const matterInput = query.matter?.trim() || '';
  const matterId = findCatalogId(rowsFromCatalog(
    /^\d+$/.test(matterInput) ? {} : await fetchCatalog(fetchImpl, `${base}/matters/get_all_matters`, signal),
    ['matters', 'options'],
  ), matterInput);
  if (!matterId) throw new Error('INVALID_QUERY: materia no encontrada en el catálogo oficial de Jalisco');

  const courtInput = query.court?.trim() || '';
  if (/^\d+$/.test(courtInput)) return { matterId, courtId: courtInput, judicialDistrictId: query.judicialDistrict?.trim() || undefined };
  const districtInput = query.judicialDistrict?.trim() || '';
  if (!districtInput) throw new Error('INVALID_QUERY: se requiere partido judicial o ID de juzgado');
  const districtId = findCatalogId(rowsFromCatalog(await fetchCatalog(fetchImpl, `${base}/judicial_parties/list`, signal), ['judicialParties', 'options']), districtInput);
  if (!districtId) throw new Error('INVALID_QUERY: partido judicial no encontrado en el catálogo oficial de Jalisco');
  const courts = rowsFromCatalog(await fetchCatalog(fetchImpl, `${base}/courts/get_list/${encodeURIComponent(districtId)}/${encodeURIComponent(matterId)}`, signal), ['courts', 'options']);
  const courtId = findCatalogId(courts, courtInput);
  if (!courtId) throw new Error('INVALID_QUERY: juzgado o sala no encontrado en el catálogo oficial de Jalisco');
  return { matterId, courtId, judicialDistrictId: districtId };
}

export async function queryJaliscoBulletin(query: BulletinQuery, options: { fetchImpl?: typeof fetch; timeoutMs?: number } = {}): Promise<BulletinAdapterResult> {
  const startedAt = Date.now();
  const fetchImpl = options.fetchImpl || fetch;
  const timeoutMs = Math.min(Math.max(options.timeoutMs || Number(process.env.BULLETIN_SOURCE_TIMEOUT_MS || 15_000), 1_000), 60_000);
  const sourceUrl = JALISCO_BULLETIN_URL;
  if (!query.court || !query.matter) {
    return { status: 'INVALID_QUERY', checkedAt: new Date(), sourceUrl, results: [], warnings: ['Jalisco requiere materia y juzgado/órgano para esta consulta pública.'], responseHash: null, httpStatus: null, durationMs: Date.now() - startedAt, errorCode: 'INVALID_QUERY' };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const ids = await resolveJaliscoIds(query, fetchImpl, controller.signal);
    const casePart = encodeURIComponent(query.expedienteNumber.replace(/\//g, '-'));
    const endpoint = `${process.env.JALISCO_BULLETIN_API_BASE || JALISCO_API_BASE}/electronic_expedients/find/${casePart}/${encodeURIComponent(ids.courtId)}/${encodeURIComponent(ids.matterId)}`;
    const response = await fetchImpl(endpoint, {
      method: 'GET',
      signal: controller.signal,
      headers: {
        Authorization: publicAuthorizationHeader(),
        Accept: 'application/json',
        'User-Agent': 'JuridicoRadar/1.0 (consulta oficial de boletín; contacto configurado por el operador)',
      },
    });
    if (response.status === 401 || response.status === 403) {
      return { status: 'AUTH_REQUIRED', checkedAt: new Date(), sourceUrl, results: [], warnings: ['La fuente exige autenticación o cambió su acceso público.'], responseHash: null, httpStatus: response.status, durationMs: Date.now() - startedAt, errorCode: 'AUTH_REQUIRED' };
    }
    const contentLength = Number(response.headers.get('content-length') || 0);
    if (contentLength > MAX_RESPONSE_BYTES) throw new Error('SOURCE_CHANGED: respuesta excede el tamaño permitido');
    const raw = await response.text();
    if (Buffer.byteLength(raw, 'utf8') > MAX_RESPONSE_BYTES) throw new Error('SOURCE_CHANGED: respuesta excede el tamaño permitido');
    if (!response.ok) throw new Error(`${response.status === 429 ? 'PENDING_RETRY' : 'SOURCE_UNAVAILABLE'}: HTTP ${response.status}`);
    let payload: unknown;
    try { payload = JSON.parse(raw); } catch { throw new Error('SOURCE_CHANGED: respuesta no es JSON'); }
    // La URL guardada en la evidencia es el endpoint oficial realmente consultado;
    // la interfaz humana se conserva en las advertencias.
    const parsed = parseJaliscoBulletinResponse(payload, { sourceUrl: endpoint, matter: query.matter, judicialDistrict: query.judicialDistrict, court: query.court });
    return { ...parsed, httpStatus: response.status, durationMs: Date.now() - startedAt, requestParams: { expediente: query.expedienteNumber, courtId: ids.courtId, matterId: ids.matterId, ...(ids.judicialDistrictId ? { judicialDistrictId: ids.judicialDistrictId } : {}) }, warnings: [`Portal oficial: ${sourceUrl}`, ...parsed.warnings] };
  } catch (error) {
    const status = classifyBulletinFailure(error);
    return { status, checkedAt: new Date(), sourceUrl, results: [], warnings: ['No se pudo completar la consulta en la fuente oficial.'], responseHash: null, httpStatus: null, durationMs: Date.now() - startedAt, errorCode: status, errorMessage: error instanceof Error ? error.message : undefined };
  } finally {
    clearTimeout(timer);
  }
}
