import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/security/adminAuth";
import { generateLlmCompletion } from "@/lib/ai-provider";
import { prisma } from "@/lib/prisma";
import { hybridSearch } from "@/lib/search/hybridSearch";
import { expandLegalSearch } from "@/lib/search/legalExpansion";
import { searchOfficialSources } from "@/lib/search/officialFederatedSearch";
import {
  findExcerptAndMatches,
  getAndIncrementAttempts,
  getAttemptsWithoutIncrementing,
} from "@/lib/legal-radar";
import {
  LOCAL_SEARCH_MS,
  LOCAL_VERSIONS_MS,
  WEEKLY_DIFFS_MS,
  LLM_EXPANSION_MS,
  EXTERNAL_SEARCH_MS,
  PER_SOURCE_MS,
  AI_SYNTHESIS_MS,
} from "@/lib/config/timeouts";

export const dynamic = "force-dynamic";

// ─── Timeout helpers ──────────────────────────────────────────────────────────

/**
 * Returns a promise that rejects after `ms` ms with the given message.
 * Used for per-step timeouts so individual failures don't abort everything.
 */
function rejectAfter(ms: number, message: string): Promise<never> {
  return new Promise((_, reject) =>
    setTimeout(() => reject(new Error(message)), ms)
  );
}

/**
 * Races a promise against a timeout.
 * On timeout, returns the fallback value instead of throwing.
 */
async function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  fallback: T,
  label: string,
  timedOutRef: string[]
): Promise<T> {
  try {
    return await Promise.race([promise, rejectAfter(ms, `timeout:${label}`)]);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.startsWith("timeout:")) {
      console.warn(`[radar] ⏱ Timeout en ${label} (>${ms}ms)`);
      timedOutRef.push(label);
    } else {
      console.error(`[radar] ❌ Error en ${label}:`, msg);
    }
    return fallback;
  }
}

// ─── GET — config metadata ────────────────────────────────────────────────────

export async function GET(req: Request) {
  try {
    const adminCheck = requireAdmin(req);
    if (!adminCheck.ok) {
      return adminCheck.response;
    }

    const provider = (process.env.LLM_PROVIDER || "gemini").toLowerCase().trim();
    let model = "N/A";
    if (provider === "gemini")      model = process.env.GEMINI_MODEL      || "gemini-2.5-flash";
    else if (provider === "groq")   model = process.env.GROQ_MODEL        || "llama-3.1-8b-instant";
    else if (provider === "openrouter") model = process.env.OPENROUTER_MODEL || "openai/gpt-oss-20b:free";

    const attempts = await getAttemptsWithoutIncrementing();

    return NextResponse.json({ ok: true, provider, model, attempts });
  } catch (_error) {
    return NextResponse.json({ ok: false, error: "service_error" }, { status: 500 });
  }
}

// ─── POST — active RAG search (admin-protected) ────────────────────────────────

export async function POST(req: Request) {
  try {
    // 1. Admin token required for active AI/RAG search
    const adminCheck = requireAdmin(req);
    if (!adminCheck.ok) {
      return adminCheck.response;
    }

    // 2. Parse body
    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const query        = (String(body.query ?? body.keyword ?? "")).trim();
    const matter       = body.matter   ? String(body.matter).trim()   : undefined;
    const dateFrom     = body.dateFrom ? String(body.dateFrom).trim() : undefined;
    const dateTo       = body.dateTo   ? String(body.dateTo).trim()   : undefined;
    const forceExternal = !!(body.forceExternal || body.includeExternal);

    // query is required for POST (active search with AI)
    if (!query) {
      return NextResponse.json(
        { ok: false, error: "invalid_request", details: ["query es requerida para búsqueda activa con IA"] },
        { status: 400 }
      );
    }

    // Validate date range
    if (dateFrom && dateTo) {
      const from = new Date(dateFrom);
      const to   = new Date(dateTo);
      if (from > to) {
        return NextResponse.json(
          { ok: false, error: "invalid_dates", details: ["dateFrom debe ser <= dateTo"] },
          { status: 400 }
        );
      }
      const days = (to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24);
      if (days > 365) {
        return NextResponse.json(
          { ok: false, error: "date_range_too_large", details: ["Máximo 365 días"] },
          { status: 400 }
        );
      }
    }

    console.error(`[radar] POST query="${query}" matter=${matter} forceExternal=${forceExternal}`);

    // 3. Run search pipeline with graceful sub-timeouts (12s total budget)
    const result = await performSearch(query, matter, dateFrom, dateTo, forceExternal);

    return NextResponse.json(result);

  } catch (_error: unknown) {
    const msg = _error instanceof Error ? _error.message : "Internal server error";
    console.error("[radar] POST unhandled error:", msg);
    // Never expose internal error details
    return NextResponse.json(
      { ok: false, error: "service_error", message: "Error procesando la búsqueda. Intenta de nuevo." },
      { status: 500 }
    );
  }
}

// ─── Search pipeline with graceful degradation ────────────────────────────────

async function performSearch(
  query: string,
  matter?: string,
  dateFrom?: string,
  dateTo?: string,
  forceExternal?: boolean
) {
  const timedOutSources: string[] = [];
  const warnings: string[] = [];
  let degraded = false;

  // ── Step 1: Local hybrid search (configurable timeout) ────────────────────────
  const localSearchResults = await withTimeout(
    hybridSearch(query, {
      materia: matter ? [matter] : undefined,
      fecha_desde: dateFrom,
      fecha_hasta: dateTo,
    }, 10),
    LOCAL_SEARCH_MS,
    [],
    "local-db",
    timedOutSources
  );

  // hybridSearch returns HybridSearchResult[]: { documento, coincidencia_semantica, coincidencia_textual, fuente, fragmento_relevante, fecha }
  // No .item.id — we don't need Step 2 lookups for the new interface
  const localItemIds: string[] = []; // kept for normaVersion lookup (empty until hybridSearch exposes IDs)

  // ── Step 2: Norma versions (parallel, configurable) ────────────────────
  const [, normaVersions] = await withTimeout(
    Promise.all([
      Promise.resolve([]),
      localItemIds.length > 0
        ? prisma.normaVersion.findMany({
            where: { sourceItemId: { in: localItemIds } },
            include: { diffsTo: true },
          })
        : Promise.resolve([]),
    ]),
    LOCAL_VERSIONS_MS,
    [[], []],
    "local-versions",
    timedOutSources
  );

  const lookbackLimit = new Date();
  lookbackLimit.setDate(lookbackLimit.getDate() - 7);

  const localResults = localSearchResults
    .map((r: { documento: string; coincidencia_semantica: number; coincidencia_textual: number; fuente: string; fragmento_relevante: string; fecha: string }) => ({
      title:          r.documento,
      source:         r.fuente,
      type:           "documento",
      publishedAt:    r.fecha || null,
      lastModifiedAt: null,
      status:         "sin cambios" as const,
      matches:        r.coincidencia_textual > 0 ? 1 : 0,
      excerpt:        r.fragmento_relevante || "",
      officialUrl:    "",
      score:          Number(((r.coincidencia_semantica * 0.6 + r.coincidencia_textual * 0.4) / 100).toFixed(4)),
    }))
    .filter((r: { matches: number; score: number }) => r.matches > 0 || r.score >= 0.15);

  console.error(`[radar] Local docs found: ${localResults.length}`);

  // ── Step 3: Weekly changes from normaDiff (3s timeout) ────────────────────
  const lookbackDays = Number(process.env.LEGAL_RADAR_LOOKBACK_DAYS) || 7;
  const sinceDate = new Date();
  sinceDate.setDate(sinceDate.getDate() - lookbackDays);

  const weeklyDiffs = await withTimeout(
    prisma.normaDiff.findMany({
      where: {
        toVersion: {
          publishedAt: { gte: sinceDate },
          OR: [
            { norma:      { nombre:  { contains: query, mode: "insensitive" } } },
            { sourceItem: { OR: [
              { title:   { contains: query, mode: "insensitive" } },
              { summary: { contains: query, mode: "insensitive" } },
            ] } },
          ],
        },
      },
      include: {
        toVersion: { include: { norma: true, sourceItem: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
    WEEKLY_DIFFS_MS,
    [],
    "weekly-diffs",
    timedOutSources
  );

  const weeklyChanges = weeklyDiffs.map((diff: {
    toVersion: {
      sourceItem?: { title?: string } | null;
      norma: { nombre: string };
      publishedAt: Date;
    };
    changedArticles?: unknown;
    summaryBullets?: unknown;
  }) => {
    const title = diff.toVersion.sourceItem?.title ?? diff.toVersion.norma.nombre;
    let affectedSections: string[] = [];
    if (diff.changedArticles) {
      const articles = diff.changedArticles as unknown[];
      if (Array.isArray(articles)) {
        affectedSections = articles
          .map((art) => typeof art === "object" && art !== null ? (art as Record<string, unknown>).title ?? (art as Record<string, unknown>).articleId : undefined)
          .filter((x): x is string => typeof x === "string" && x.length > 0);
      }
    }
    let summary = "Se detectaron modificaciones.";
    if (diff.summaryBullets) {
      const bullets = diff.summaryBullets as string[];
      if (Array.isArray(bullets) && bullets.length > 0) {
        summary = bullets.join(" ");
      }
    }
    return {
      title,
      changeType: "modificación",
      changedAt:  diff.toVersion.publishedAt.toISOString(),
      affectedSections,
      summary,
    };
  });

  console.error(`[radar] Weekly changes: ${weeklyChanges.length}`);

  // ── Step 4: Query expansion via LLM (4s timeout, fallback to static) ──────
  const expansionRes = await withTimeout(
    expandLegalSearch({ query, matter }),
    LLM_EXPANSION_MS,
    {
      ok: true,
      provider: "local",
      model: "local",
      fallback: true,
      expanded: {
        userQuery: query,
        userMatter: matter,
        expandedSearch: {
          alternativeTerms: [query],
          relatedAuthorities: [],
          legalTopics: [],
          documentTypes: ["reforma", "decreto", "jurisprudencia"],
          officialSources: [
            { domain: "dof.gob.mx",         name: "DOF",                  searchQuery: query, rationale: "" },
            { domain: "diputados.gob.mx",    name: "Cámara de Diputados", searchQuery: query, rationale: "" },
          ],
        },
        searchStrategy: "fallback",
        warnings: ["Query expansion timed out, using static fallback"] as string[],
      },
    },
    "llm-expansion",
    timedOutSources
  );

  const expanded = expansionRes.expanded;

  // ── Step 5: External federated search (6s timeout, graceful) ─────────────
  const highestLocalScore = localResults.length > 0
    ? Math.max(...localResults.map((r: { score: number }) => r.score))
    : 0;

  const externalSearchRequired =
    forceExternal ||
    localResults.length === 0 ||
    (weeklyChanges.length === 0 && highestLocalScore < 0.3);

  let externalResults: unknown[] = [];
  const sourcesConsulted: string[] = ["Base local"];
  const externalSourcesQueried: string[] = [];

  if (externalSearchRequired) {
    const { results: extSearchRes, warnings: extWarnings } = await withTimeout(
      searchOfficialSources(
        expanded.expandedSearch.officialSources,
        { dateFrom, dateTo },
        PER_SOURCE_MS
      ),
      EXTERNAL_SEARCH_MS,
      { results: [], warnings: [`Búsqueda externa excedió tiempo de espera (${EXTERNAL_SEARCH_MS}ms).`] },
      "external-sources",
      timedOutSources
    );

    externalResults = extSearchRes;
    warnings.push(...extWarnings);

    extSearchRes.forEach((srcGroup: { source: string; results: Array<{ sourceName?: string }> }) => {
      externalSourcesQueried.push(srcGroup.source);
      srcGroup.results.forEach((res) => {
        if (res.sourceName && !sourcesConsulted.includes(res.sourceName)) {
          sourcesConsulted.push(res.sourceName);
        }
      });
    });

    // Cache external results in local DB (non-blocking, best-effort)
    setImmediate(async () => {
      for (const srcGroup of extSearchRes) {
        for (const ext of (srcGroup as { results: Array<{ url?: string; sourceName?: string; title?: string; date?: string; excerpt?: string }> }).results) {
          if (!ext.url) continue;
          try {
            await prisma.item.upsert({
              where:  { url: ext.url },
              update: {},
              create: {
                source:   ext.sourceName ?? "external",
                title:    ext.title     ?? "Sin título",
                url:      ext.url,
                published: ext.date ? new Date(ext.date) : new Date(),
                summary:   ext.excerpt  ?? null,
                category:  "external_official",
                raw: {
                  ingestionStatus: "pending_review",
                  sourceType:      "official_external",
                  excerpt:         ext.excerpt,
                },
              },
            });
          } catch (_) {
            // Silently ignore cache errors; they don't affect the response
          }
        }
      }
    });
  }

  localResults.forEach((r: { source?: string }) => {
    if (r.source && !sourcesConsulted.includes(r.source)) {
      sourcesConsulted.push(r.source);
    }
  });

  if (timedOutSources.length > 0) {
    degraded = true;
    if (timedOutSources.some(s => s.startsWith("external"))) {
      warnings.push(
        "Se muestran resultados locales. Algunas fuentes externas excedieron el tiempo de espera."
      );
    }
  }

  // ── Step 6: AI synthesis (5s timeout, optional) ───────────────────────────
  const attempts = await getAndIncrementAttempts();
  let aiAnalysis: unknown = null;
  let radarStatus: "success" | "partial" = "success";
  let llmCalled = false;

  const hasAnyResults =
    localResults.length > 0 ||
    weeklyChanges.length > 0 ||
    (externalResults as Array<{ results?: unknown[] }>).some((g) => (g.results?.length ?? 0) > 0);

  const hasExternalResults = (externalResults as Array<{ results?: unknown[] }>).some(
    (g) => (g.results?.length ?? 0) > 0
  );
  const hasSufficientLocalEvidence =
    !forceExternal &&
    localResults.length > 0 &&
    weeklyChanges.length === 0 &&
    !hasExternalResults;

  if (hasSufficientLocalEvidence) {
    aiAnalysis = buildLocalEvidenceAnalysis(query, localResults);
  } else if (hasAnyResults) {
    const prompt = buildAiPrompt(query, localResults, weeklyChanges, externalResults);
    llmCalled = true;
    const aiResult = await withTimeout(
      callAi(prompt),
      AI_SYNTHESIS_MS,
      null,
      "ai-synthesis",
      timedOutSources
    );

    if (aiResult) {
      aiAnalysis = aiResult;
    } else {
      radarStatus = "partial";
      warnings.push("Análisis IA no disponible en este momento.");
      degraded = true;
    }
  } else {
    aiAnalysis = {
      summary: "No se encontró evidencia suficiente en fuentes oficiales registradas.",
      legalImpact: "Sin impacto detectado.",
      attentionPoints: [],
      provider: "none",
      model: "none",
      usedFallback: false,
    };
  }

  console.error(`[radar] Done — local:${localResults.length} weekly:${weeklyChanges.length} ext:${(externalResults as unknown[]).length} degraded:${degraded}`);

  return {
    ok: true,
    query,
    expandedQuery: {
      alternativeTerms:    expanded.expandedSearch.alternativeTerms,
      relatedAuthorities:  expanded.expandedSearch.relatedAuthorities,
      officialSources:     expanded.expandedSearch.officialSources.map((s: { domain: string; name: string }) => ({
        domain: s.domain, name: s.name,
      })),
    },
    localResults,
    weeklyChanges,
    externalResults,
    aiAnalysis,
    warnings,
    radarStatus,
    sourcesConsulted,
    attempts,
    degraded,
    timedOutSources,
    debug: {
      localDocumentsFound:      localResults.length,
      weeklyChangesFound:       weeklyChanges.length,
      externalSourcesQueried,
      llmCalled,
    },
  };
}

// ─── AI helpers ────────────────────────────────────────────────────────────────

function buildLocalEvidenceAnalysis(query: string, localResults: unknown[]): unknown {
  const references = localResults.slice(0, 5).map((result) => {
    const item = result as {
      title?: string;
      source?: string;
      published?: string | Date | null;
      url?: string;
      snippet?: string;
      summary?: string | null;
    };

    return {
      title: item.title ?? "Documento local",
      source: item.source ?? "Base local",
      published: item.published ?? null,
      url: item.url ?? null,
      excerpt: item.snippet ?? item.summary ?? null,
    };
  });

  return {
    summary: `Se encontraron ${localResults.length} documento(s) locales relacionados con "${query}". Revisa las referencias oficiales locales antes de concluir si hubo reforma o cambio aplicable.`,
    legalImpact: "La evidencia local es suficiente para continuar la revisión sin búsqueda externa automática.",
    attentionPoints: references.map((item) => {
      const source = item.source ? ` (${item.source})` : "";
      return `${item.title}${source}`;
    }),
    references,
    provider: "local",
    model: "deterministic-local-evidence",
    usedFallback: false,
  };
}

function buildAiPrompt(
  query: string,
  localResults: unknown[],
  weeklyChanges: unknown[],
  externalResults: unknown[]
): string {
  return `Actúa como un analista legal experto y asesor jurídico para abogados en México.
Analiza la siguiente consulta y sintetiza la información recuperada de fuentes oficiales.

Consulta: "${query}"

Resultados Locales:
${JSON.stringify(localResults.slice(0, 8), null, 2)}

Cambios Semanales Detectados:
${JSON.stringify(weeklyChanges.slice(0, 8), null, 2)}

Resultados Externos Oficiales:
${JSON.stringify(externalResults.slice(0, 8), null, 2)}

REGLAS DE SEGURIDAD Y VERACIDAD:
1. Genera un informe en JSON estricto con exactamente estos campos:
{
  "summary": "Resumen ejecutivo de los hallazgos con base única y estrictamente en la evidencia provista.",
  "legalImpact": "Impacto jurídico práctico para abogados en México.",
  "attentionPoints": ["Punto 1", "Punto 2"]
}
2. Cita siempre las URLs de las fuentes de evidencia en tu resumen e impacto legal si se usaron fuentes externas.
3. Si los resultados provistos no contienen información relevante para responder la consulta, o si no hay evidencia suficiente en ellos, debes responder exactamente:
{
  "summary": "No se encontró evidencia suficiente en fuentes oficiales registradas.",
  "legalImpact": "Sin impacto detectado.",
  "attentionPoints": []
}
4. NO INVENTES ni alucines fuentes, URLs, tesis, reformas, leyes, fechas o publicaciones. Si no está en los resultados provistos, no existe para este análisis.

Responde ÚNICAMENTE con el JSON. No uses bloques markdown.`;
}

async function callAi(prompt: string): Promise<unknown | null> {
  try {
    const llmResult = await generateLlmCompletion(prompt);
    let clean = llmResult.answer.trim();
    if (clean.startsWith("```")) {
      clean = clean.replace(/^```json\s*/i, "").replace(/```\s*$/, "");
    }
    const parsed = JSON.parse(clean);
    return {
      summary:         parsed.summary        || "",
      legalImpact:     parsed.legalImpact    || "",
      attentionPoints: Array.isArray(parsed.attentionPoints) ? parsed.attentionPoints : [],
      provider:        llmResult.provider,
      model:           llmResult.model,
      usedFallback:    llmResult.usedFallback,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[radar] LLM error: ${msg}`);
    return null;
  }
}
