import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  prisma: {
    item: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    document: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    documentVersion: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  },
  embeddingsAdd: vi.fn(),
  processItemNormaDiff: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({ prisma: mocks.prisma }));
vi.mock('@/lib/queue', () => ({ embeddingsQueue: { add: mocks.embeddingsAdd } }));
vi.mock('@/lib/normas/process', () => ({ processItemNormaDiff: mocks.processItemNormaDiff }));

import { saveDedupedItem } from '@/lib/ingest/dedupe';

const item = {
  source: 'SIDOF',
  sourceId: 'sidof-1',
  title: 'Publicación de prueba',
  url: 'https://example.test/item/1',
  canonicalUrl: 'https://example.test/item/1',
  published: new Date('2026-07-31T00:00:00.000Z'),
  retrievedAt: new Date('2026-07-31T01:00:00.000Z'),
  summary: 'Resumen de prueba',
  rawRef: null,
  raw: { text: 'Contenido de prueba' },
} as never;

describe('saveDedupedItem encola embeddings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.embeddingsAdd.mockResolvedValue({ id: 'job-1' });
    mocks.processItemNormaDiff.mockResolvedValue(undefined);
  });

  it('encola la versión creada después de persistirla', async () => {
    mocks.prisma.item.findFirst.mockResolvedValue(null);
    mocks.prisma.item.create.mockResolvedValue({ id: 'item-1' });
    mocks.prisma.document.findFirst.mockResolvedValue(null);
    mocks.prisma.document.create.mockResolvedValue({ id: 'document-1' });
    mocks.prisma.documentVersion.findFirst.mockResolvedValue(null);
    mocks.prisma.documentVersion.create.mockResolvedValue({ id: 'version-1' });

    await saveDedupedItem(item);

    expect(mocks.prisma.documentVersion.create).toHaveBeenCalledOnce();
    expect(mocks.embeddingsAdd).toHaveBeenCalledWith('index-document-version', {
      documentVersionId: 'version-1',
    });
    expect(mocks.prisma.documentVersion.create.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.embeddingsAdd.mock.invocationCallOrder[0],
    );
  });

  it('encola la versión actualizada cuando el documento ya existe', async () => {
    mocks.prisma.item.findFirst.mockResolvedValue({ id: 'item-1' });
    mocks.prisma.item.update.mockResolvedValue({ id: 'item-1' });
    mocks.prisma.document.findFirst.mockResolvedValue({ id: 'document-1' });
    mocks.prisma.document.update.mockResolvedValue({ id: 'document-1' });
    mocks.prisma.documentVersion.findFirst.mockResolvedValue({ id: 'version-1' });
    mocks.prisma.documentVersion.update.mockResolvedValue({ id: 'version-1' });

    await saveDedupedItem(item);

    expect(mocks.prisma.documentVersion.update).toHaveBeenCalledOnce();
    expect(mocks.embeddingsAdd).toHaveBeenCalledWith('index-document-version', {
      documentVersionId: 'version-1',
    });
  });

  it('conserva el guardado si Redis rechaza el job de embeddings', async () => {
    mocks.prisma.item.findFirst.mockResolvedValue(null);
    mocks.prisma.item.create.mockResolvedValue({ id: 'item-1' });
    mocks.prisma.document.findFirst.mockResolvedValue(null);
    mocks.prisma.document.create.mockResolvedValue({ id: 'document-1' });
    mocks.prisma.documentVersion.findFirst.mockResolvedValue(null);
    mocks.prisma.documentVersion.create.mockResolvedValue({ id: 'version-1' });
    mocks.embeddingsAdd.mockRejectedValueOnce(new Error('Redis no disponible'));
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    await expect(saveDedupedItem(item)).resolves.toMatchObject({ created: true, id: 'item-1' });

    expect(warn).toHaveBeenCalledWith(
      '[embeddings] no se pudo encolar indexación',
      'document-1',
      expect.any(Error),
    );
    warn.mockRestore();
  });
});
