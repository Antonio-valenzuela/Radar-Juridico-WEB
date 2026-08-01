import { describe, expect, it } from 'vitest';
import {
  BULLETIN_STATUSES,
  normalizeBulletinQuery,
  classifyBulletinFailure,
} from '@/lib/bulletins/types';
import { parseJaliscoBulletinResponse, queryJaliscoBulletin } from '@/lib/bulletins/adapters/jalisco';
import { buildBulletinDedupeKey } from '@/lib/bulletins/dedupe';

describe('boletín judicial', () => {
  it('valida y normaliza una consulta de expediente', () => {
    expect(normalizeBulletinQuery({
      sourceSlug: 'boletin_judicial_jalisco',
      expedienteNumber: ' 123/2026 ',
      expedienteYear: '2026',
      matter: ' Civil ',
      judicialDistrict: 'Primer partido judicial',
      court: 'Juzgado Primero Civil',
    })).toEqual({
      sourceSlug: 'boletin_judicial_jalisco',
      expedienteNumber: '123/2026',
      expedienteYear: 2026,
      matter: 'Civil',
      judicialDistrict: 'Primer partido judicial',
      court: 'Juzgado Primero Civil',
    });
    expect(normalizeBulletinQuery({ sourceSlug: 'boletin_judicial_jalisco', expedienteNumber: 'CJJ01/2020', matter: '1', court: '101' }).expedienteNumber).toBe('CJJ01/2020');
  });

  it('parsea una respuesta pública sin inventar campos ausentes', () => {
    const parsed = parseJaliscoBulletinResponse({
      response: {
        Expedients: [{
          expedient: '123/2026',
          actor: 'Parte actora',
          defendant: 'Parte demandada',
          judgement_type: 'Ordinario civil',
          via: 'Escrito',
        }],
      },
    }, {
      sourceUrl: 'https://ciudadano.cjj.gob.mx/boletin_judicial/consultar',
      court: 'Juzgado Primero Civil',
      matter: 'Civil',
    });

    expect(parsed.status).toBe('PUBLISHED');
    expect(parsed.results).toHaveLength(1);
    expect(parsed.results[0]).toMatchObject({
      expedienteNumber: '123/2026',
      proceedingType: 'Ordinario civil',
      parties: { actor: 'Parte actora', defendant: 'Parte demandada' },
    });
    expect(parsed.results[0].publicationDate).toBeNull();
  });

  it('acepta el sobre real data.Expedients del API público de Jalisco', () => {
    const parsed = parseJaliscoBulletinResponse({ status: 200, code: 200, data: { Expedients: [{ expedient: '123/2026' }] } }, { sourceUrl: 'https://nilo.cjj.gob.mx/api/v1/electronic_expedients/find/123-2026/101/1' });
    expect(parsed.status).toBe('PUBLISHED');
    expect(parsed.results[0].expedienteNumber).toBe('123/2026');
  });

  it('interpreta el mensaje oficial de expediente no encontrado como corte sin resultados', () => {
    const parsed = parseJaliscoBulletinResponse({ status: 200, code: 200, data: { error: true, message: 'Expediente electrónico no encontrado' } }, { sourceUrl: 'https://nilo.cjj.gob.mx/api/v1' });
    expect(parsed.status).toBe('NOT_FOUND_AS_OF');
  });

  it('distingue fuente caída, autenticación y consulta no encontrada', () => {
    expect(classifyBulletinFailure(new Error('401 unauthorized'))).toBe('AUTH_REQUIRED');
    expect(classifyBulletinFailure(new Error('timeout'))).toBe('SOURCE_UNAVAILABLE');
    expect(classifyBulletinFailure(new Error('HTTP 429 rate limit'))).toBe('PENDING_RETRY');
    expect(classifyBulletinFailure(null)).toBe('NOT_FOUND_AS_OF');
    expect(BULLETIN_STATUSES).toContain('PENDING_RETRY');
  });

  it('no interpreta HTML/JSON con estructura desconocida como ausencia de publicación', () => {
    const parsed = parseJaliscoBulletinResponse({ changed: true }, { sourceUrl: 'https://official.example/boletin' });
    expect(parsed.status).toBe('SOURCE_CHANGED');
    expect(parsed.results).toHaveLength(0);
  });

  it('conserva el estado no encontrado cuando la fuente sí entrega una lista vacía', () => {
    expect(parseJaliscoBulletinResponse({ response: { Expedients: [] } }, { sourceUrl: 'https://official.example/boletin' }).status).toBe('NOT_FOUND_AS_OF');
  });

  it('clasifica autenticación, timeout y límite de fuente sin convertirlos en NOT_FOUND_AS_OF', async () => {
    const query = { sourceSlug: 'boletin_judicial_jalisco', expedienteNumber: '123/2026', matter: 'civil', court: 'Juzgado Primero' };
    const unauthorized = await queryJaliscoBulletin(query, { fetchImpl: async () => new Response('', { status: 401 }), timeoutMs: 1000 });
    expect(unauthorized.status).toBe('AUTH_REQUIRED');
    const rateLimited = await queryJaliscoBulletin(query, { fetchImpl: async () => new Response('', { status: 429 }), timeoutMs: 1000 });
    expect(rateLimited.status).toBe('PENDING_RETRY');
    const timeout = await queryJaliscoBulletin(query, { fetchImpl: async (_input, init) => new Promise((_resolve, reject) => { init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError'))); }), timeoutMs: 1000 });
    expect(timeout.status).toBe('SOURCE_UNAVAILABLE');
  });

  it('clasifica como autenticación un sobre 200 con error de token del catálogo', async () => {
    const authEnvelope = JSON.stringify({
      status: false,
      code: 403,
      data: { clean: true, error: true, message: 'Ha ocurrido un error durante la decodificación del token' },
    });
    const authRequired = await queryJaliscoBulletin({
      sourceSlug: 'boletin_judicial_jalisco',
      expedienteNumber: '123/2026',
      matter: 'Familiar',
      judicialDistrict: 'Partido Virtual Jalisco',
      court: 'Juzgado 1 Familiar Virtual',
    }, {
      fetchImpl: async () => new Response(authEnvelope, { status: 200, headers: { 'content-type': 'application/json' } }),
      timeoutMs: 1000,
    });
    expect(authRequired.status).toBe('AUTH_REQUIRED');
    expect(authRequired.errorCode).toBe('AUTH_REQUIRED');
  });

  it('genera una clave estable de deduplicación', () => {
    const input = {
      sourceId: 'source-jalisco',
      court: 'Juzgado Primero Civil',
      expedienteNumber: '123/2026',
      publicationDate: '2026-07-31T12:00:00.000Z',
      contentHash: 'abc123',
    };
    expect(buildBulletinDedupeKey(input)).toBe(buildBulletinDedupeKey({ ...input }));
    expect(buildBulletinDedupeKey({ ...input, contentHash: 'different' })).not.toBe(buildBulletinDedupeKey(input));
  });
});
