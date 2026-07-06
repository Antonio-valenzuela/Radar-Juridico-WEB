/**
 * lib/search/relevanceScore.ts
 *
 * Semáforo de relevancia — puntuación explicable 0-100 para cada resultado
 * de búsqueda, basada en criterios jurídicamente significativos.
 *
 * Nivel de color:
 *  🔴 ALTA    80-100   — acción inmediata recomendada
 *  🟡 MEDIA   50-79    — revisar con prioridad moderada
 *  🟢 BAJA    20-49    — informativo, sin urgencia
 *  ⚫ MÍNIMA   0-19    — ruido o sin relación directa
 */

export type RelevanceLevel = "alta" | "media" | "baja" | "minima";

export interface RelevanceFactors {
  /** Materia jurídica (fiscal, laboral, civil, etc.) */
  materiaScore: number;
  /** Autoridad emisora (DOF > SCJN > estatal) */
  autoridadScore: number;
  /** Jurisdicción (federal, local, internacional) */
  jurisdiccionScore: number;
  /** Impacto declarado por clasificador */
  impactoScore: number;
  /** Recencia (más reciente = más relevante) */
  recenciaScore: number;
  /** Términos vigilados en watchlist */
  watchlistScore: number;
  /** Coincidencia textual con la query */
  textMatchScore: number;
}

export interface RelevanceResult {
  score: number;           // 0-100
  level: RelevanceLevel;
  color: string;           // emoji color indicator
  factors: RelevanceFactors;
  explanation: string[];   // bullets explicativos para el usuario
}

// ─── Materia weights ──────────────────────────────────────────────────────────

const MATERIA_WEIGHTS: Record<string, number> = {
  fiscal: 90,
  tributario: 90,
  aduanal: 90,
  comercio_exterior: 85,
  laboral: 85,
  penal: 85,
  constitucional: 85,
  administrativo: 75,
  civil: 70,
  mercantil: 70,
  ambiental: 65,
  salud: 65,
  regulatorio: 60,
};

function materiaScore(materia?: string | null, queryMateria?: string): number {
  if (!materia) return 40; // neutral
  const normalized = materia.toLowerCase();
  const base = MATERIA_WEIGHTS[normalized] ?? 50;

  // Boost if the query's stated matter matches the document's matter
  if (queryMateria && normalized.includes(queryMateria.toLowerCase())) return Math.min(100, base + 10);
  return base;
}

// ─── Autoridad weights ────────────────────────────────────────────────────────

const AUTORIDAD_WEIGHTS: Record<string, number> = {
  "dof-web": 95,
  dof: 95,
  sidof: 90,
  scjn: 88,
  sjf: 85,
  cjf: 80,
  diputados: 80,
  senado: 75,
  sat: 85,
  anam: 85,
  imss: 80,
  conamer: 70,
};

function autoridadScore(source?: string | null): number {
  if (!source) return 50;
  const key = source.toLowerCase().replace(/[\s-]+/g, "");
  for (const [k, v] of Object.entries(AUTORIDAD_WEIGHTS)) {
    if (key.includes(k)) return v;
  }
  return 45;
}

// ─── Impacto mapping ──────────────────────────────────────────────────────────

function impactoScore(impacto?: string | null): number {
  switch (impacto?.toLowerCase()) {
    case "alto": return 90;
    case "medio": return 60;
    case "bajo": return 30;
    default: return 40;
  }
}

// ─── Recencia ─────────────────────────────────────────────────────────────────

function recenciaScore(publishedAt?: string | Date | null): number {
  if (!publishedAt) return 30;
  const date = typeof publishedAt === "string" ? new Date(publishedAt) : publishedAt;
  const ageDays = (Date.now() - date.getTime()) / (1000 * 60 * 60 * 24);

  if (ageDays <= 7) return 100;
  if (ageDays <= 30) return 85;
  if (ageDays <= 90) return 70;
  if (ageDays <= 180) return 55;
  if (ageDays <= 365) return 40;
  return 20;
}

// ─── Watchlist ────────────────────────────────────────────────────────────────

function watchlistScore(
  text: string,
  watchedTerms: string[]
): number {
  if (!watchedTerms || watchedTerms.length === 0) return 0;
  const lowerText = text.toLowerCase();
  const hits = watchedTerms.filter((t) => lowerText.includes(t.toLowerCase())).length;
  if (hits === 0) return 0;
  return Math.min(100, 40 + hits * 20);
}

// ─── Text match ───────────────────────────────────────────────────────────────

function textMatchScore(
  title: string,
  excerpt: string,
  query: string
): number {
  if (!query) return 50;
  const lower = query.toLowerCase();
  const inTitle = title?.toLowerCase().includes(lower);
  const inExcerpt = excerpt?.toLowerCase().includes(lower);

  if (inTitle && inExcerpt) return 95;
  if (inTitle) return 80;
  if (inExcerpt) return 60;
  return 20;
}

// ─── Main scoring function ────────────────────────────────────────────────────

export function scoreRelevance(doc: {
  title: string;
  source?: string | null;
  materia?: string | null;
  impacto?: string | null;
  publishedAt?: string | Date | null;
  excerpt?: string;
  query?: string;
  watchedTerms?: string[];
  jurisdiccion?: string | null;
}): RelevanceResult {
  const factors: RelevanceFactors = {
    materiaScore:    materiaScore(doc.materia, doc.query),
    autoridadScore:  autoridadScore(doc.source),
    jurisdiccionScore: doc.jurisdiccion?.toLowerCase() === "federal" ? 80 : 60,
    impactoScore:    impactoScore(doc.impacto),
    recenciaScore:   recenciaScore(doc.publishedAt),
    watchlistScore:  watchlistScore(
      `${doc.title} ${doc.excerpt ?? ""}`,
      doc.watchedTerms ?? []
    ),
    textMatchScore:  textMatchScore(doc.title, doc.excerpt ?? "", doc.query ?? ""),
  };

  // Weighted average
  const score = Math.round(
    factors.materiaScore    * 0.15 +
    factors.autoridadScore  * 0.20 +
    factors.jurisdiccionScore * 0.05 +
    factors.impactoScore    * 0.20 +
    factors.recenciaScore   * 0.20 +
    factors.watchlistScore  * 0.10 +
    factors.textMatchScore  * 0.10
  );

  const clamped = Math.max(0, Math.min(100, score));
  const level: RelevanceLevel =
    clamped >= 80 ? "alta" :
    clamped >= 50 ? "media" :
    clamped >= 20 ? "baja" : "minima";

  const color =
    level === "alta"   ? "🔴" :
    level === "media"  ? "🟡" :
    level === "baja"   ? "🟢" : "⚫";

  const explanation: string[] = [];
  if (factors.autoridadScore >= 80) explanation.push(`Fuente oficial de alta autoridad (${doc.source}).`);
  if (factors.impactoScore >= 80) explanation.push("Impacto declarado: ALTO.");
  if (factors.recenciaScore >= 85) explanation.push("Publicado en los últimos 30 días.");
  if (factors.watchlistScore >= 40) explanation.push("Contiene términos en lista de vigilancia.");
  if (factors.textMatchScore >= 80) explanation.push("Alta coincidencia textual con la consulta.");
  if (explanation.length === 0) explanation.push("Relevancia moderada o general.");

  return { score: clamped, level, color, factors, explanation };
}

// ─── Batch scoring ────────────────────────────────────────────────────────────

export function scoreMany<T extends Parameters<typeof scoreRelevance>[0]>(
  docs: T[],
  overrides?: Partial<Parameters<typeof scoreRelevance>[0]>
): Array<T & { relevance: RelevanceResult }> {
  return docs
    .map((doc) => ({
      ...doc,
      relevance: scoreRelevance({ ...doc, ...overrides }),
    }))
    .sort((a, b) => b.relevance.score - a.relevance.score);
}
