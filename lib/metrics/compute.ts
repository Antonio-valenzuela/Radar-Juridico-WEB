import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type CountMap = Record<string, number>;

export type MetricsRangeResult = {
  ok: boolean;
  from: string;
  to: string;
  monthlyReforms: Array<{ month: string; total: number }>;
  typeCounts: CountMap;
  sourceCounts: CountMap;
  impactCounts: CountMap;
  topicCounts: CountMap;
  topNormas: Array<{ normaId: string | null; nombre: string; sigla: string | null; count: number }>;
  daily: Array<{
    date: string;
    sourceCounts: CountMap;
    impactCounts: CountMap;
    topicCounts: CountMap;
    typeCounts: CountMap;
    topNormas: Array<{ normaId: string | null; nombre: string; sigla: string | null; count: number }>;
  }>;
};

export function startOfUtcDay(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

export async function computeMetricsDaily(date = new Date()) {
  const day = startOfUtcDay(date);
  const next = new Date(day);
  next.setUTCDate(next.getUTCDate() + 1);

  const [sourceRows, impactRows, topicRows, typeRows, normaRows] = await Promise.all([
    prisma.item.groupBy({
      by: ["source"],
      where: { published: { gte: day, lt: next } },
      _count: { _all: true },
    }),
    prisma.item.groupBy({
      by: ["impacto"],
      where: { published: { gte: day, lt: next }, impacto: { not: null } },
      _count: { _all: true },
    }),
    prisma.item.groupBy({
      by: ["tema"],
      where: { published: { gte: day, lt: next }, tema: { not: null } },
      _count: { _all: true },
    }),
    prisma.item.groupBy({
      by: ["tipo"],
      where: { published: { gte: day, lt: next }, tipo: { not: null } },
      _count: { _all: true },
    }),
    prisma.normaVersion.groupBy({
      by: ["normaId"],
      where: { publishedAt: { gte: day, lt: next } },
      _count: { _all: true },
      orderBy: { _count: { normaId: "desc" } },
      take: 10,
    }),
  ]);

  const normas = await prisma.norma.findMany({
    where: { id: { in: normaRows.map((row) => row.normaId) } },
  });
  const normaById = new Map(normas.map((norma) => [norma.id, norma]));

  const topNormas = normaRows.map((row) => {
    const norma = normaById.get(row.normaId);
    return {
      normaId: row.normaId,
      nombre: norma?.nombre || "Norma no identificada",
      sigla: norma?.sigla || null,
      count: row._count._all,
    };
  });

  const data = {
    date: day,
    sourceCounts: mapCounts(sourceRows, "source"),
    impactCounts: mapCounts(impactRows, "impacto"),
    topicCounts: mapCounts(topicRows, "tema"),
    typeCounts: mapCounts(typeRows, "tipo"),
    topNormas: topNormas as unknown as Prisma.InputJsonValue,
  };

  return await prisma.metricsDaily.upsert({
    where: { date: day },
    update: data,
    create: data,
  });
}

export async function computeMetricsRange(from: Date, to: Date): Promise<MetricsRangeResult> {
  const fromDay = startOfUtcDay(from);
  const toDay = startOfUtcDay(to);
  toDay.setUTCDate(toDay.getUTCDate() + 1);

  // Pre-fetch days that already have cached metrics
  const existingMetrics = await prisma.metricsDaily.findMany({
    where: { date: { gte: fromDay, lt: toDay } },
    select: { date: true },
  });
  const existingDates = new Set(
    existingMetrics.map((m) => m.date.toISOString().slice(0, 10))
  );

  // Only compute missing days + last 2 days (today/yesterday for freshness)
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  const recentDates = new Set([
    startOfUtcDay(now).toISOString().slice(0, 10),
    startOfUtcDay(yesterday).toISOString().slice(0, 10),
  ]);

  const daysToCompute: Date[] = [];
  for (const d = new Date(fromDay); d < toDay; d.setUTCDate(d.getUTCDate() + 1)) {
    const key = new Date(d).toISOString().slice(0, 10);
    if (!existingDates.has(key) || recentDates.has(key)) {
      daysToCompute.push(new Date(d));
    }
  }

  // Process sequentially to avoid exhausting Prisma connection pool
  for (const day of daysToCompute) {
    await computeMetricsDaily(day);
  }

  const rows = await prisma.metricsDaily.findMany({
    where: { date: { gte: fromDay, lt: toDay } },
    orderBy: { date: "asc" },
  });

  const monthly = new Map<string, number>();
  const sourceCounts: CountMap = {};
  const impactCounts: CountMap = {};
  const topicCounts: CountMap = {};
  const typeCounts: CountMap = {};
  const normaCounts = new Map<string, { normaId: string | null; nombre: string; sigla: string | null; count: number }>();

  const daily = rows.map((row) => {
    const source = asCountMap(row.sourceCounts);
    const impact = asCountMap(row.impactCounts);
    const topic = asCountMap(row.topicCounts);
    const type = asCountMap(row.typeCounts);
    const normas = asTopNormas(row.topNormas);
    const total = Object.values(type).reduce((sum, n) => sum + n, 0);
    const month = row.date.toISOString().slice(0, 7);

    monthly.set(month, (monthly.get(month) || 0) + total);
    mergeCounts(sourceCounts, source);
    mergeCounts(impactCounts, impact);
    mergeCounts(topicCounts, topic);
    mergeCounts(typeCounts, type);
    for (const norma of normas) {
      const key = norma.normaId || norma.nombre;
      const prev = normaCounts.get(key) || { ...norma, count: 0 };
      prev.count += norma.count;
      normaCounts.set(key, prev);
    }

    return {
      date: row.date.toISOString().slice(0, 10),
      sourceCounts: source,
      impactCounts: impact,
      topicCounts: topic,
      typeCounts: type,
      topNormas: normas,
    };
  });

  return {
    ok: true,
    from: fromDay.toISOString().slice(0, 10),
    to: new Date(toDay.getTime() - 1).toISOString().slice(0, 10),
    monthlyReforms: Array.from(monthly.entries()).map(([month, total]) => ({ month, total })),
    typeCounts,
    sourceCounts,
    impactCounts,
    topicCounts,
    topNormas: Array.from(normaCounts.values()).sort((a, b) => b.count - a.count).slice(0, 10),
    daily,
  };
}

export function metricsToCsv(result: MetricsRangeResult) {
  const lines = ["section,key,value"];
  for (const row of result.monthlyReforms) lines.push(csvRow("monthlyReforms", row.month, row.total));
  for (const [key, value] of Object.entries(result.typeCounts)) lines.push(csvRow("typeCounts", key, value));
  for (const [key, value] of Object.entries(result.sourceCounts)) lines.push(csvRow("sourceCounts", key, value));
  for (const [key, value] of Object.entries(result.impactCounts)) lines.push(csvRow("impactCounts", key, value));
  for (const [key, value] of Object.entries(result.topicCounts)) lines.push(csvRow("topicCounts", key, value));
  for (const norma of result.topNormas) lines.push(csvRow("topNormas", norma.sigla || norma.nombre, norma.count));
  return `${lines.join("\n")}\n`;
}

function mapCounts<T extends Record<string, unknown>>(rows: T[], key: keyof T): CountMap {
  const out: CountMap = {};
  for (const row of rows) {
    const rawKey = row[key];
    if (typeof rawKey === "string" && rawKey) {
      out[rawKey] = Number((row._count as { _all?: number })._all || 0);
    }
  }
  return out;
}

function asCountMap(value: Prisma.JsonValue): CountMap {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const out: CountMap = {};
  for (const [key, raw] of Object.entries(value)) {
    const n = Number(raw);
    if (Number.isFinite(n)) out[key] = n;
  }
  return out;
}

function asTopNormas(value: Prisma.JsonValue) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) return null;
      const obj = item as Record<string, unknown>;
      return {
        normaId: typeof obj.normaId === "string" ? obj.normaId : null,
        nombre: typeof obj.nombre === "string" ? obj.nombre : "Norma no identificada",
        sigla: typeof obj.sigla === "string" ? obj.sigla : null,
        count: Number(obj.count || 0),
      };
    })
    .filter((item): item is { normaId: string | null; nombre: string; sigla: string | null; count: number } => Boolean(item));
}

function mergeCounts(target: CountMap, source: CountMap) {
  for (const [key, value] of Object.entries(source)) target[key] = (target[key] || 0) + value;
}

function csvRow(section: string, key: string, value: number) {
  return [section, key, String(value)].map((cell) => `"${cell.replace(/"/g, '""')}"`).join(",");
}
