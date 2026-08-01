import { describe, expect, it } from 'vitest';
import {
  buildNormSnapshotPlan,
  classifyNormSnapshotVerification,
  compareNormArticles,
  computeContentHash,
  extractNormArticles,
  validateVerifiedReformInput,
} from '@/lib/norms/versioning';

describe('Versionado normativo controlado', () => {
  it('calcula SHA-256 determinista sobre los bytes oficiales', () => {
    const first = computeContentHash(new TextEncoder().encode('contenido oficial'));
    const second = computeContentHash(new TextEncoder().encode('contenido oficial'));
    const changed = computeContentHash(new TextEncoder().encode('contenido distinto'));

    expect(first).toMatch(/^[a-f0-9]{64}$/);
    expect(second).toBe(first);
    expect(changed).not.toBe(first);
  });

  it('no crea una versión duplicada cuando el hash no cambió', () => {
    const plan = buildNormSnapshotPlan({
      previousHash: 'same-hash',
      contentHash: 'same-hash',
      sourceUrl: 'https://www.diputados.gob.mx/',
      text: 'Texto recibido.',
      publishedAt: null,
      versionLabel: null,
    });

    expect(plan.changed).toBe(false);
    expect(plan.version).toBeNull();
  });

  it('crea un plan de versión únicamente con contenido recibido', () => {
    const plan = buildNormSnapshotPlan({
      previousHash: 'old-hash',
      contentHash: 'new-hash',
      sourceUrl: 'https://www.diputados.gob.mx/',
      text: 'Artículo 1. Texto recibido de la fuente.\nArtículo 2. Segundo texto.',
      publishedAt: null,
      versionLabel: 'Versión verificada de prueba',
    });

    expect(plan.changed).toBe(true);
    expect(plan.version?.hash).toBe('new-hash');
    expect(plan.version?.publishedAt).toBeNull();
    expect(plan.articles.map((article) => article.articleNumber)).toEqual(['1', '2']);
  });

  it('no inventa artículos cuando el texto no contiene estructura identificable', () => {
    expect(extractNormArticles('Documento sin encabezados de artículos.')).toEqual([]);
    expect(extractNormArticles('')).toEqual([]);
  });

  it('compara versiones por número de artículo', () => {
    const comparison = compareNormArticles(
      [
        { articleNumber: '1', text: 'Texto anterior.' },
        { articleNumber: '2', text: 'Artículo eliminado.' },
      ],
      [
        { articleNumber: '1', text: 'Texto reformado.' },
        { articleNumber: '3', text: 'Artículo agregado.' },
      ]
    );

    expect(comparison).toEqual([
      {
        articleNumber: '1',
        status: 'modified',
        before: 'Texto anterior.',
        after: 'Texto reformado.',
      },
      {
        articleNumber: '2',
        status: 'removed',
        before: 'Artículo eliminado.',
        after: null,
      },
      {
        articleNumber: '3',
        status: 'added',
        before: null,
        after: 'Artículo agregado.',
      },
    ]);
  });

  it('exige metadatos verificables antes de registrar una reforma', () => {
    expect(
      validateVerifiedReformInput({
        publicationDate: null,
        officialUrl: 'https://www.dof.gob.mx/',
        articlesChanged: [],
      })
    ).toEqual({
      valid: false,
      error: expect.stringContaining('fecha de publicación'),
    });
  });

  it('rechaza URLs no oficiales aunque tengan metadatos completos', () => {
    expect(
      validateVerifiedReformInput({
        publicationDate: new Date('2026-07-26T00:00:00.000Z'),
        officialUrl: 'https://example.com/reforma',
        articlesChanged: ['1'],
      })
    ).toEqual({
      valid: false,
      error: expect.stringContaining('URL oficial'),
    });
  });

  it('no oculta una revisión manual cuando el hash permanece igual', () => {
    expect(
      classifyNormSnapshotVerification({
        changed: false,
        tlsRelaxed: true,
        extractionWarning: null,
      })
    ).toEqual({
      verificationStatus: 'manual_review',
      resultStatus: 'manual_review',
      warning: 'La fuente requirió validación TLS limitada.',
    });

    expect(
      classifyNormSnapshotVerification({
        changed: false,
        tlsRelaxed: false,
        extractionWarning: null,
      })
    ).toEqual({
      verificationStatus: 'verified',
      resultStatus: 'unchanged',
      warning: null,
    });
  });
});
