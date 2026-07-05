/**
 * app/api/legal-reports/[id]/route.ts
 *
 * GET /api/legal-reports/:id
 *   Returns the current status and result of an async legal report.
 *
 * States: QUEUED → PROCESSING → COMPLETED | FAILED
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/security/adminAuth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const adminCheck = requireAdmin(req);
  if (!adminCheck.ok) return adminCheck.response;

  const { id } = await params;

  const job = await prisma.processingJob.findUnique({
    where: { id },
    select: {
      id:         true,
      status:     true,
      payload:    true,
      result:     true,
      error:      true,
      attempt:    true,
      startedAt:  true,
      finishedAt: true,
      createdAt:  true,
      updatedAt:  true,
      progress:   true,
      stage:      true,
      input:      true,
    },
  });

  if (!job || job.id !== id) {
    return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  }

  // User friendly stage labels mapping
  const stageLabels: Record<string, string> = {
    queued: "Reporte en cola",
    searching: "Buscando información",
    collecting_sources: "Recopilando fuentes",
    analyzing: "Analizando",
    generating_summary: "Generando resumen",
    completed: "Completado",
    failed: "Fallido",
  };

  const statusMap: Record<string, { label: string; progress: number }> = {
    QUEUED:     { label: "Reporte en cola",    progress: 5  },
    PROCESSING: { label: "Procesando",         progress: 40 },
    SEARCHING:  { label: "Buscando fuentes",   progress: 30 },
    ANALYZING:  { label: "Analizando con IA",  progress: 70 },
    COMPLETED:  { label: "Completado",         progress: 100 },
    FAILED:     { label: "Fallido",            progress: 0  },
  };

  const dbStage = job.stage || "queued";
  const label = stageLabels[dbStage] || statusMap[job.status]?.label || job.status;
  const progress = job.progress ?? statusMap[job.status]?.progress ?? 0;

  const durationMs = job.startedAt && job.finishedAt
    ? job.finishedAt.getTime() - job.startedAt.getTime()
    : null;

  return NextResponse.json({
    ok: true,
    id: job.id,
    status: job.status,
    stage: dbStage,
    statusLabel: label,
    progress,
    query: ((job.input || job.payload) as Record<string, unknown>)?.query ?? null,
    input: job.input || job.payload,
    result: job.status === "COMPLETED" ? job.result : null,
    error:  job.status === "FAILED"    ? job.error  : null,
    attempt: job.attempt,
    durationMs,
    createdAt:  job.createdAt,
    startedAt:  job.startedAt,
    finishedAt: job.finishedAt,
  });
}
