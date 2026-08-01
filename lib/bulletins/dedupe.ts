import { createHash } from 'node:crypto';
import { normalizeCaseNumber } from '@/lib/bulletins/types';

export type BulletinDedupeInput = {
  provider?: string;
  matterId?: string;
  caseNumber?: string;
  courtExternalId?: string | null;
  publicationDate?: string | Date | null;
  agreementDate?: string | Date | null;
  text?: string;
  sourceId?: string | null;
  court?: string | null;
  expedienteNumber?: string | null;
  contentHash?: string | null;
};

function normalizedText(value: string | null | undefined) {
  return (value || '')
    .normalize('NFKC')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function normalizedDate(value: string | Date | null | undefined) {
  if (value instanceof Date) return value.toISOString();
  return normalizedText(value || '') || 'unknown-date';
}

export function buildBulletinDedupeKey(input: BulletinDedupeInput) {
  const provider = input.provider || input.sourceId || 'jalisco-cjj';
  const matterId = input.matterId || 'general';
  const caseNumber = input.caseNumber || input.expedienteNumber || '';
  const courtExternalId = input.courtExternalId || input.court || null;
  const text = input.text || input.contentHash || '';

  return createHash('sha256')
    .update([
      normalizedText(provider),
      normalizedText(matterId),
      normalizeCaseNumber(caseNumber),
      normalizedText(courtExternalId),
      normalizedDate(input.publicationDate),
      normalizedDate(input.agreementDate),
      normalizedText(text),
    ].join('|'))
    .digest('hex');
}

export function buildBulletinAlertDedupeKey(matterId: string, publicationId: string) {
  return createHash('sha256')
    .update(`${normalizedText(matterId)}|${normalizedText(publicationId)}|BULLETIN_NEW_PUBLICATION`)
    .digest('hex');
}

export function hashBulletinContent(value: unknown) {
  return createHash('sha256').update(JSON.stringify(value, (_key, item) => item instanceof Date ? item.toISOString() : item)).digest('hex');
}

export function hashBulletinEntryContent(entry: {
  expedienteNumber: string;
  court?: string | null;
  publicationDate?: string | Date | null;
  agreementDate?: string | Date | null;
  proceedingType?: string | null;
  heading?: string | null;
  extract?: string | null;
  parties?: Record<string, unknown> | null;
}) {
  return hashBulletinContent({
    expedienteNumber: normalizeCaseNumber(entry.expedienteNumber),
    court: normalizedText(entry.court),
    publicationDate: normalizedDate(entry.publicationDate),
    agreementDate: normalizedDate(entry.agreementDate),
    proceedingType: normalizedText(entry.proceedingType),
    heading: normalizedText(entry.heading),
    extract: normalizedText(entry.extract),
    parties: entry.parties || null,
  });
}
