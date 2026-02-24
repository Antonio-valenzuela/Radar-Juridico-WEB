import { NextResponse } from "next/server";
import { ingestQueue } from "../../../lib/queue";

export async function POST() {
  const job = await ingestQueue.add("sidof-today", { manual: true });
  return NextResponse.json({ ok: true, jobId: job.id });
}
