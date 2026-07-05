import { NextResponse } from "next/server";
import { runSidofIngest } from "@/lib/ingest/sidof";
import { requireAdmin } from "@/lib/security/adminAuth";

export const dynamic = "force-dynamic";

/**
 * GET /api/ingest/sidof?date=DD-MM-YYYY
 * Si no mandas date, usa la fecha CDMX de hoy.
 */
export async function POST(req: Request) {
  const auth = requireAdmin(req);
  if (!auth.ok) return auth.response;
  try {
    const url = new URL(req.url);
    const date = url.searchParams.get("date") || undefined;
    const result = await runSidofIngest(date);

    return NextResponse.json(result, { status: result.ok ? 200 : 502 });
  } catch (err: unknown) {
    console.error("ingest sidof error", err);
    return NextResponse.json(
      { ok: false, error: "Fallo en ingesta SIDOF" },
      { status: 500 }
    );
  }
}

