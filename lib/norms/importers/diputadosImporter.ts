import {
  importNormSnapshot,
  type NormSnapshotImportResult,
} from '@/lib/norms/normSnapshotImporter';

export const importFromDiputados = (
  normId: string,
  pdfUrl: string,
  metadata: { publishedAt?: Date | null; versionLabel?: string | null } = {}
): Promise<NormSnapshotImportResult> =>
  importNormSnapshot({
    normId,
    sourceUrl: pdfUrl,
    publishedAt: metadata.publishedAt,
    versionLabel: metadata.versionLabel,
  });
