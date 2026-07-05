import type { WeeklyDigestDocument, WeeklyDigestResult } from "./tasks";

export function generateWeeklyDigest(input: {
  documents: WeeklyDigestDocument[];
  periodStart: Date | string;
  periodEnd: Date | string;
}): WeeklyDigestResult {
  const periodStart = toIsoDate(input.periodStart);
  const periodEnd = toIsoDate(input.periodEnd);
  const matters: Record<string, number> = {};
  const sources: Record<string, number> = {};
  const highImpactDocs: WeeklyDigestDocument[] = [];

  for (const document of input.documents) {
    const matter = normalizeBucket(document.matter, "sin_materia");
    matters[matter] = (matters[matter] || 0) + 1;

    if (document.source) {
      sources[document.source] = (sources[document.source] || 0) + 1;
    }

    if (isHighImpact(document.impactLevel)) {
      highImpactDocs.push(document);
    }
  }

  const highlights = highImpactDocs.slice(0, 8).map((document) => {
    const source = document.source ? ` (${document.source})` : "";
    return `${document.title}${source}`;
  });

  return {
    title: `Resumen regulatorio semanal ${periodStart} a ${periodEnd}`,
    periodStart,
    periodEnd,
    totalDocuments: input.documents.length,
    highImpactCount: highImpactDocs.length,
    matters,
    highlights,
    recommendations: buildRecommendations(input.documents.length, highImpactDocs.length, matters, sources),
  };
}

function buildRecommendations(
  totalDocuments: number,
  highImpactCount: number,
  matters: Record<string, number>,
  sources: Record<string, number>
) {
  if (!totalDocuments) return [];

  const recommendations = ["Revisar documentos de alto impacto antes del siguiente corte semanal."];
  const topMatter = topEntry(matters);
  const topSource = topEntry(sources);

  if (topMatter) recommendations.push(`Priorizar seguimiento de materia ${topMatter[0]}.`);
  if (topSource) recommendations.push(`Validar publicaciones provenientes de ${topSource[0]}.`);
  if (!highImpactCount) recommendations.push("Mantener monitoreo; no se detectaron documentos de alto impacto.");

  return recommendations.slice(0, 4);
}

function topEntry(record: Record<string, number>) {
  return Object.entries(record).sort((a, b) => b[1] - a[1])[0];
}

function isHighImpact(value: string | null | undefined) {
  return ["high", "alto", "alta"].includes(String(value || "").toLowerCase());
}

function normalizeBucket(value: string | null | undefined, fallback: string) {
  const normalized = String(value || "").trim().toLowerCase();
  return normalized || fallback;
}

function toIsoDate(value: Date | string) {
  return new Date(value).toISOString().slice(0, 10);
}
