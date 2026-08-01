import type { Prisma } from '@prisma/client';
import { isOfficialLegalSourceUrl } from '@/lib/legal/officialSourceUrl';

const VALID_TYPES = new Set([
  'Jurisprudencia',
  'Tesis aislada',
  'Precedente',
]);

const text = (value: unknown, maxLength: number): string | null => {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized ? normalized.slice(0, maxLength) : null;
};

export interface JurisprudenciaData {
  registroDigital: string | null;
  rubro: string;
  text: string;
  type: string;
  matter: string;
  epoch: string | null;
  instance: string | null;
  issuingBody: string | null;
  publicationDate: Date | null;
  sourceUrl: string | null;
  officialUrl: string | null;
  verificationStatus: 'pending' | 'verified';
  lastVerifiedAt: Date | null;
}

type ValidationResult =
  | { valid: true; data: JurisprudenciaData }
  | { valid: false; error: string };

export const validateJurisprudenciaDraft = (
  input: Record<string, unknown>
): ValidationResult => {
  const rubro = text(input.rubro, 1_000);
  const criterionText = text(input.text, 100_000);
  const type = text(input.type, 50);
  const matter = text(input.matter, 100);
  if (!rubro || !criterionText || !type || !matter || !VALID_TYPES.has(type)) {
    return {
      valid: false,
      error: 'Rubro, texto, tipo y materia válidos son requeridos.',
    };
  }

  return {
    valid: true,
    data: {
      registroDigital: text(input.registroDigital, 80),
      rubro,
      text: criterionText,
      type,
      matter,
      epoch: text(input.epoch, 100),
      instance: text(input.instance, 200),
      issuingBody: text(input.issuingBody, 300),
      publicationDate: null,
      sourceUrl: null,
      officialUrl: null,
      verificationStatus: 'pending',
      lastVerifiedAt: null,
    },
  };
};

export const normalizeOfficialSjfRecord = (
  input: Record<string, unknown>
): ValidationResult => {
  const draft = validateJurisprudenciaDraft(input);
  if (!draft.valid) return draft;

  const registroDigital = text(input.registroDigital, 80);
  const officialUrl = text(input.officialUrl, 2_000);
  if (!registroDigital || !/^\d+$/.test(registroDigital) || !officialUrl) {
    return {
      valid: false,
      error: 'El payload oficial requiere registro digital y URL.',
    };
  }
  if (!isOfficialLegalSourceUrl(officialUrl)) {
    return { valid: false, error: 'La URL no es una fuente oficial permitida.' };
  }

  const expectedPath = `/detalle/tesis/${registroDigital}`;
  const parsedUrl = new URL(officialUrl);
  if (
    parsedUrl.hostname.toLowerCase() !== 'sjf2.scjn.gob.mx' ||
    parsedUrl.pathname.replace(/\/$/, '') !== expectedPath
  ) {
    return {
      valid: false,
      error: 'La URL oficial no coincide con el registro digital.',
    };
  }

  let publicationDate: Date | null = null;
  if (input.publicationDate instanceof Date) {
    publicationDate = Number.isNaN(input.publicationDate.getTime())
      ? null
      : input.publicationDate;
  } else if (typeof input.publicationDate === 'string' && input.publicationDate) {
    const parsedDate = new Date(input.publicationDate);
    if (!Number.isNaN(parsedDate.getTime())) publicationDate = parsedDate;
  }

  return {
    valid: true,
    data: {
      ...draft.data,
      registroDigital,
      publicationDate,
      sourceUrl: officialUrl,
      officialUrl,
      verificationStatus: 'verified',
      lastVerifiedAt: new Date(),
    },
  };
};

interface JurisprudenciaSearchInput {
  keyword?: unknown;
  materia?: unknown;
  registroDigital?: unknown;
  organoEmisor?: unknown;
  epoca?: unknown;
  tipoCriterio?: unknown;
  fechaPublicacion?: unknown;
  temaJuridico?: unknown;
}

export const buildJurisprudenciaSearchWhere = (
  input: JurisprudenciaSearchInput
): Prisma.JurisprudenciaWhereInput => {
  const keyword = text(input.keyword, 300);
  const legalTopic = text(input.temaJuridico, 300);
  const searchTerms = [keyword, legalTopic].filter(
    (value): value is string => Boolean(value)
  );
  const textClause = (term: string): Prisma.JurisprudenciaWhereInput => ({
    OR: [
      { rubro: { contains: term, mode: 'insensitive' } },
      { text: { contains: term, mode: 'insensitive' } },
    ],
  });
  const date = text(input.fechaPublicacion, 20);
  let publicationDate:
    | Prisma.DateTimeNullableFilter<'Jurisprudencia'>
    | undefined;

  if (date) {
    const from = new Date(`${date}T00:00:00.000Z`);
    if (!Number.isNaN(from.getTime())) {
      const to = new Date(from);
      to.setUTCDate(to.getUTCDate() + 1);
      publicationDate = { gte: from, lt: to };
    }
  }

  return {
    verificationStatus: 'verified',
    ...(text(input.materia, 100) ? { matter: text(input.materia, 100)! } : {}),
    ...(text(input.registroDigital, 80)
      ? { registroDigital: text(input.registroDigital, 80)! }
      : {}),
    ...(text(input.organoEmisor, 300)
      ? {
          issuingBody: {
            contains: text(input.organoEmisor, 300)!,
            mode: 'insensitive',
          },
        }
      : {}),
    ...(text(input.epoca, 100) ? { epoch: text(input.epoca, 100)! } : {}),
    ...(text(input.tipoCriterio, 50)
      ? { type: text(input.tipoCriterio, 50)! }
      : {}),
    ...(publicationDate ? { publicationDate } : {}),
    ...(searchTerms.length === 1
      ? textClause(searchTerms[0])
      : searchTerms.length > 1
        ? { AND: searchTerms.map(textClause) }
        : {}),
  };
};
