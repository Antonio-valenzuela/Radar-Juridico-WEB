import { NextResponse } from "next/server";
import { ingestSidofWeek } from "@/lib/ingest/sidof";

export const dynamic = "force-dynamic";

/**
 * GET /api/ingest/sidof-week?days=7
 * Recorre los últimos N días usando la lógica compartida (sin HTTP interno).
 */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const days = Number(url.searchParams.get("days") || "7");

    const result = await ingestSidofWeek(days);

    return NextResponse.json(result);
  } catch (err: any) {
    console.error("ingest sidof-week error", err);
    return NextResponse.json(
      { ok: false, error: "Fallo en ingesta SIDOF semanal" },
      { status: 500 }
    );
  }
}
