import { describe, expect, it, vi } from 'vitest';
import {
  deriveLegacyBulletinStatus,
  normalizeCaseNumber,
  queryFailureResult,
} from '@/lib/bulletins/types';
import { buildBulletinEvidence } from '@/lib/bulletins/evidence';
import {
  parseJaliscoBulletinResponse,
  queryJaliscoBulletin,
} from '@/lib/bulletins/adapters/jalisco';
import {
  buildBulletinAlertDedupeKey,
  buildBulletinDedupeKey,
} from '@/lib/bulletins/dedupe';

describe('contrato estable del Boletín Judicial', () => {
  it('mantiene separados el estado técnico y el estado de publicación', () => {
    const result = queryFailureResult({
      queryStatus: 'SOURCE_UNAVAILABLE',
      sourceUrl: 'https://official.example/boletin',
      errorCode: 'NETWORK_ERROR',
    });

    expect(result.queryStatus).toBe('SOURCE_UNAVAILABLE');
    expect(result.publicationStatus).toBe('UNKNOWN');
    expect(deriveLegacyBulletinStatus(result)).toBe('SOURCE_UNAVAILABLE');
    expect(result.publicationStatus).not.toBe('NO_PUBLICATION_FOUND_AS_OF');
  });

  it('normaliza variantes del número de expediente sin usar la hora actual', () => {
    expect(normalizeCaseNumber(' 00123 / 2026 ')).toBe('123/2026');
    expect(normalizeCaseNumber('123-2026')).toBe('123/2026');
    expect(normalizeCaseNumber('CJJ 123 / 26')).toBe('CJJ123/2026');
  });

  it('redacta secretos y limita el snapshot de evidencia', () => {
    const evidence = buildBulletinEvidence({
      provider: 'CJJ_JALISCO',
      sourceUrl: 'https://official.example/boletin?token=secret&date=2026-08-01',
      requestParams: {
        courtId: '10',
        authorization: 'secret',
        csrfToken: 'secret',
      },
      httpStatus: 200,
      contentType: 'application/json',
      adapterVersion: '2.0.0',
      responseHash: 'abc',
      responseSnapshot: `${'x'.repeat(5_000)} token=secret`,
      durationMs: 120,
      queryStatus: 'SUCCESS',
      publicationStatus: 'NO_PUBLICATION_FOUND_AS_OF',
    });

    expect(evidence.sourceUrl).toContain('token=%5BREDACTED%5D');
    expect(evidence.requestParams).toEqual({ courtId: '10' });
    expect(evidence.responseSnapshot?.length).toBeLessThanOrEqual(2_000);
    expect(JSON.stringify(evidence)).not.toContain('secret');
  });

  it('no afirma publicación si la fuente sólo acredita la existencia del expediente', () => {
    const parsed = parseJaliscoBulletinResponse({
      status: 200,
      code: 200,
      data: {
        Expedients: [{
          expedient: '123/2026',
          actor: 'PERSONA ACTORA',
          defendant: 'PERSONA DEMANDADA',
          judgement_type: 'Ordinario civil',
        }],
      },
    }, {
      sourceUrl: 'https://official.example/electronic_expedients/find/123-2026/10/2',
      court: 'Juzgado de prueba',
      matter: 'Civil',
      evidenceKind: 'electronic_expedient_match',
    });

    expect(parsed.status).toBe('MANUAL_REVIEW');
    expect(parsed.queryStatus).toBe('SUCCESS');
    expect(parsed.publicationStatus).toBe('CASE_EXISTS_NOT_BULLETIN_CONFIRMED');
    expect(parsed.results).toHaveLength(0);
  });

  it('no afirma ausencia de publicación cuando el endpoint electrónico no encuentra el expediente', () => {
    const parsed = parseJaliscoBulletinResponse({
      status: 200,
      data: { error: true, message: 'Expediente electrónico no encontrado' },
    }, {
      sourceUrl: 'https://official.example/electronic_expedients/find/123-2026/10/2',
      evidenceKind: 'electronic_expedient_match',
    });

    expect(parsed.status).toBe('MANUAL_REVIEW');
    expect(parsed.queryStatus).toBe('SUCCESS');
    expect(parsed.publicationStatus).toBe('CASE_EXISTS_NOT_BULLETIN_CONFIRMED');
  });

  it('interpreta fechas mexicanas de forma explícita sin invertir día y mes', () => {
    const parsed = parseJaliscoBulletinResponse({
      data: { Expedients: [{ expedient: '123/2026', publication_date: '01/08/2026' }] },
    }, { sourceUrl: 'https://official.example/boletin' });

    expect(parsed.results[0].publicationDate?.toISOString()).toBe('2026-08-01T00:00:00.000Z');
  });

  it('detecta el CAPTCHA del portal y no dispara la consulta automática por defecto', async () => {
    const fetchImpl = vi.fn();
    const result = await queryJaliscoBulletin({
      sourceSlug: 'boletin_judicial_jalisco',
      expedienteNumber: '123/2026',
      matter: 'Civil',
      judicialDistrict: 'Primer Partido Judicial',
      court: 'Juzgado de prueba',
    }, { fetchImpl });

    expect(result.status).toBe('AUTH_REQUIRED');
    expect(result.queryStatus).toBe('CAPTCHA_REQUIRED');
    expect(result.publicationStatus).toBe('UNKNOWN');
    expect(result.discoveryClassification).toContain('CAPTCHA_PRESENT');
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('deduplica evidencia y alertas con claves estables sin Date.now', () => {
    const publication = buildBulletinDedupeKey({
      sourceId: 'cjj',
      court: ' Juzgado   Primero ',
      expedienteNumber: '00123-2026',
      publicationDate: '2026-08-01',
      agreementDate: '2026-07-31',
      contentHash: 'ABC',
    });
    expect(publication).toBe(buildBulletinDedupeKey({
      sourceId: 'CJJ',
      court: 'juzgado primero',
      expedienteNumber: '123/2026',
      publicationDate: '2026-08-01',
      agreementDate: '2026-07-31',
      contentHash: 'abc',
    }));
    expect(buildBulletinAlertDedupeKey('matter-1', 'publication-1')).toBe(
      buildBulletinAlertDedupeKey('matter-1', 'publication-1'),
    );
    expect(buildBulletinAlertDedupeKey('matter-2', 'publication-1')).not.toBe(
      buildBulletinAlertDedupeKey('matter-1', 'publication-1'),
    );
  });
});
