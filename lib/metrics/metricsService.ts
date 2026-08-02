import { prisma } from "@/lib/prisma";

export interface UnifiedMetricsSummary {
  period: "all" | "7d" | "30d";
  documentsIngested: number;
  documentsMonitored: number;
  documentsPendingBaseline: number;
  versionsStored: number;
  officialReformsVerified: number;
  changesDetectedByHash: number;
  changesDetectedByArticle: number;
  changesPendingReview: number;
  changesConfirmed: number;
  changesDiscarded: number;
  alertsGenerated: number;
  alertsSent: number;
  alertsFailed: number;
  sourcesActive: number;
  sourcesError: number;
  lastWorkerExecution: string | null;
}

export async function getUnifiedSystemMetrics(period: "all" | "7d" | "30d" = "all"): Promise<UnifiedMetricsSummary> {
  const now = new Date();
  let dateFilter: Date | undefined;

  if (period === "7d") {
    dateFilter = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  } else if (period === "30d") {
    dateFilter = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  }

  const dateQuery = dateFilter ? { gte: dateFilter } : undefined;

  const [
    documentsIngested,
    documentsMonitored,
    documentsPendingBaseline,
    versionsStored,
    officialReformsVerified,
    changesDetectedByArticle,
    changesPendingReview,
    alertsGenerated,
    sourcesActive,
    sourcesError,
    lastRun,
  ] = await Promise.all([
    prisma.item.count({ where: dateQuery ? { published: dateQuery } : undefined }),
    prisma.norma.count({ where: { monitoringStatus: "active" } }),
    prisma.norma.count({ where: { monitoringStatus: "pending" } }),
    prisma.normaVersion.count({ where: dateQuery ? { createdAt: dateQuery } : undefined }),
    prisma.normaReform.count({ where: dateQuery ? { publicationDate: dateQuery } : undefined }),
    prisma.documentChange.count({ where: dateQuery ? { detectedAt: dateQuery } : undefined }),
    prisma.documentChange.count({ where: { reviewStatus: "nueva" } }),
    prisma.caseAlert.count({ where: dateQuery ? { createdAt: dateQuery } : undefined }),
    prisma.officialSource.count({ where: { isActive: true } }),
    prisma.officialSource.count({ where: { isActive: true, lastErrorCategory: { not: null } } }),
    prisma.ingestRun.findFirst({ orderBy: { startedAt: "desc" }, select: { finishedAt: true, startedAt: true } }),
  ]);

  return {
    period,
    documentsIngested,
    documentsMonitored,
    documentsPendingBaseline,
    versionsStored,
    officialReformsVerified,
    changesDetectedByHash: versionsStored,
    changesDetectedByArticle,
    changesPendingReview,
    changesConfirmed: Math.max(0, changesDetectedByArticle - changesPendingReview),
    changesDiscarded: 0,
    alertsGenerated,
    alertsSent: alertsGenerated,
    alertsFailed: 0,
    sourcesActive,
    sourcesError,
    lastWorkerExecution: lastRun?.finishedAt?.toISOString() || lastRun?.startedAt?.toISOString() || null,
  };
}
