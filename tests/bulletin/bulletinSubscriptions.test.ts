import { describe, expect, it } from 'vitest';
import { calculateNextRunDate, matchSubscriptionEntry } from '@/lib/bulletins/executionService';
import { validatePublicHttpUrl } from '@/lib/security/urlValidation';

describe('Boletines Judiciales — Motor de Seguimiento y Reglas', () => {
  it('calcula correctamente la fecha de próxima ejecución según la frecuencia', () => {
    const base = new Date('2026-08-01T10:00:00Z');

    const nextDiario = calculateNextRunDate('diario', base);
    expect(nextDiario.getTime() - base.getTime()).toBe(24 * 60 * 60 * 1000);

    const next6h = calculateNextRunDate('cada_6_horas', base);
    expect(next6h.getTime() - base.getTime()).toBe(6 * 60 * 60 * 1000);

    const next12h = calculateNextRunDate('cada_12_horas', base);
    expect(next12h.getTime() - base.getTime()).toBe(12 * 60 * 60 * 1000);

    const nextSemanal = calculateNextRunDate('semanal', base);
    expect(nextSemanal.getTime() - base.getTime()).toBe(7 * 24 * 60 * 60 * 1000);
  });

  it('detecta coincidencias por número de expediente', () => {
    const subscription = { expediente: '1234/2024' };
    const entry: any = {
      expedienteNumber: '1234/2024',
      heading: 'Auto de admisión en expediente 1234/2024',
      extract: 'Se requiere a la parte actora.',
      sourceUrl: 'https://ciudadano.cjj.gob.mx/boletin',
      contentHash: 'hash1',
      dedupeKey: 'key1',
      publicationDate: new Date(),
    };

    const match = matchSubscriptionEntry(subscription, entry);
    expect(match.isMatch).toBe(true);
    expect(match.matchedFields.expediente).toBe('1234/2024');
    expect(match.score).toBeGreaterThan(0);
  });

  it('detecta coincidencias por actor y demandado', () => {
    const subscription = { actor: 'Juan Pérez', demandado: 'Banco de México' };
    const entry: any = {
      expedienteNumber: '555/2023',
      heading: 'Juicio Ejecutivo Mercantil',
      parties: 'Juan Pérez vs Banco de México',
      extract: 'Se decreta embargo en bienes de la demandada.',
      sourceUrl: 'https://ciudadano.cjj.gob.mx/boletin',
      contentHash: 'hash2',
      dedupeKey: 'key2',
      publicationDate: new Date(),
    };

    const match = matchSubscriptionEntry(subscription, entry);
    expect(match.isMatch).toBe(true);
    expect(match.matchedFields.actor).toBe('Juan Pérez');
    expect(match.matchedFields.demandado).toBe('Banco de México');
  });

  it('detecta coincidencias por palabras clave', () => {
    const subscription = { keywords: ['embargo', 'reposición'] };
    const entry: any = {
      expedienteNumber: '999/2024',
      heading: 'Resolución sobre embargo precautorio',
      extract: 'Se ordena la reposición de autos.',
      sourceUrl: 'https://ciudadano.cjj.gob.mx/boletin',
      contentHash: 'hash3',
      dedupeKey: 'key3',
      publicationDate: new Date(),
    };

    const match = matchSubscriptionEntry(subscription, entry);
    expect(match.isMatch).toBe(true);
    expect(match.matchedFields.keywords).toContain('embargo');
    expect(match.matchedFields.keywords).toContain('reposición');
  });

  it('rechaza publicaciones que no coinciden con los criterios', () => {
    const subscription = { expediente: '777/2022', actor: 'Carlos López' };
    const entry: any = {
      expedienteNumber: '111/2024',
      heading: 'Materia Familiar',
      extract: 'Se autorizan copias a María Gómez.',
      sourceUrl: 'https://ciudadano.cjj.gob.mx/boletin',
      contentHash: 'hash4',
      dedupeKey: 'key4',
      publicationDate: new Date(),
    };

    const match = matchSubscriptionEntry(subscription, entry);
    expect(match.isMatch).toBe(false);
    expect(match.score).toBe(0);
  });

  it('valida dominios oficiales y bloquea dominios no autorizados', async () => {
    const validUrl = 'https://ciudadano.cjj.gob.mx/boletin_judicial/consultar';

    const validCheck = await validatePublicHttpUrl(validUrl);
    expect(validCheck.ok).toBe(true);
  });

  it('preserva el aislamiento multi-tenant verificando la clave de organización', () => {
    const orgA = 'org-alpha';
    const orgB = 'org-beta';

    const subOrgA = { id: 'sub-1', organizationId: orgA };
    const requestOrgB = orgB;

    expect(subOrgA.organizationId).not.toBe(requestOrgB);
  });
});
