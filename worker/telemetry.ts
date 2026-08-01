import { prisma } from "@/lib/prisma";

export type TelemetrySourceState =
  | "never_checked"
  | "healthy"
  | "degraded"
  | "failed"
  | "inactive";

export type TelemetrySource = {
  id: string;
  name: string;
  type: string;
  state: TelemetrySourceState;
  lastCheckedAt: string | null;
  lastSuccessAt: string | null;
  lastFailureAt: string | null;
  errorCategory: string | null;
};

export type TelemetryJobs = {
  total: number;
  pending: number;
  active: number;
  completed: number;
  failed: number;
  deadLetter: number;
};

export type TelemetrySnapshot = {
  ok: boolean;
  status: "ok" | "degraded";
  generatedAt: string;
  documentsProcessed: number;
  dashboardClients: number;
  activeWorkers: number;
  averageProcessingTimeSeconds: number;
  jobs: TelemetryJobs;
  sources: TelemetrySource[];
  warnings: string[];
};

const PENDING_INGESTION_STATUSES = [
  "PENDIENTE",
  "REINTENTANDO",
];

const ACTIVE_INGESTION_STATUSES = [
  "DESCARGANDO",
  "EXTRAYENDO_TEXTO",
  "GENERANDO_EMBEDDINGS",
  "CLASIFICANDO_CON_IA",
];

const ACTIVE_PROCESSING_STATUSES = ["active", "running", "processing"];

function isoOrNull(value: Date | null) {
  return value?.toISOString() || null;
}

function sourceState(source: {
  isActive: boolean;
  lastCheckedAt: Date | null;
  lastSuccessAt: Date | null;
  lastFailureAt: Date | null;
  lastErrorCategory: string | null;
}): TelemetrySourceState {
  if (!source.isActive) return "inactive";
  if (!source.lastCheckedAt) return "never_checked";

  const failedAfterSuccess = Boolean(
    source.lastFailureAt &&
      (!source.lastSuccessAt || source.lastFailureAt > source.lastSuccessAt),
  );
  if (failedAfterSuccess) return source.lastSuccessAt ? "degraded" : "failed";
  if (source.lastErrorCategory && !source.lastSuccessAt) return "failed";
  if (source.lastErrorCategory && !source.lastFailureAt) return "degraded";
  return "healthy";
}

export async function collectTelemetry(options: { dashboardClients?: number } = {}): Promise<TelemetrySnapshot> {
  const warnings: string[] = [];
  const safe = async <T>(name: string, operation: () => Promise<T>, fallback: T): Promise<T> => {
    try {
      return await operation();
    } catch {
      warnings.push(name);
      return fallback;
    }
  };

  const [documentsProcessed, pending, active, completed, failed, deadLetter, activeWorkers, averageMs, sources] =
    await Promise.all([
      safe("documents", () => prisma.document.count(), 0),
      safe(
        "jobs.pending",
        () => prisma.ingestionJob.count({ where: { status: { in: PENDING_INGESTION_STATUSES } } }),
        0,
      ),
      safe("jobs.active", () => prisma.ingestionJob.count({ where: { status: { in: ACTIVE_INGESTION_STATUSES } } }), 0),
      safe("jobs.completed", () => prisma.ingestionJob.count({ where: { status: "COMPLETADO" } }), 0),
      safe("jobs.failed", () => prisma.ingestionJob.count({ where: { status: "FALLIDO" } }), 0),
      safe(
        "jobs.deadLetter",
        () => prisma.ingestionJob.count({ where: { status: "EN_DEAD_LETTER_QUEUE" } }),
        0,
      ),
      safe(
        "workers.active",
        () => prisma.processingJob.count({ where: { status: { in: ACTIVE_PROCESSING_STATUSES } } }),
        0,
      ),
      safe(
        "jobs.averageDuration",
        async () => {
          const rows = await prisma.ingestionJob.findMany({
            where: { status: "COMPLETADO", startedAt: { not: null }, completedAt: { not: null } },
            select: { startedAt: true, completedAt: true },
            orderBy: { completedAt: "desc" },
            take: 100,
          });
          if (rows.length === 0) return 0;
          return (
            rows.reduce((sum, row) => sum + (row.completedAt!.getTime() - row.startedAt!.getTime()), 0) /
            rows.length
          );
        },
        0,
      ),
      safe(
        "sources",
        () =>
          prisma.officialSource.findMany({
            where: { isOfficial: true },
            orderBy: { name: "asc" },
            select: {
              id: true,
              name: true,
              type: true,
              isActive: true,
              lastCheckedAt: true,
              lastSuccessAt: true,
              lastFailureAt: true,
              lastErrorCategory: true,
            },
          }),
        [],
      ),
    ]);

  return {
    ok: warnings.length === 0,
    status: warnings.length === 0 ? "ok" : "degraded",
    generatedAt: new Date().toISOString(),
    documentsProcessed,
    dashboardClients: Math.max(0, Math.trunc(options.dashboardClients || 0)),
    activeWorkers,
    averageProcessingTimeSeconds: Math.round((averageMs / 1000) * 100) / 100,
    jobs: {
      total: pending + active + completed + failed + deadLetter,
      pending,
      active,
      completed,
      failed,
      deadLetter,
    },
    sources: sources.map((source) => ({
      id: source.id,
      name: source.name,
      type: source.type,
      state: sourceState(source),
      lastCheckedAt: isoOrNull(source.lastCheckedAt),
      lastSuccessAt: isoOrNull(source.lastSuccessAt),
      lastFailureAt: isoOrNull(source.lastFailureAt),
      errorCategory: source.lastErrorCategory,
    })),
    warnings,
  };
}
