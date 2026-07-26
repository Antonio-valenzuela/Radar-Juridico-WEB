import {
  importNormSnapshot,
  type NormSnapshotImportResult,
} from '@/lib/norms/normSnapshotImporter';

export const importFromJalisco = (
  normId: string,
  officialUrl: string,
  metadata: { publishedAt?: Date | null; versionLabel?: string | null } = {}
): Promise<NormSnapshotImportResult> =>
  importNormSnapshot({
    normId,
    sourceUrl: officialUrl,
    publishedAt: metadata.publishedAt,
    versionLabel: metadata.versionLabel,
  });
