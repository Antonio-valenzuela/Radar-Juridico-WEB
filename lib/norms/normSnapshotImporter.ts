import { prisma } from '@/lib/prisma';
import { isOfficialLegalSourceUrl } from '@/lib/legal/officialSourceUrl';
import { validateUrlSafety } from '@/lib/security/urlValidation';
import { fetchOfficialUrl } from '@/lib/sources/officialFetch';
import {
  buildNormSnapshotPlan,
  classifyNormSnapshotVerification,
  computeContentHash,
} from '@/lib/norms/versioning';

const MAX_SOURCE_BYTES = 25 * 1024 * 1024;

export interface NormSnapshotImportInput {
  normId: string;
  sourceUrl: string;
  publishedAt?: Date | null;
  versionLabel?: string | null;
}

export interface NormSnapshotImportResult {
  success: boolean;
  changed: boolean;
  status:
    | 'verified'
    | 'unchanged'
    | 'manual_review'
    | 'session_required'
    | 'failed';
  message?: string;
  contentHash?: string;
  articlesCount?: number;
  versionId?: string;
}

const extractText = async (
  bytes: Uint8Array,
  contentType: string,
  sourceUrl: string
): Promise<string | null> => {
  if (
    contentType.toLowerCase().includes('application/pdf') ||
    new URL(sourceUrl).pathname.toLowerCase().endsWith('.pdf')
  ) {
    const { PDFParse } = await import('pdf-parse');
    const parser = new PDFParse({ data: bytes });
    try {
      const parsed = await parser.getText();
      return parsed.text.trim() || null;
    } finally {
      await parser.destroy();
    }
  }

  if (
    contentType.toLowerCase().includes('text/') ||
    contentType.toLowerCase().includes('html')
  ) {
    const raw = new TextDecoder('utf-8').decode(bytes);
    if (contentType.toLowerCase().includes('html')) {
      const { load } = await import('cheerio');
      const $ = load(raw);
      $('script, style, nav, header, footer, form').remove();
      return $.root().text().replace(/\s+/g, ' ').trim() || null;
    }
    return raw.trim() || null;
  }

  return null;
};

const recordFailure = async (
  normId: string,
  sourceUrl: string,
  error: string
): Promise<void> => {
  const norm = await prisma.norma.findUnique({
    where: { id: normId },
    select: { id: true },
  });
  if (!norm) return;

  await prisma.$transaction([
    prisma.normaSourceVerification.create({
      data: {
        normaId: normId,
        sourceUrl,
        status: 'failed',
        error,
      },
    }),
    prisma.norma.update({
      where: { id: normId },
      data: {
        lastCheckedAt: new Date(),
        verificationStatus: 'error',
        monitoringStatus: 'error',
        lastError: error,
      },
    }),
  ]);
};

export const importNormSnapshot = async (
  input: NormSnapshotImportInput
): Promise<NormSnapshotImportResult> => {
  if (!isOfficialLegalSourceUrl(input.sourceUrl)) {
    return {
      success: false,
      changed: false,
      status: 'failed',
      message: 'La URL no pertenece a una fuente oficial permitida.',
    };
  }

  try {
    const safety = await validateUrlSafety(input.sourceUrl);
    if (!safety.safe) {
      throw new Error(safety.error || 'La URL oficial no superó la validación de seguridad.');
    }

    const norm = await prisma.norma.findUnique({
      where: { id: input.normId },
      select: { id: true, currentHash: true },
    });
    if (!norm) {
      return {
        success: false,
        changed: false,
        status: 'failed',
        message: 'La norma no existe.',
      };
    }

    const fetched = await fetchOfficialUrl(input.sourceUrl, {
      method: 'GET',
      redirect: 'error',
      cache: 'no-store',
      headers: {
        Accept: 'application/pdf,text/html,text/plain,*/*',
        'User-Agent': 'JuridicoRadar/1.0 (verificación de fuente oficial)',
      },
    });
    if ([401, 403].includes(fetched.response.status)) {
      const checkedAt = new Date();
      await prisma.$transaction([
        prisma.normaSourceVerification.create({
          data: {
            normaId: input.normId,
            sourceUrl: input.sourceUrl,
            checkedAt,
            status: 'session_required',
            httpStatus: fetched.response.status,
            error:
              'La fuente requiere sesión o navegador autorizado; no se intentó eludir.',
          },
        }),
        prisma.norma.update({
          where: { id: input.normId },
          data: {
            lastCheckedAt: checkedAt,
            verificationStatus: 'manual_review',
            monitoringStatus: 'session_required',
            lastError:
              'La fuente requiere sesión o navegador autorizado; no se intentó eludir.',
          },
        }),
      ]);
      return {
        success: false,
        changed: false,
        status: 'session_required',
        message:
          'La fuente requiere sesión o navegador autorizado; no se intentó eludir.',
      };
    }
    if (!fetched.response.ok) {
      throw new Error(`La fuente oficial respondió HTTP ${fetched.response.status}.`);
    }

    const declaredLength = Number(
      fetched.response.headers.get('content-length') || 0
    );
    if (declaredLength > MAX_SOURCE_BYTES) {
      throw new Error('El documento oficial excede el límite de 25 MB.');
    }

    const bytes = new Uint8Array(await fetched.response.arrayBuffer());
    if (bytes.byteLength === 0 || bytes.byteLength > MAX_SOURCE_BYTES) {
      throw new Error('El documento oficial está vacío o excede el límite de 25 MB.');
    }

    const contentHash = computeContentHash(bytes);
    const contentType = fetched.response.headers.get('content-type') || '';
    let text: string | null = null;
    let extractionWarning: string | null = null;
    try {
      text = await extractText(bytes, contentType, input.sourceUrl);
      if (!text) extractionWarning = 'No se pudo extraer texto verificable del documento.';
    } catch {
      extractionWarning = 'No se pudo extraer texto verificable del documento.';
    }

    const plan = buildNormSnapshotPlan({
      previousHash: norm.currentHash,
      contentHash,
      sourceUrl: input.sourceUrl,
      text,
      publishedAt: input.publishedAt || null,
      versionLabel: input.versionLabel || null,
    });
    const checkedAt = new Date();
    const classification = classifyNormSnapshotVerification({
      changed: plan.changed,
      tlsRelaxed: fetched.tlsRelaxed,
      extractionWarning,
    });

    const result = await prisma.$transaction(async (tx) => {
      await tx.normaSourceVerification.create({
        data: {
          normaId: input.normId,
          sourceUrl: input.sourceUrl,
          checkedAt,
          status: classification.resultStatus,
          httpStatus: fetched.response.status,
          contentHash,
          error: classification.warning,
        },
      });

      if (!plan.changed || !plan.version) {
        await tx.norma.update({
          where: { id: input.normId },
          data: {
            lastCheckedAt: checkedAt,
            lastVerifiedAt:
              classification.verificationStatus === 'verified'
                ? checkedAt
                : undefined,
            verificationStatus: classification.verificationStatus,
            monitoringStatus: classification.warning
              ? 'manual_review'
              : 'current',
            lastError: classification.warning,
          },
        });
        return { versionId: undefined, articlesCount: 0 };
      }

      const version = await tx.normaVersion.create({
        data: {
          normaId: input.normId,
          ...plan.version,
          articles: {
            create: plan.articles.map((article) => ({
              normaId: input.normId,
              articleNumber: article.articleNumber,
              heading: article.heading,
              text: article.text,
              sourceUrl: article.sourceUrl,
            })),
          },
        },
      });

      await tx.norma.update({
        where: { id: input.normId },
        data: {
          urlBase: input.sourceUrl,
          currentHash: contentHash,
          lastCheckedAt: checkedAt,
          lastVerifiedAt:
            classification.verificationStatus === 'verified'
              ? checkedAt
              : undefined,
          verificationStatus: classification.verificationStatus,
          monitoringStatus: classification.warning
            ? 'manual_review'
            : 'current',
          lastError: classification.warning,
        },
      });

      return { versionId: version.id, articlesCount: plan.articles.length };
    });

    return {
      success: true,
      changed: plan.changed,
      status: classification.resultStatus,
      contentHash,
      versionId: result.versionId,
      articlesCount: result.articlesCount,
      message: classification.warning || undefined,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Falló la importación controlada.';
    await recordFailure(input.normId, input.sourceUrl, message).catch(() => undefined);
    return {
      success: false,
      changed: false,
      status: 'failed',
      message,
    };
  }
};
