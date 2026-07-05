/**
 * app/api/legal-reports/route.ts
 *
 * Async legal report management.
 *
 * POST /api/legal-reports
 *   Creates a BullMQ job for an asynchronous legal report.
 *   Returns: { ok, id, status: "queued" }
 *
 * GET /api/legal-reports
 *   Lists recent reports (admin-protected).
 *   Returns: { ok, reports: [...] }
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/security/adminAuth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

// ─── POST — create async report job ──────────────────────────────────────────

export async function POST(req: NextRequest) {
  const adminCheck = requireAdmin(req);
  if (!adminCheck.ok) return adminCheck.response;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const query = String(body.query ?? "").trim();
  if (!query) {
    return NextResponse.json(
      { ok: false, error: "missing_query", message: "El campo query es requerido." },
      { status: 400 }
    );
  }

  const filters = (body.filters as Record<string, unknown>) || {};
  const materia = body.materia ? String(body.materia).trim() : undefined;
  const fuente = body.fuente ? String(body.fuente).trim() : undefined;
  const autoridad = body.autoridad ? String(body.autoridad).trim() : undefined;
  const dateFrom = body.dateFrom ? String(body.dateFrom).trim() : undefined;
  const dateTo = body.dateTo ? String(body.dateTo).trim() : undefined;
  const mode = body.mode ? String(body.mode).trim() : undefined;
  const localResults = Array.isArray(body.localResults) ? body.localResults : [];

  // Persist job record
  const job = await prisma.processingJob.create({
    data: {
      queueName: "legal-reports",
      jobName:   "legal-report",
      type:      "LEGAL_REPORT",
      status:    "QUEUED",
      progress:  5,
      stage:     "queued",
      payload:   { query, filters, materia, fuente, autoridad, dateFrom, dateTo, mode, localResults } as Prisma.InputJsonValue,
      input:     { query, filters, materia, fuente, autoridad, dateFrom, dateTo, mode, localResults } as Prisma.InputJsonValue,
    },
  });

  // Enqueue in BullMQ
  try {
    const { Queue } = await import("bullmq");
    const { connection } = await import("@/lib/queue");

    const legalReportQueue = new Queue("legal-reports", { connection: connection as any });
    const bullJob = await legalReportQueue.add("legal-report", {
      processingJobId: job.id,
      query,
      filters,
      materia,
      fuente,
      autoridad,
      dateFrom,
      dateTo,
      mode,
      localResults,
    }, {
      attempts: 3,
      backoff: { type: "exponential", delay: 2000 },
      removeOnComplete: false,
      removeOnFail: false,
    });

    // Update with BullMQ job id
    await prisma.processingJob.update({
      where: { id: job.id },
      data: { jobId: bullJob.id },
    });

    await legalReportQueue.close();
  } catch (queueErr) {
    console.warn("[legal-reports] BullMQ unavailable, job queued in DB only:", queueErr instanceof Error ? queueErr.message : queueErr);
  }

  return NextResponse.json({
    ok: true,
    id: job.id,
    status: "queued",
    message: "Reporte jurídico en cola. Consulta el estado con GET /api/legal-reports/" + job.id,
  }, { status: 202 });
}

// ─── GET — list recent reports ────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const adminCheck = requireAdmin(req);
  if (!adminCheck.ok) return adminCheck.response;

  const url = new URL(req.url);
  const limit  = Math.min(Number(url.searchParams.get("limit")  ?? 20), 100);
  const offset = Math.max(Number(url.searchParams.get("offset") ?? 0),  0);
  const status = url.searchParams.get("status") ?? undefined;

  const where = {
    type: "LEGAL_REPORT",
    ...(status ? { status } : {}),
  };

  const [reports, total] = await Promise.all([
    prisma.processingJob.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
      select: {
        id: true,
        status: true,
        payload: true,
        result: true,
        error: true,
        startedAt: true,
        finishedAt: true,
        createdAt: true,
        attempt: true,
      },
    }),
    prisma.processingJob.count({ where }),
  ]);

  return NextResponse.json({ ok: true, total, reports });
}
