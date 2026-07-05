import { NextRequest, NextResponse } from "next/server";
import { runSourceIngest } from "@/lib/ingest/runIngest";
import { requireAdmin } from "@/lib/security/adminAuth";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * GET /api/ingest/leyes?days=30
 * Scrapes Cámara de Diputados LeyesBiblio for laws updated in the last N days.
 */
export async function POST(req: NextRequest) {
  const auth = requireAdmin(req);
  if (!auth.ok) return auth.response;
  try {
    const days = parseInt(req.nextUrl.searchParams.get("days") || "30");
    const result = await runSourceIngest("DIPUTADOS", { days });
    return NextResponse.json(result, { status: result.ok ? 200 : 502 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

