import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

// ─── Types ────────────────────────────────────────────────────────────────────

interface WeeklyResult {
  id: string;
  title: string;
  source: string;
  publishedAt: string | null;
  updatedAt: string | null;
  type: string;
  matter: string | null;
  impact: string | null;
  summary: string | null;
  url: string;
  changeType: string;
  affectedSections: string[];
  origin: "local";
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toMexicoISODate(date: Date): string {
  // Returns YYYY-MM-DD in UTC (stored dates are already UTC, display as-is)
  return date.toISOString().slice(0, 10);
}

function safeInt(value: string | null, defaultVal: number, max: number): number {
  const n = parseInt(value ?? "", 10);
  if (isNaN(n) || n < 1) return defaultVal;
  return Math.min(n, max);
}

// ─── GET /api/legal/weekly-changes ────────────────────────────────────────────
// Public endpoint — read-only access to local DB.
// No LLM, no external fetches, no ingesta, no mutations.
// ─────────────────────────────────────────────────────────────────────────────
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);

    // ── Params ────────────────────────────────────────────────────────────────
    const keyword = (
      searchParams.get("keyword") ??
      searchParams.get("q") ??
      searchParams.get("query") ??
      ""
    ).trim();

    const rawStart = searchParams.get("startDate") ?? searchParams.get("dateFrom") ?? null;
    const rawEnd   = searchParams.get("endDate")   ?? searchParams.get("dateTo")   ?? null;
    const source   = searchParams.get("source")?.trim() ?? null;
    const materia  = searchParams.get("materia")?.trim() ?? null;
    const limit    = safeInt(searchParams.get("limit"), 50, 100);
    const page     = Math.max(1, safeInt(searchParams.get("page"), 1, 1000));
    const skip     = (page - 1) * limit;

    // ── Date range ────────────────────────────────────────────────────────────
    const now = new Date();
    const defaultStart = new Date(now);
    defaultStart.setUTCDate(defaultStart.getUTCDate() - 7);

    let startDate: Date;
    let endDate: Date;

    if (rawStart) {
      const parsed = new Date(rawStart);
      startDate = isNaN(parsed.getTime()) ? defaultStart : parsed;
    } else {
      startDate = defaultStart;
    }

    if (rawEnd) {
      const parsed = new Date(rawEnd);
      endDate = isNaN(parsed.getTime()) ? now : parsed;
    } else {
      endDate = now;
    }

    // Ensure startDate <= endDate
    if (startDate > endDate) {
      return NextResponse.json(
        {
          ok: false,
          error: "invalid_dates",
          details: ["startDate debe ser <= endDate"],
        },
        { status: 400 }
      );
    }

    // Enforce max 90-day range for public access
    const MAX_DAYS_PUBLIC = 90;
    const rangeDays = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24);
    if (rangeDays > MAX_DAYS_PUBLIC) {
      return NextResponse.json(
        {
          ok: false,
          error: "range_too_large",
          details: [`El rango máximo público es ${MAX_DAYS_PUBLIC} días`],
        },
        { status: 400 }
      );
    }

    // ── Base where clause for Item ─────────────────────────────────────────────
    const itemWhere: Record<string, unknown> = {
      published: {
        gte: startDate,
        lte: endDate,
      },
    };

    if (keyword) {
      itemWhere.OR = [
        { title:   { contains: keyword, mode: "insensitive" } },
        { summary: { contains: keyword, mode: "insensitive" } },
      ];
    }

    if (source) {
      itemWhere.source = { equals: source, mode: "insensitive" };
    }

    if (materia) {
      itemWhere.tema = { equals: materia, mode: "insensitive" };
    }

    // ── Query Items ────────────────────────────────────────────────────────────
    const prismaWhere = itemWhere as Prisma.ItemWhereInput;
    const [items, totalItems] = await Promise.all([
      prisma.item.findMany({
        where: prismaWhere,
        orderBy: { published: "desc" },
        take: limit,
        skip,
        select: {
          id:         true,
          title:      true,
          source:     true,
          published:  true,
          summary:    true,
          url:        true,
          tipo:       true,
          tema:       true,
          impacto:    true,
          retrievedAt: true,
          normaVersions: {
            select: {
              id:          true,
              publishedAt: true,
              diffsTo:     { select: { id: true, summaryBullets: true, changedArticles: true } },
            },
            orderBy: { publishedAt: "desc" },
            take: 1,
          },
        },
      }),
      prisma.item.count({
        where: prismaWhere,
      }),
    ]);

    // ── Build results ──────────────────────────────────────────────────────────
    const results: WeeklyResult[] = items.map((item) => {
      const latestVersion = item.normaVersions[0];
      const hasDiff       = latestVersion?.diffsTo && latestVersion.diffsTo.length > 0;

      // Determine changeType
      let changeType = "publicación";
      if (hasDiff) {
        changeType = "modificación";
      } else if (item.tipo) {
        const t = item.tipo.toLowerCase();
        if (t.includes("reforma")) changeType = "reforma";
        else if (t.includes("decreto")) changeType = "decreto";
        else if (t.includes("tesis") || t.includes("jurisprudencia")) changeType = "jurisprudencia";
        else if (t.includes("acuerdo")) changeType = "acuerdo";
        else if (t.includes("derogacion") || t.includes("derogación")) changeType = "derogación";
      }

      // Extract affected sections from latest diff
      const affectedSections: string[] = [];
      if (hasDiff && latestVersion?.diffsTo[0]?.changedArticles) {
        const arts = latestVersion.diffsTo[0].changedArticles as unknown[];
        if (Array.isArray(arts)) {
          for (const art of arts) {
            if (typeof art === "object" && art !== null) {
              const a = art as Record<string, unknown>;
              const label = (a.title ?? a.articleId ?? "") as string;
              if (label) affectedSections.push(label);
            }
          }
        }
      }

      return {
        id:         item.id,
        title:      item.title,
        source:     item.source,
        publishedAt: item.published ? item.published.toISOString() : null,
        updatedAt:  item.retrievedAt ? item.retrievedAt.toISOString() : null,
        type:       (item.tipo ?? "documento").toLowerCase(),
        matter:     item.tema ?? null,
        impact:     item.impacto ?? null,
        summary:    item.summary ?? null,
        url:        item.url,
        changeType,
        affectedSections,
        origin:     "local" as const,
      };
    });

    // ── Summary stats ──────────────────────────────────────────────────────────
    const bySource: Record<string, number> = {};
    const byType:   Record<string, number> = {};
    let   highImpact = 0;

    for (const r of results) {
      bySource[r.source] = (bySource[r.source] ?? 0) + 1;
      byType[r.type]     = (byType[r.type]     ?? 0) + 1;
      if (r.impact === "alto") highImpact++;
    }

    // ── Response ───────────────────────────────────────────────────────────────
    return NextResponse.json({
      ok: true,
      rangeUsed: {
        startDate:  toMexicoISODate(startDate),
        endDate:    toMexicoISODate(endDate),
        timezone:   "America/Mexico_City",
        defaulted:  !rawStart && !rawEnd,
      },
      summary: {
        total:      totalItems,
        showing:    results.length,
        page,
        limit,
        bySource,
        byType,
        highImpact,
      },
      results,
      external: {
        enabled:        false,
        total:          0,
        timedOutSources: [],
      },
      degraded: false,
      message:  results.length === 0
        ? "No hay cambios locales en el rango seleccionado. Puedes ampliar el rango o activar búsqueda externa."
        : null,
      generatedAt: new Date().toISOString(),
    });

  } catch (_error) {
    // Do NOT expose internal error messages publicly
    console.error("[weekly-changes] GET error:", _error);
    return NextResponse.json(
      {
        ok:       false,
        error:    "service_unavailable",
        message:  "No se pudo obtener el resumen semanal. Intenta de nuevo en unos momentos.",
        degraded: true,
        results:  [],
        external: { enabled: false, total: 0, timedOutSources: [] },
      },
      { status: 503 }
    );
  }
}
