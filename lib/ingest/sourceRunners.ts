import { runIngest, runSourceIngest } from "@/lib/ingest/runIngest";
import { runSidofIngest, runSidofInitialBackfill, runSidofWeek } from "@/lib/ingest/sidof";

export { runSidofIngest, runSidofInitialBackfill, runSidofWeek };

export async function runSjfIngest(days = 7) {
  return await runSourceIngest("SCJN_SJF", { days: Math.max(1, Math.min(30, days)) });
}

export async function runScjnLegislacionIngest(days = 30) {
  return await runSourceIngest("SCJN_LEG", { days: Math.max(1, Math.min(60, days)) });
}

export async function runDiputadosIngest(days = 30) {
  return await runSourceIngest("DIPUTADOS", { days: Math.max(1, Math.min(60, days)) });
}

export async function runPriority1Ingest(days = 1) {
  return await runIngest({ days: Math.max(1, Math.min(30, days)), includePriority2: false });
}

export async function runWeeklyRefresh(days = 7) {
  return await runIngest({ days: Math.max(7, Math.min(30, days)), includePriority2: true });
}
