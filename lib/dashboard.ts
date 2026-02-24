import { prisma } from "@/lib/prisma";
import { expandQuery } from "@/lib/search/lexicon";

export type DashboardResponse = {
    ok?: boolean;
    q?: string;
    source?: string;
    impacto?: string | null;
    tipo?: string | null;
    tema?: string | null;
    counts?: { today: number; week: number };
    items?: any[];
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
}): Promise<DashboardResponse> {
    try {
        const q = (params.q || "").trim();
        const source = (params.source || "").trim();
        const impacto = (params.impacto || "").trim();
        const tipo = (params.tipo || "").trim();
        const tema = (params.tema || "").trim();

        const todayStart = startOfDayCDMX(new Date());
        const now = new Date();
        const weekStart = new Date(todayStart);
        weekStart.setDate(weekStart.getDate() - 6);

        const where: any = {};
        if (source) where.source = source;
        if (impacto) where.impacto = impacto;
        if (tipo) where.tipo = tipo;
        if (tema) where.tema = tema;

        if (q) {
            const terms = expandQuery(q);
            where.OR = [];
            for (const term of terms) {
                where.OR.push({ title: { contains: term, mode: "insensitive" } });
                where.OR.push({ summary: { contains: term, mode: "insensitive" } });
            }
        }

        const [countToday, countWeek, rawItems] = await Promise.all([
            prisma.item.count({
                where: { ...where, published: { gte: todayStart, lte: now } },
            }),
            prisma.item.count({
                where: { ...where, published: { gte: weekStart, lte: now } },
            }),
            prisma.item.findMany({
                where,
                orderBy: { published: "desc" },
                take: 100,
            }),
        ]);

        const items = rawItems.map(item => ({
            ...item,
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
            counts: { today: countToday, week: countWeek },
            items,
        };
    } catch (err: any) {
        console.error("getDashboardData error:", err);
        return { ok: false, counts: { today: 0, week: 0 }, items: [] };
    }
}
