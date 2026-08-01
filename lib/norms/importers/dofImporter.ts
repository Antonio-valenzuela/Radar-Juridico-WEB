import { prisma } from '@/lib/prisma';
import { validateVerifiedReformInput } from '@/lib/norms/versioning';

export interface VerifiedReformMetadata {
  verified: true;
  publicationDate: Date;
  description?: string | null;
  articlesChanged: string[];
}

export interface ReformImportResult {
  success: boolean;
  status: 'created' | 'metadata_required' | 'failed';
  message?: string;
  reformId?: string;
}

export const importReformFromDOF = async (
  normId: string,
  dofUrl: string,
  metadata?: VerifiedReformMetadata
): Promise<ReformImportResult> => {
  if (!metadata?.verified) {
    return {
      success: false,
      status: 'metadata_required',
      message:
        'Se requieren metadatos extraídos y verificados de la publicación oficial.',
    };
  }

  const validation = validateVerifiedReformInput({
    publicationDate: metadata.publicationDate,
    officialUrl: dofUrl,
    articlesChanged: metadata.articlesChanged,
  });
  if (!validation.valid) {
    return {
      success: false,
      status: 'metadata_required',
      message: validation.error,
    };
  }

  try {
    const reform = await prisma.normaReform.upsert({
      where: {
        normaId_officialUrl: {
          normaId: normId,
          officialUrl: dofUrl,
        },
      },
      update: {
        publicationDate: metadata.publicationDate,
        description: metadata.description || null,
        articlesChanged: metadata.articlesChanged.map((article) => article.trim()),
      },
      create: {
        normaId: normId,
        publicationDate: metadata.publicationDate,
        officialUrl: dofUrl,
        description: metadata.description || null,
        articlesChanged: metadata.articlesChanged.map((article) => article.trim()),
      },
    });

    await prisma.norma.update({
      where: { id: normId },
      data: { lastReformDate: metadata.publicationDate },
    });

    return { success: true, status: 'created', reformId: reform.id };
  } catch {
    return {
      success: false,
      status: 'failed',
      message: 'No fue posible registrar la reforma verificada.',
    };
  }
};
