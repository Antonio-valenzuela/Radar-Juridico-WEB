import { NextRequest, NextResponse } from "next/server";
import { runSourceIngest } from "@/lib/ingest/runIngest";
import { requireAdmin } from "@/lib/security/adminAuth";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * GET /api/ingest/sjf?days=7
 * GET /api/ingest/sjf?startId=2029500&count=20  (legacy params still supported)
 *
 * Ingests SJF tesis/jurisprudencia.
 * Prefer `days` param; `startId`+`count` remain for manual overrides.
 */
export async function POST(req: NextRequest) {
  const auth = requireAdmin(req);
  if (!auth.ok) return auth.response;
  try {
    const sp = req.nextUrl.searchParams;
    const daysParam = sp.get("days");
    const days = parseInt(daysParam || "7");
    const limit = parseInt(sp.get("count") || sp.get("limit") || "0", 10) || undefined;
    const result = await runSourceIngest("SCJN_SJF", { days, limit });
    return NextResponse.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

