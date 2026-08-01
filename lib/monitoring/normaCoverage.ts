export type NormaDiffCandidate = {
  diffId: string;
  normaId: string;
  nombre: string;
  sigla: string | null;
  aliases: unknown;
  summaryBullets: unknown;
  createdAt: Date;
};

export type NormaDiffInsight = {
  diffId: string;
  normaId: string;
  nombre: string;
  sigla: string | null;
  summaryBullets: string[];
  createdAt: Date;
};

type DocumentIdentity = {
  shortCode: string | null;
  title: string;
};

function normalizeIdentity(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function stringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}

export function matchNormaDiffInsight(
  document: DocumentIdentity,
  candidates: NormaDiffCandidate[],
): NormaDiffInsight | null {
  const shortCode = document.shortCode ? normalizeIdentity(document.shortCode) : "";
  const title = normalizeIdentity(document.title);

  for (const candidate of candidates) {
    const candidateCodes = [candidate.sigla, ...stringList(candidate.aliases)]
      .filter((value): value is string => Boolean(value))
      .map(normalizeIdentity);
    const candidateNames = [candidate.nombre, ...stringList(candidate.aliases)].map(normalizeIdentity);
    const matchesShortCode = Boolean(shortCode) && candidateCodes.includes(shortCode);
    const matchesTitle = Boolean(title) && candidateNames.includes(title);

    if (!matchesShortCode && !matchesTitle) continue;

    return {
      diffId: candidate.diffId,
      normaId: candidate.normaId,
      nombre: candidate.nombre,
      sigla: candidate.sigla,
      summaryBullets: stringList(candidate.summaryBullets),
      createdAt: candidate.createdAt,
    };
  }

  return null;
}

export function legalChangesHref(insight: NormaDiffInsight) {
  return `/legal-hub/cambios?norma=${encodeURIComponent(insight.sigla || insight.normaId)}`;
}
