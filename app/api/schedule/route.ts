import { NextResponse } from "next/server";
import { bulletinsQueue, ingestQueue } from "../../../lib/queue";
import { requireAdmin } from "@/lib/security/adminAuth";

export const dynamic = "force-dynamic";

const SCHEDULES = [
  {
    id: "schedule-ingest-daily",
    pattern: "0 7 * * *",
    tz: "America/Mexico_City",
    jobName: "ingest-daily",
    data: { days: 1, includes: ["PERIODICO_OFICIAL_JALISCO"] },
    description: "Fuentes oficiales prioridad 1, incluido Periódico Oficial de Jalisco - diario a las 7:00 AM CDMX",
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

const bulletinSchedule = {
  id: "schedule-bulletin-monitor",
  pattern: process.env.BULLETIN_MONITOR_CRON || "0 8-18 * * 1-5",
  tz: process.env.BULLETIN_MONITOR_TIMEZONE || "America/Mexico_City",
  jobName: "bulletin-monitor",
  data: { maxCases: Number(process.env.BULLETIN_MAX_CASES_PER_RUN || 100) },
  description: "Vigilancia del Boletín Judicial con frecuencia configurable",
};

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

    if (process.env.BULLETIN_MONITOR_ENABLED === "true") {
      await bulletinsQueue.upsertJobScheduler(
        bulletinSchedule.id,
        { pattern: bulletinSchedule.pattern, tz: bulletinSchedule.tz },
        { name: bulletinSchedule.jobName, data: bulletinSchedule.data },
      );
      registered.push({ ...bulletinSchedule, job: bulletinSchedule.jobName });
    }

    return NextResponse.json({ ok: true, scheduled: registered });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

