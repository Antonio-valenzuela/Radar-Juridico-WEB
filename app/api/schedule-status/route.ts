import { NextResponse } from "next/server";
import { ingestQueue } from "../../../lib/queue";
import { requireAdmin } from "@/lib/security/adminAuth";

export const dynamic = "force-dynamic";

type SchedulerLike = {
  id?: string;
  key?: string;
  name?: string;
  pattern?: string;
  cron?: string;
  tz?: string;
  next?: string | number | Date;
  count?: number | null;
};

export async function GET(req: Request) {
  const auth = requireAdmin(req);
  if (!auth.ok) return auth.response;
  try {
    let schedulers: SchedulerLike[] = [];

    if (typeof ingestQueue.getJobSchedulers === "function") {
      schedulers = (await ingestQueue.getJobSchedulers(0, 100)) as unknown as SchedulerLike[];
    } else {
      schedulers = (await ingestQueue.getRepeatableJobs(0, 100)) as unknown as SchedulerLike[];
    }

    const formatted = schedulers.map((scheduler) => ({
      id: scheduler.id || scheduler.key,
      name: scheduler.name,
      pattern: scheduler.pattern || scheduler.cron,
      tz: scheduler.tz,
      next: scheduler.next ? new Date(scheduler.next).toISOString() : null,
      count: scheduler.count ?? null,
    }));

    return NextResponse.json({ ok: true, count: formatted.length, schedulers: formatted });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

