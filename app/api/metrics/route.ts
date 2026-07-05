import { NextRequest, NextResponse } from "next/server";
import { computeMetricsRange, metricsToCsv } from "@/lib/metrics/compute";
import { prisma } from "@/lib/prisma";
import { getQueueSnapshots } from "../../../lib/queue";
import { withMetrics } from "@/lib/observability/metrics";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function GET(req: NextRequest) {
  const startedAt = Date.now();
  const now = new Date();
  const defaultFrom = new Date(now);
  defaultFrom.setMonth(defaultFrom.getMonth() - 11);
  defaultFrom.setDate(1);

  const from = new Date(req.nextUrl.searchParams.get("from") || defaultFrom.toISOString());
  const to = new Date(req.nextUrl.searchParams.get("to") || now.toISOString());
  const result = await computeMetricsRange(from, to);
  const [documentsProcessed, ingestErrors, queueSnapshots, failedJobs] = await withMetrics('metrics_db_queries', () => Promise.all([
    prisma.item.count().catch(() => 0),
    prisma.ingestRun.count({ where: { ok: false } }).catch(() => 0),
    getQueueSnapshots().catch(() => []),
    prisma.deadLetterJob.count().catch(() => 0),
  ]));

  if (req.nextUrl.searchParams.get("format") === "csv") {
    return new NextResponse(metricsToCsv(result), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="juridico-radar-metrics-${result.from}-${result.to}.csv"`,
      },
    });
  }

  return NextResponse.json({
    ...result,
    operational: {
      documentsProcessed,
      ingestErrors,
      failedJobs,
      queueSnapshots,
      searchLatencyMs: Date.now() - startedAt,
    },
  });
}
