import { createHash } from 'node:crypto';

export type BulletinDedupeInput = {
  sourceId: string;
  court?: string | null;
  expedienteNumber: string;
  publicationDate: string | Date | null;
  contentHash: string;
};

export function buildBulletinDedupeKey(input: BulletinDedupeInput) {
  const date = input.publicationDate instanceof Date
    ? input.publicationDate.toISOString()
    : input.publicationDate || 'unknown-date';
  return createHash('sha256')
    .update([
      input.sourceId.trim().toLowerCase(),
      (input.court || '').trim().toLowerCase(),
      input.expedienteNumber.trim().toLowerCase(),
      date,
      input.contentHash.trim().toLowerCase(),
    ].join('|'))
    .digest('hex');
}

export function hashBulletinContent(value: unknown) {
  return createHash('sha256').update(JSON.stringify(value, (_key, item) => item instanceof Date ? item.toISOString() : item)).digest('hex');
}
