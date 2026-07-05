import { NextResponse } from "next/server";
import { runSidofWeek } from "@/lib/ingest/sidof";
import { requireAdmin } from "@/lib/security/adminAuth";

export const dynamic = "force-dynamic";

/**
 * GET /api/ingest/sidof-week?days=7
 * Recorre los últimos N días usando la lógica compartida (sin HTTP interno).
 */
export async function POST(req: Request) {
  const auth = requireAdmin(req);
  if (!auth.ok) return auth.response;
  try {
    const url = new URL(req.url);
    const days = Number(url.searchParams.get("days") || "7");

    const result = await runSidofWeek(days);

    return NextResponse.json(result);
  } catch (err: unknown) {
    console.error("ingest sidof-week error", err);
    return NextResponse.json(
      { ok: false, error: "Fallo en ingesta SIDOF semanal" },
      { status: 500 }
    );
  }
}

