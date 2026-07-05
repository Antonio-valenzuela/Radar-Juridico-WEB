import { NextResponse } from "next/server";
import { ingestQueue } from "../../../lib/queue";
import { requireAdmin } from "@/lib/security/adminAuth";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const auth = requireAdmin(req);
  if (!auth.ok) return auth.response;
  try {
    const job = await ingestQueue.add("ingest-daily", {
      manual: true,
      triggeredAt: new Date().toISOString(),
    });
    return NextResponse.json({ ok: true, jobId: job.id, jobName: "ingest-daily" });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

