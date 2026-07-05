import { prisma } from "@/lib/prisma";
import { expandQuery } from "@/lib/search/lexicon";
import type { Prisma } from "@prisma/client";

export type DashboardItem = {
    id: string;
    source: string;
    title: string;
    url: string;
    published: string;
    summary: string | null;
    createdAt: string;
    impacto: string | null;
    tipo: string | null;
    tema: string | null;
    category: string | null;
    keywordsHit: string | null;
    diff: {
        id: string;
        changedArticlesCount: number;
        summaryBullets: Prisma.JsonValue;
    } | null;
};

export type DashboardResponse = {
    ok?: boolean;
    q?: string;
    source?: string;
    impacto?: string | null;
    tipo?: string | null;
    tema?: string | null;
    includeNoise?: boolean;
    counts?: { today: number; week: number; highImpact: number };
    items?: DashboardItem[];
};

/**
 * Devuelve el inicio del día actual en zona CDMX como Date UTC.
 */
function startOfDayCDMX(date = new Date()): Date {
    const formatter = new Intl.DateTimeFormat("en-US", {
        timeZone: "America/Mexico_City",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    });
    const parts = formatter.formatToParts(date);
    const y = parts.find(p => p.type === "year")!.value;
    const m = parts.find(p => p.type === "month")!.value;
    const d = parts.find(p => p.type === "day")!.value;

    const refDate = new Date(`${y}-${m}-${d}T12:00:00`);
    const cdmxParts = new Intl.DateTimeFormat("en-US", {
        timeZone: "America/Mexico_City",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
    }).formatToParts(refDate);
    const localHour = Number(cdmxParts.find(p => p.type === "hour")!.value);
    const utcHour = refDate.getUTCHours();

    let offsetMinutes = (utcHour - localHour) * 60;
    if (offsetMinutes < 0) offsetMinutes += 24 * 60;
    if (offsetMinutes > 12 * 60) offsetMinutes -= 24 * 60;

    const midnightUTC = new Date(`${y}-${m}-${d}T00:00:00.000Z`);
    midnightUTC.setUTCMinutes(midnightUTC.getUTCMinutes() + offsetMinutes);
    return midnightUTC;
}

/**
 * Función núcleo de datos para el dashboard, unificada.
 */
export async function getDashboardData(params: {
    q?: string;
    source?: string;
    impacto?: string;
    tipo?: string;
    tema?: string;
    range?: "today" | "week" | "all";
    includeNoise?: boolean;
}): Promise<DashboardResponse> {
    try {
        const q = (params.q || "").trim();
        const source = (params.source || "").trim();
        const impacto = (params.impacto || "").trim();
        const tipo = (params.tipo || "").trim();
        const tema = (params.tema || "").trim();
        const range = params.range || "all";
        const includeNoise = Boolean(params.includeNoise);

        const todayStart = startOfDayCDMX(new Date());
        const now = new Date();
        const weekStart = new Date(todayStart);
        weekStart.setDate(weekStart.getDate() - 6);

        const where: Prisma.ItemWhereInput = {};
        if (source) where.source = source;
        if (impacto) where.impacto = impacto;
        if (tipo) where.tipo = tipo;
        if (tema) where.tema = tema;
        if (!includeNoise) where.category = { not: "ruido" };

        if (q) {
            const terms = expandQuery(q);
            where.OR = [];
            for (const term of terms) {
                where.OR.push({ title: { contains: term, mode: "insensitive" } });
                where.OR.push({ summary: { contains: term, mode: "insensitive" } });
            }
        }

        const itemWhere: Prisma.ItemWhereInput = { ...where };
        if (range === "today") itemWhere.published = { gte: todayStart, lte: now };
        if (range === "week") itemWhere.published = { gte: weekStart, lte: now };

        const highImpactWhere: Prisma.ItemWhereInput = {
            ...where,
            impacto: "alto",
            published: { gte: weekStart, lte: now },
        };

        const [countToday, countWeek, countHighImpact, rawItems] = await Promise.all([
            prisma.item.count({
                where: { ...where, published: { gte: todayStart, lte: now } },
            }),
            prisma.item.count({
                where: { ...where, published: { gte: weekStart, lte: now } },
            }),
            prisma.item.count({ where: highImpactWhere }),
            prisma.item.findMany({
                where: itemWhere,
                orderBy: { published: "desc" },
                take: 100,
                include: {
                    normaVersions: {
                        select: {
                            id: true,
                            diffsTo: {
                                select: {
                                    id: true,
                                    changedArticles: true,
                                    summaryBullets: true,
                                },
                            },
                        },
                        take: 1,
                    },
                },
            }),
        ]);

        const items = rawItems.map(item => ({
            ...item,
            normaVersions: undefined,
            diff: item.normaVersions[0]?.diffsTo[0]
                ? {
                    id: item.normaVersions[0].diffsTo[0].id,
                    changedArticlesCount: Array.isArray(item.normaVersions[0].diffsTo[0].changedArticles)
                        ? item.normaVersions[0].diffsTo[0].changedArticles.length
                        : 0,
                    summaryBullets: item.normaVersions[0].diffsTo[0].summaryBullets,
                }
                : null,
            published: item.published.toISOString(),
            createdAt: item.createdAt.toISOString(),
        }));

        return {
            ok: true,
            q: q || undefined,
            source: source || undefined,
            impacto: impacto || null,
            tipo: tipo || null,
            tema: tema || null,
            includeNoise,
            counts: { today: countToday, week: countWeek, highImpact: countHighImpact },
            items,
        };
    } catch (err: unknown) {
        if (!isMissingTableError(err)) {
            console.warn("getDashboardData unavailable:", err instanceof Error ? err.message : String(err));
        }
        return { ok: false, counts: { today: 0, week: 0, highImpact: 0 }, items: [] };
    }
}

function isMissingTableError(err: unknown) {
    return Boolean(
        err &&
        typeof err === "object" &&
        "code" in err &&
        (err as { code?: string }).code === "P2021"
    );
}
