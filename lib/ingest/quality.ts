/** Quality gate shared by public search, RAG, embeddings and alerts. */
export type DocumentQualityStatus = 'verified' | 'valid' | 'pending_review' | 'invalid' | 'quarantined' | 'suspicious' | 'unknown';

const PUBLIC_STATUSES = new Set<DocumentQualityStatus>(['verified', 'valid']);

export function isQualityStatusSearchable(status: unknown): boolean {
  return typeof status !== 'string' || PUBLIC_STATUSES.has(status.trim().toLowerCase() as DocumentQualityStatus);
}

export function qualityStatusFromRaw(raw: unknown): DocumentQualityStatus | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const value = (raw as Record<string, unknown>).qualityStatus;
  return typeof value === 'string' ? value.trim().toLowerCase() as DocumentQualityStatus : null;
}

/** Legacy records without quality metadata remain searchable; explicit review states never do. */
export function isPubliclySearchableQuality(raw: unknown): boolean {
  const status = qualityStatusFromRaw(raw);
  return status === null || isQualityStatusSearchable(status);
}

export function qualityStatusForIngest(raw: unknown): DocumentQualityStatus {
  return qualityStatusFromRaw(raw) || 'unknown';
}
