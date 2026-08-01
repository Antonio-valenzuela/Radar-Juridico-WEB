import { describe, expect, it, vi } from 'vitest';

import {
  MANUAL_BULLETIN_LIMITS,
  ManualBulletinImportError,
  detectManualBulletinPublications,
  importManualBulletin,
  normalizeExpedienteNumber,
} from '@/lib/bulletins/manualImport';

function watch(overrides: Record<string, unknown> = {}) {
  return {
    id: 'watch-1',
    matterId: 'matter-1',
    sourceId: 'source-1',
    expedienteNumber: '123/2026',
    expedienteYear: 2026,
    matterLabel: 'Civil',
    judicialDistrict: 'Primer partido judicial',
    court: 'Juzgado Primero Civil',
    chamber: null,
    active: true,
    source: { id: 'source-1', baseUrl: 'https://official.example/boletin' },
    matter: { organizationId: 'org-1' },
    ...overrides,
  };
}

function database(options: {
  watches?: ReturnType<typeof watch>[];
  duplicate?: boolean;
  linkedMatterIds?: string[];
} = {}) {
  return {
    caseBulletinWatch: {
      findMany: vi.fn().mockResolvedValue(options.watches || [watch()]),
    },
    judicialBulletinEntry: {
      findUnique: vi.fn().mockImplementation(async () => options.duplicate ? {
        id: 'entry-existing',
        matterLinks: (options.linkedMatterIds || []).map((matterId) => ({ matterId })),
      } : null),
      create: vi.fn().mockImplementation(async ({ data }) => ({ id: 'entry-created', ...data })),
    },
    auditLog: {
      create: vi.fn().mockResolvedValue({ id: 'audit-1' }),
    },
  };
}

describe('importación manual de boletines', () => {
  const previewSecret = 'manual-import-test-secret-with-more-than-32-characters';

  it('normaliza variantes y detecta expedientes sin confundir el separador', () => {
    expect(normalizeExpedienteNumber(' Expediente 000123 - 2026 ')).toBe('123/2026');
    expect(normalizeExpedienteNumber('cjj01 / 2020')).toBe('CJJ01/2020');
    expect(normalizeExpedienteNumber('31/07/2026')).toBeNull();

    const publications = detectManualBulletinPublications([
      'Juzgado Primero Civil',
      'Expediente 000123 - 2026. Se dicta acuerdo de trámite.',
      '',
      'Exp. CJJ01/2020. Se requiere a la parte actora.',
    ].join('\n'));

    expect(publications.map((publication) => publication.expedienteNumber)).toEqual([
      '123/2026',
      'CJJ01/2020',
    ]);
    expect(publications[0].extract).toContain('acuerdo de trámite');
  });

  it('compara texto con watches sin persistir durante preview', async () => {
    const db = database();

    const result = await importManualBulletin({
      type: 'text',
      mode: 'preview',
      text: 'Expediente 123/2026. Acuerdo publicado para notificación.\n\nExpediente 999/2026. Sin vigilancia.',
    }, {
      organizationId: 'org-1',
      userId: 'user-1',
    }, { prisma: db as never, previewSecret });

    expect(result).toMatchObject({
      ok: true,
      mode: 'preview',
      origin: 'MANUAL_TEXT',
      publicationsAnalyzed: 2,
      watchedCasesFound: 1,
      newPublications: 1,
      duplicates: 0,
      unmatched: 1,
      saved: 0,
    });
    expect(result.previewToken).toEqual(expect.any(String));
    expect(result.previewExpiresAt).toEqual(expect.any(String));
    expect(result.publications[0].matches[0]).toMatchObject({ matterId: 'matter-1', watchId: 'watch-1' });
    expect(result.publications[0]).toMatchObject({
      expedienteNumber: '123/2026',
      heading: expect.any(String),
      extract: expect.stringContaining('Acuerdo publicado'),
      contentHash: expect.any(String),
      matches: [expect.objectContaining({
        matterId: 'matter-1',
        watchId: 'watch-1',
        duplicate: false,
      })],
    });
    expect(db.judicialBulletinEntry.create).not.toHaveBeenCalled();
    expect(db.auditLog.create).not.toHaveBeenCalled();
  });

  it('confirma publicaciones coincidentes y registra el origen manual', async () => {
    const db = database();
    const persistMatch = vi.fn().mockResolvedValue({ newResults: 1 });

    const preview = await importManualBulletin({
      type: 'text',
      mode: 'preview',
      text: 'Expediente 123/2026. Se publica nuevo acuerdo.',
    }, { organizationId: 'org-1', userId: 'user-1' }, {
      prisma: db as never,
      previewSecret,
    });

    const result = await importManualBulletin({
      type: 'text',
      mode: 'confirm',
      text: 'Expediente 123/2026. Se publica nuevo acuerdo.',
      previewToken: preview.previewToken,
    }, {
      organizationId: 'org-1',
      userId: 'user-1',
    }, { prisma: db as never, persistMatch, previewSecret });

    expect(result.saved).toBe(1);
    expect(persistMatch).toHaveBeenCalledWith(
      expect.objectContaining({ matterId: 'matter-1', sourceId: 'source-1' }),
      expect.objectContaining({
        queryStatus: 'SUCCESS',
        publicationStatus: 'NEW_PUBLICATIONS',
        origin: 'MANUAL_TEXT',
        results: [expect.objectContaining({ expedienteNumber: '123/2026', evidenceKind: 'manual_import' })],
      }),
      { organizationId: 'org-1', userId: 'user-1' },
    );
    expect(db.auditLog.create).toHaveBeenCalledOnce();
  });

  it('exige una vista previa concreta y rechaza contenido cambiado o expirado', async () => {
    const db = database();
    const issuedAt = new Date('2026-08-01T12:00:00.000Z');

    await expect(importManualBulletin({
      type: 'text',
      mode: 'confirm',
      text: 'Expediente 123/2026. Se publica nuevo acuerdo.',
    }, { organizationId: 'org-1' }, {
      prisma: db as never,
      previewSecret,
      now: () => issuedAt,
    })).rejects.toMatchObject({ code: 'PREVIEW_REQUIRED', status: 409 });

    const preview = await importManualBulletin({
      type: 'text',
      mode: 'preview',
      text: 'Expediente 123/2026. Se publica nuevo acuerdo.',
    }, { organizationId: 'org-1' }, {
      prisma: db as never,
      previewSecret,
      now: () => issuedAt,
    });

    await expect(importManualBulletin({
      type: 'text',
      mode: 'confirm',
      text: 'Expediente 999/2026. El contenido fue cambiado.',
      previewToken: preview.previewToken,
    }, { organizationId: 'org-1' }, {
      prisma: db as never,
      previewSecret,
      now: () => issuedAt,
    })).rejects.toMatchObject({ code: 'PREVIEW_MISMATCH', status: 409 });

    await expect(importManualBulletin({
      type: 'text',
      mode: 'confirm',
      text: 'Expediente 123/2026. Se publica nuevo acuerdo.',
      previewToken: preview.previewToken,
    }, { organizationId: 'org-1' }, {
      prisma: db as never,
      previewSecret,
      now: () => new Date('2026-08-01T12:11:00.000Z'),
    })).rejects.toMatchObject({ code: 'PREVIEW_EXPIRED', status: 409 });
  });

  it('vincula al expediente aunque la publicación global ya exista', async () => {
    const db = database({ duplicate: true });
    const persistMatch = vi.fn().mockResolvedValue({ newResults: 1 });

    const preview = await importManualBulletin({
      type: 'text',
      mode: 'preview',
      text: 'Expediente 123/2026. Se publica nuevo acuerdo.',
    }, { organizationId: 'org-1' }, { prisma: db as never, previewSecret });

    const result = await importManualBulletin({
      type: 'text',
      mode: 'confirm',
      text: 'Expediente 123/2026. Se publica nuevo acuerdo.',
      previewToken: preview.previewToken,
    }, { organizationId: 'org-1' }, { prisma: db as never, persistMatch, previewSecret });

    expect(persistMatch).toHaveBeenCalledOnce();
    expect(result).toMatchObject({ duplicates: 0, newPublications: 1, saved: 1 });
  });

  it('descarga únicamente URLs HTTPS públicas mediante safeFetch', async () => {
    const db = database();
    const fetchSafe = vi.fn().mockResolvedValue(new Response(
      'Expediente 123/2026. Acuerdo obtenido de URL pública.',
      { status: 200, headers: { 'content-type': 'text/plain; charset=utf-8' } },
    ));

    const result = await importManualBulletin({
      type: 'url',
      mode: 'preview',
      url: 'https://official.example/boletin.txt',
    }, { organizationId: 'org-1' }, { prisma: db as never, safeFetch: fetchSafe, previewSecret });

    expect(fetchSafe).toHaveBeenCalledWith(
      'https://official.example/boletin.txt',
      expect.objectContaining({ headers: expect.objectContaining({ Accept: expect.stringContaining('text/plain') }) }),
    );
    expect(result.origin).toBe('MANUAL_URL');

    await expect(importManualBulletin({
      type: 'url',
      mode: 'preview',
      url: 'http://official.example/boletin.txt',
    }, { organizationId: 'org-1' }, { prisma: db as never, safeFetch: fetchSafe, previewSecret })).rejects.toMatchObject({
      code: 'URL_NOT_HTTPS',
      status: 400,
    });
  });

  it('descarga con la URL original pero redacta secretos en resultado, persistencia y auditoría', async () => {
    const db = database();
    const persistMatch = vi.fn().mockResolvedValue({ newResults: 1 });
    const fetchSafe = vi.fn().mockImplementation(async () => new Response(
      'Expediente 123/2026. Acuerdo obtenido de URL pública.',
      { status: 200, headers: { 'content-type': 'text/plain' } },
    ));
    const secretUrl = 'https://official.example/boletin.txt?access_token=super-secret&date=2026-08-01#private';

    const preview = await importManualBulletin({
      type: 'url', mode: 'preview', url: secretUrl,
    }, { organizationId: 'org-1' }, { prisma: db as never, safeFetch: fetchSafe, previewSecret });

    expect(fetchSafe).toHaveBeenCalledWith(secretUrl, expect.any(Object));
    expect(preview.sourceUrl).not.toContain('super-secret');
    expect(preview.sourceUrl).not.toContain('#private');

    await importManualBulletin({
      type: 'url', mode: 'confirm', url: secretUrl, previewToken: preview.previewToken,
    }, { organizationId: 'org-1' }, {
      prisma: db as never,
      safeFetch: fetchSafe,
      persistMatch,
      previewSecret,
    });

    const adapterResult = persistMatch.mock.calls[0][1];
    expect(JSON.stringify(adapterResult)).not.toContain('super-secret');
    expect(JSON.stringify(adapterResult)).not.toContain('#private');
    expect(JSON.stringify(db.auditLog.create.mock.calls)).not.toContain('super-secret');
  });

  it('rechaza MIME desconocido y respuestas que exceden el límite', async () => {
    const db = database();
    const unknownMime = vi.fn().mockResolvedValue(new Response('binary', {
      status: 200,
      headers: { 'content-type': 'application/zip' },
    }));

    await expect(importManualBulletin({
      type: 'url',
      mode: 'preview',
      url: 'https://official.example/archive.zip',
    }, { organizationId: 'org-1' }, { prisma: db as never, safeFetch: unknownMime, previewSecret })).rejects.toMatchObject({
      code: 'UNSUPPORTED_MIME',
      status: 415,
    });

    await expect(importManualBulletin({
      type: 'text',
      mode: 'preview',
      text: 'x'.repeat(MANUAL_BULLETIN_LIMITS.textBytes + 1),
    }, { organizationId: 'org-1' }, { prisma: db as never, previewSecret })).rejects.toBeInstanceOf(ManualBulletinImportError);
  });

  it('extrae PDF con el parser inyectado y conserva MANUAL_PDF', async () => {
    const db = database();
    const parsePdf = vi.fn().mockResolvedValue('Expediente 123/2026. Acuerdo extraído del PDF.');

    const result = await importManualBulletin({
      type: 'pdf',
      mode: 'preview',
      bytes: new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]),
      mimeType: 'application/pdf',
      filename: 'boletin.pdf',
    }, { organizationId: 'org-1' }, { prisma: db as never, parsePdf, previewSecret });

    expect(parsePdf).toHaveBeenCalledOnce();
    expect(result).toMatchObject({ origin: 'MANUAL_PDF', publicationsAnalyzed: 1, watchedCasesFound: 1 });
  });

  it('rechaza un archivo disfrazado de PDF antes de invocar el parser', async () => {
    const db = database();
    const parsePdf = vi.fn();

    await expect(importManualBulletin({
      type: 'pdf',
      mode: 'preview',
      bytes: new TextEncoder().encode('MZ executable'),
      mimeType: 'application/pdf',
      filename: 'boletin.pdf',
    }, { organizationId: 'org-1' }, { prisma: db as never, parsePdf, previewSecret })).rejects.toMatchObject({
      code: 'INVALID_PDF',
      status: 422,
    });
    expect(parsePdf).not.toHaveBeenCalled();
  });
});

describe('ruta de importación manual de boletines', () => {
  it('traduce JSON de texto y conserva el contexto autorizado', async () => {
    vi.resetModules();
    const importSpy = vi.fn().mockResolvedValue({
      ok: true,
      mode: 'preview',
      origin: 'MANUAL_TEXT',
      publicationsAnalyzed: 1,
      watchedCasesFound: 1,
      newPublications: 1,
      duplicates: 0,
      unmatched: 0,
      saved: 0,
      publications: [],
    });
    vi.doMock('@/lib/cases/access', () => ({
      requireCaseAccess: vi.fn().mockResolvedValue({
        ok: true,
        context: { organizationId: 'org-route', userId: 'user-route', role: 'admin' },
      }),
    }));
    vi.doMock('@/lib/bulletins/manualImport', async () => ({
      ...(await vi.importActual<typeof import('@/lib/bulletins/manualImport')>('@/lib/bulletins/manualImport')),
      importManualBulletin: importSpy,
    }));

    const { POST } = await import('@/app/api/legal/bulletins/import/route');
    const response = await POST(new Request('http://localhost/api/legal/bulletins/import', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ type: 'text', mode: 'preview', text: 'Expediente 123/2026' }),
    }));

    expect(response.status).toBe(200);
    expect(importSpy).toHaveBeenCalledWith({
      type: 'text',
      mode: 'preview',
      text: 'Expediente 123/2026',
    }, {
      organizationId: 'org-route',
      userId: 'user-route',
    });
  });

  it('acepta PDF multipart y devuelve errores tipados con su status', async () => {
    vi.resetModules();
    const importSpy = vi.fn()
      .mockResolvedValueOnce({ ok: true, mode: 'preview', origin: 'MANUAL_PDF', publications: [] })
      .mockRejectedValueOnce(new ManualBulletinImportError('UNSUPPORTED_MIME', 'MIME no permitido.', 415));
    vi.doMock('@/lib/cases/access', () => ({
      requireCaseAccess: vi.fn().mockResolvedValue({
        ok: true,
        context: { organizationId: 'org-route', userId: 'user-route', role: 'admin' },
      }),
    }));
    vi.doMock('@/lib/bulletins/manualImport', async () => ({
      ...(await vi.importActual<typeof import('@/lib/bulletins/manualImport')>('@/lib/bulletins/manualImport')),
      importManualBulletin: importSpy,
    }));

    const { POST } = await import('@/app/api/legal/bulletins/import/route');
    const form = new FormData();
    form.set('mode', 'preview');
    form.set('file', new File([new Uint8Array([0x25, 0x50, 0x44, 0x46])], 'boletin.pdf', { type: 'application/pdf' }));
    const pdfResponse = await POST(new Request('http://localhost/api/legal/bulletins/import', {
      method: 'POST',
      body: form,
    }));

    expect(pdfResponse.status).toBe(200);
    expect(importSpy).toHaveBeenNthCalledWith(1, expect.objectContaining({
      type: 'pdf',
      mode: 'preview',
      mimeType: 'application/pdf',
      filename: 'boletin.pdf',
      bytes: expect.any(Uint8Array),
    }), { organizationId: 'org-route', userId: 'user-route' });

    const invalidResponse = await POST(new Request('http://localhost/api/legal/bulletins/import', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ type: 'url', mode: 'preview', url: 'https://official.example/file.zip' }),
    }));
    expect(invalidResponse.status).toBe(415);
    await expect(invalidResponse.json()).resolves.toMatchObject({ ok: false, error: 'UNSUPPORTED_MIME' });
  });
});
