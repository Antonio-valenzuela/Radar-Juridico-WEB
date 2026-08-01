import { prisma } from "@/lib/prisma";

export type TelemetrySourceState =
  | "healthy"
  | "degraded"
  | "failed"
  | "never_checked"
  | "unknown"
  | "disabled";

export type TelemetrySource = {
  id: string;
  name: string;
  type: string;
  state: TelemetrySourceState;
  lastAttemptAt: string | null;
  lastCheckedAt: string | null;
  lastSuccessAt: string | null;
  lastFailureAt: string | null;
  lastError: string | null;
  durationMs: number | null;
  documentsFound: number | null;
  documentsCreated: number | null;
  documentsRejected: number | null;
  nextExecutionAt: string | null;
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
  ok: true;
  status: "ok";
  databaseAvailable: true;
  generatedAt: string;
  documentsProcessed: number;
  dashboardClients: number;
  activeWorkers: number | null;
  lastSuccessfulIngestion: string | null;
  averageProcessingTimeSeconds: number;
  jobs: TelemetryJobs;
  sources: TelemetrySource[];
  warnings: string[];
};

const PENDING_INGESTION_STATUSES = ["PENDIENTE", "REINTENTANDO"];

const ACTIVE_INGESTION_STATUSES = [
  "DESCARGANDO",
  "EXTRAYENDO_TEXTO",
  "GENERANDO_EMBEDDINGS",
  "CLASIFICANDO_CON_IA",
];

function isoOrNull(value: Date | null | undefined) {
  return value?.toISOString() || null;
}

function configuredWorkerCount() {
  const raw = process.env.WORKER_ACTIVE_INSTANCES;
  if (raw === undefined || raw.trim() === "") return null;
  const parsed = Number(raw);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : null;
}

function staleAfterMs() {
  const configured = Number(process.env.TELEMETRY_SOURCE_STALE_AFTER_HOURS || 48);
  const hours = Number.isFinite(configured) && configured > 0 ? configured : 48;
  return hours * 60 * 60 * 1000;
}

export function deriveTelemetrySourceState(source: {
  isActive: boolean;
  lastCheckedAt: Date | null;
  lastSuccessAt: Date | null;
  lastFailureAt: Date | null;
  lastErrorCategory: string | null;
  latestFetchStatus?: string | null;
  latestFetchAt?: Date | null;
}, now = new Date()): TelemetrySourceState {
  if (!source.isActive) return "disabled";
  if (!source.lastCheckedAt && !source.latestFetchAt) return "never_checked";

  const latestFailed = source.latestFetchStatus === "failed" || Boolean(
    source.lastFailureAt &&
      (!source.lastSuccessAt || source.lastFailureAt > source.lastSuccessAt),
  );
  if (latestFailed) return source.lastSuccessAt ? "degraded" : "failed";
  if (source.lastErrorCategory && !source.lastSuccessAt) return "failed";
  if (!source.lastSuccessAt) return "unknown";
  if (now.getTime() - source.lastSuccessAt.getTime() > staleAfterMs()) return "degraded";
  return "healthy";
}

export async function collectTelemetry(options: { dashboardClients?: number } = {}): Promise<TelemetrySnapshot> {
  const [
    documentsProcessed,
    pending,
    active,
    completed,
    failed,
    deadLetter,
    averageRows,
    lastSuccessfulJob,
    sources,
  ] = await Promise.all([
    prisma.document.count(),
    prisma.ingestionJob.count({ where: { status: { in: PENDING_INGESTION_STATUSES } } }),
    prisma.ingestionJob.count({ where: { status: { in: ACTIVE_INGESTION_STATUSES } } }),
    prisma.ingestionJob.count({ where: { status: "COMPLETADO" } }),
    prisma.ingestionJob.count({ where: { status: "FALLIDO" } }),
    prisma.ingestionJob.count({ where: { status: "EN_DEAD_LETTER_QUEUE" } }),
    prisma.ingestionJob.findMany({
      where: { status: "COMPLETADO", startedAt: { not: null }, completedAt: { not: null } },
      select: { startedAt: true, completedAt: true },
      orderBy: { completedAt: "desc" },
      take: 100,
    }),
    prisma.ingestionJob.findFirst({
      where: { status: "COMPLETADO", completedAt: { not: null } },
      select: { completedAt: true },
      orderBy: { completedAt: "desc" },
    }),
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
        fetchLogs: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: {
            status: true,
            foundItems: true,
            savedItems: true,
            duplicateItems: true,
            errorCategory: true,
            durationMs: true,
            createdAt: true,
          },
        },
      },
    }),
  ]);

  const averageMs = averageRows.length === 0
    ? 0
    : averageRows.reduce(
      (sum, row) => sum + (row.completedAt!.getTime() - row.startedAt!.getTime()),
      0,
    ) / averageRows.length;

  return {
    ok: true,
    status: "ok",
    databaseAvailable: true,
    generatedAt: new Date().toISOString(),
    documentsProcessed,
    dashboardClients: Math.max(0, Math.trunc(options.dashboardClients || 0)),
    // Un job activo no demuestra que exista un proceso worker. Sólo se informa
    // una cifra cuando el runtime declara explícitamente sus instancias.
    activeWorkers: configuredWorkerCount(),
    lastSuccessfulIngestion: isoOrNull(lastSuccessfulJob?.completedAt),
    averageProcessingTimeSeconds: Math.round((averageMs / 1000) * 100) / 100,
    jobs: {
      total: pending + active + completed + failed + deadLetter,
      pending,
      active,
      completed,
      failed,
      deadLetter,
    },
    sources: sources.map((source) => {
      const latest = source.fetchLogs[0];
      const documentsRejected = latest
        ? Math.max(0, latest.foundItems - latest.savedItems - latest.duplicateItems)
        : null;
      return {
        id: source.id,
        name: source.name,
        type: source.type,
        state: deriveTelemetrySourceState({
          ...source,
          latestFetchStatus: latest?.status,
          latestFetchAt: latest?.createdAt,
        }),
        lastAttemptAt: isoOrNull(latest?.createdAt || source.lastCheckedAt),
        lastCheckedAt: isoOrNull(source.lastCheckedAt),
        lastSuccessAt: isoOrNull(source.lastSuccessAt),
        lastFailureAt: isoOrNull(source.lastFailureAt),
        lastError: latest?.status === "failed"
          ? latest.errorCategory || source.lastErrorCategory || "unknown"
          : source.lastErrorCategory,
        durationMs: latest?.durationMs ?? null,
        documentsFound: latest?.foundItems ?? null,
        documentsCreated: latest?.savedItems ?? null,
        documentsRejected,
        // El esquema actual no almacena un calendario verificable por fuente.
        nextExecutionAt: null,
      };
    }),
    warnings: [],
  };
}
