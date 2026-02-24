import { prisma } from "@/lib/prisma";

// Tipos de retorno
export type WeeklyStats = {
    from: string;
    to: string;
    total: number;
    byTema: Record<string, number>;
    byTipo: Record<string, number>;
    topWords: Array<{ word: string; count: number }>;
    topItems?: Array<{ id: string; title: string; url: string; published: Date }>; // Solo para la semana actual si se requiere
};

export type WeeklyComparison = {
    ok: boolean;
    current: WeeklyStats;
    previous: WeeklyStats;
    delta: {
        total: number;
        byTema: Record<string, number>;
        byTipo: Record<string, number>;
    };
};

const STOPWORDS = new Set([
    "de", "la", "el", "en", "y", "a", "los", "se", "del", "las", "por", "un", "para", "con", "no", "una", "su", "al", "lo", "como", "mas", "pero", "sus", "le", "ya", "o", "este", "si", "porque", "esta", "entre", "cuando", "muy", "sin", "sobre", "tambien", "me", "hasta", "hay", "donde", "quien", "desde", "todo", "nos", "durante", "todos", "uno", "les", "ni", "contra", "otros", "ese", "eso", "ante", "ellos", "e", "esto", "mi", "antes", "algunos", "que", "qué", "para", "las", "los", "con", "son", "tras"
]);

function cleanAndTokenize(text: string): string[] {
    return text
        .toLowerCase()
        .replace(/[^\w\sáéíóúñ]/g, " ")
        .split(/\s+/)
        .filter(w => w.length > 3 && !STOPWORDS.has(w));
}

async function getStatsForRange(start: Date, end: Date, includeItems = false): Promise<WeeklyStats> {
    // 1. Total
    const total = await prisma.item.count({
        where: {
            published: {
                gte: start,
                lte: end,
            },
        },
    });

    // 2. Por Tema
    const byTemaRaw = await prisma.item.groupBy({
        by: ["tema"],
        where: {
            published: { gte: start, lte: end },
            tema: { not: null },
        },
        _count: { tema: true },
        orderBy: { _count: { tema: "desc" } },
        take: 5,
    });

    const byTema: Record<string, number> = {};
    byTemaRaw.forEach(g => {
        if (g.tema) byTema[g.tema] = g._count.tema;
    });

    // 3. Por Tipo
    const byTipoRaw = await prisma.item.groupBy({
        by: ["tipo"],
        where: {
            published: { gte: start, lte: end },
            tipo: { not: null },
        },
        _count: { tipo: true },
        orderBy: { _count: { tipo: "desc" } },
        take: 5,
    });

    const byTipo: Record<string, number> = {};
    byTipoRaw.forEach(g => {
        if (g.tipo) byTipo[g.tipo] = g._count.tipo;
    });

    // 4. Top Words (fetch titles + summaries to compute in-memory)
    // Limitamos a los últimos 200 items para no explotar memoria si hay miles
    const itemsForWords = await prisma.item.findMany({
        where: { published: { gte: start, lte: end } },
        select: { title: true, summary: true },
        take: 200,
        orderBy: { published: "desc" },
    });

    const wordCounts: Record<string, number> = {};
    for (const item of itemsForWords) {
        const tokens = cleanAndTokenize((item.title || "") + " " + (item.summary || ""));
        for (const t of tokens) {
            wordCounts[t] = (wordCounts[t] || 0) + 1;
        }
    }

    const sortedWords = Object.entries(wordCounts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 10)
        .map(([word, count]) => ({ word, count }));

    // 5. Top Items (optional)
    let topItems: WeeklyStats["topItems"] = [];
    if (includeItems) {
        topItems = await prisma.item.findMany({
            where: { published: { gte: start, lte: end } },
            orderBy: { published: "desc" },
            take: 5,
            select: { id: true, title: true, url: true, published: true },
        });
    }

    return {
        from: start.toISOString().split("T")[0],
        to: end.toISOString().split("T")[0],
        total,
        byTema,
        byTipo,
        topWords: sortedWords,
        topItems,
    };
}

export async function getWeeklyComparison(): Promise<WeeklyComparison> {
    const now = new Date();
    // Ajustar a medianoche para rangos limpios
    const todayEnd = new Date(now);
    todayEnd.setHours(23, 59, 59, 999);

    const weekAgoStart = new Date(todayEnd);
    weekAgoStart.setDate(weekAgoStart.getDate() - 6); // Últimos 7 días (hoy inclusive)
    weekAgoStart.setHours(0, 0, 0, 0);

    const prevWeekEnd = new Date(weekAgoStart);
    prevWeekEnd.setDate(prevWeekEnd.getDate() - 1);
    prevWeekEnd.setHours(23, 59, 59, 999);

    const prevWeekStart = new Date(prevWeekEnd);
    prevWeekStart.setDate(prevWeekStart.getDate() - 6);
    prevWeekStart.setHours(0, 0, 0, 0);

    const [current, previous] = await Promise.all([
        getStatsForRange(weekAgoStart, todayEnd, true),
        getStatsForRange(prevWeekStart, prevWeekEnd, false),
    ]);

    // Deltas
    const deltaTotal = current.total - previous.total;

    const deltaTema: Record<string, number> = {};
    Object.keys(current.byTema).forEach(k => {
        deltaTema[k] = (current.byTema[k] || 0) - (previous.byTema[k] || 0);
    });

    const deltaTipo: Record<string, number> = {};
    Object.keys(current.byTipo).forEach(k => {
        deltaTipo[k] = (current.byTipo[k] || 0) - (previous.byTipo[k] || 0);
    });

    return {
        ok: true,
        current,
        previous,
        delta: {
            total: deltaTotal,
            byTema: deltaTema,
            byTipo: deltaTipo,
        },
    };
}
