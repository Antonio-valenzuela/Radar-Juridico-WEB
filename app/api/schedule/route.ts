import { NextResponse } from "next/server";
import { ingestQueue } from "../../../lib/queue";
import { requireAdmin } from "@/lib/security/adminAuth";

export const dynamic = "force-dynamic";

const SCHEDULES = [
  {
    id: "schedule-ingest-daily",
    pattern: "0 7 * * *",
    tz: "America/Mexico_City",
    jobName: "ingest-daily",
    data: { days: 1 },
    description: "Fuentes oficiales prioridad 1 - diario a las 7:00 AM CDMX",
  },
  {
    id: "schedule-ingest-weekly",
    pattern: "10 7 * * 1",
    tz: "America/Mexico_City",
    jobName: "ingest-weekly",
    data: { days: 7 },
    description: "Refresh semanal y fuentes prioridad 2 - lunes 7:10 AM CDMX",
  },
  {
    id: "schedule-notify-daily",
    pattern: "30 7 * * *",
    tz: "America/Mexico_City",
    jobName: "notify-daily",
    data: { days: 1 },
    description: "Digest inteligente de novedades - diario a las 7:30 AM CDMX",
  },
  {
    id: "schedule-compute-metrics",
    pattern: "45 7 * * *",
    tz: "America/Mexico_City",
    jobName: "compute-metrics",
    data: {},
    description: "Materializa métricas diarias - diario a las 7:45 AM CDMX",
  },
] as const;

export async function POST(req: Request) {
  const auth = requireAdmin(req);
  if (!auth.ok) return auth.response;
  try {
    const registered = [];

    for (const schedule of SCHEDULES) {
      await ingestQueue.upsertJobScheduler(
        schedule.id,
        { pattern: schedule.pattern, tz: schedule.tz },
        { name: schedule.jobName, data: schedule.data }
      );
      registered.push({
        id: schedule.id,
        pattern: schedule.pattern,
        tz: schedule.tz,
        job: schedule.jobName,
        description: schedule.description,
      });
    }

    return NextResponse.json({ ok: true, scheduled: registered });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

