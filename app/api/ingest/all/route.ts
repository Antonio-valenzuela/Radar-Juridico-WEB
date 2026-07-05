import { NextRequest, NextResponse } from "next/server";
import { runIngest, sourceNamesFromQuery } from "@/lib/ingest/runIngest";
import { requireAdmin } from "@/lib/security/adminAuth";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * GET /api/ingest/all?days=7&sources=SIDOF,SCJN_SJF
 * Runs priority-1 sources by default. Add includePriority2=1 to include optional sources.
 */
export async function POST(req: NextRequest) {
  const auth = requireAdmin(req);
  if (!auth.ok) return auth.response;
  const days = parseInt(req.nextUrl.searchParams.get("days") || "7", 10);
  const limit = parseInt(req.nextUrl.searchParams.get("limit") || "0", 10) || undefined;
  const includePriority2 = req.nextUrl.searchParams.get("includePriority2") === "1";
  const sources = sourceNamesFromQuery(req.nextUrl.searchParams.get("sources"), includePriority2);
  const result = await runIngest({ days, limit, sources, includePriority2 });
  return NextResponse.json(result);
}

