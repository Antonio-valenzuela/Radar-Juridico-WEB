import { describe, expect, it, vi } from 'vitest';
import {
  buildJurisprudenciaSearchWhere,
  normalizeOfficialSjfRecord,
  validateJurisprudenciaDraft,
} from '@/lib/jurisprudencia/validation';
import { importFromSJF } from '@/lib/jurisprudencia/sjfImporter';

describe('Jurisprudencia verificada', () => {
  it('permite registrar un borrador pendiente sin registro digital', () => {
    const result = validateJurisprudenciaDraft({
      rubro: 'Criterio pendiente de prueba',
      text: 'Texto pendiente de revisión oficial.',
      type: 'Tesis aislada',
      matter: 'Prueba',
    });

    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.data.registroDigital).toBeNull();
      expect(result.data.verificationStatus).toBe('pending');
    }
  });

  it('mapea todos los filtros de la interfaz a campos reales', () => {
    const where = buildJurisprudenciaSearchWhere({
      keyword: 'término',
      materia: 'Civil',
      registroDigital: 'fixture',
      organoEmisor: 'Órgano de prueba',
      epoca: 'Época de prueba',
      tipoCriterio: 'Jurisprudencia',
      fechaPublicacion: '2026-07-26',
    });

    expect(where).toMatchObject({
      matter: 'Civil',
      registroDigital: 'fixture',
      issuingBody: { contains: 'Órgano de prueba', mode: 'insensitive' },
      epoch: 'Época de prueba',
      type: 'Jurisprudencia',
      verificationStatus: 'verified',
    });
    expect(where.OR).toHaveLength(2);
    expect(where.publicationDate).toBeDefined();
  });

  it('aplica palabra clave y tema jurídico como filtros independientes', () => {
    const where = buildJurisprudenciaSearchWhere({
      keyword: 'pensión alimenticia',
      temaJuridico: 'capacidad económica',
    });

    expect(where.AND).toHaveLength(2);
    expect(where).not.toHaveProperty('OR');
  });

  it('normaliza sólo un payload oficial consistente con su URL', () => {
    const result = normalizeOfficialSjfRecord({
      registroDigital: '123',
      rubro: 'Criterio oficial de prueba',
      text: 'Texto oficial de prueba.',
      type: 'Jurisprudencia',
      matter: 'Prueba',
      officialUrl: 'https://sjf2.scjn.gob.mx/detalle/tesis/123',
      publicationDate: null,
    });

    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.data.verificationStatus).toBe('verified');
      expect(result.data.publicationDate).toBeNull();
    }
  });

  it('rechaza un registro cuya URL no coincide con el registro digital', () => {
    const result = normalizeOfficialSjfRecord({
      registroDigital: '123',
      rubro: 'Criterio de prueba',
      text: 'Texto de prueba.',
      type: 'Jurisprudencia',
      matter: 'Prueba',
      officialUrl: 'https://sjf2.scjn.gob.mx/detalle/tesis/456',
    });

    expect(result.valid).toBe(false);
  });

  it('se detiene sin persistir cuando SJF requiere navegador', async () => {
    const persist = vi.fn();
    const result = await importFromSJF(
      { records: [] },
      {
        checkHealth: vi.fn().mockResolvedValue({
          ok: true,
          accessible: true,
          status: 'BROWSER_REQUIRED',
          message: 'Requiere navegador',
          durationMs: 1,
          redirectsFollowed: 0,
          adapter: 'SJF',
        }),
        persist,
      }
    );

    expect(result.status).toBe('browser_required');
    expect(result.importedCount).toBe(0);
    expect(persist).not.toHaveBeenCalled();
  });

  it('nunca persiste payloads inválidos ni fabrica sustitutos', async () => {
    const persist = vi.fn();
    const result = await importFromSJF(
      {
        records: [
          {
            rubro: 'Sin registro ni URL',
            text: 'Texto incompleto.',
            type: 'Jurisprudencia',
            matter: 'Prueba',
          },
        ],
      },
      {
        checkHealth: vi.fn().mockResolvedValue({
          ok: true,
          accessible: true,
          status: 'OK',
          message: 'Accesible',
          durationMs: 1,
          redirectsFollowed: 0,
          adapter: 'SJF',
        }),
        persist,
      }
    );

    expect(result.status).toBe('payload_required');
    expect(result.importedCount).toBe(0);
    expect(persist).not.toHaveBeenCalled();
  });
});
