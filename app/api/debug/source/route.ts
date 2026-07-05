import { NextRequest, NextResponse } from "next/server";
import { fetchRawSourceItems, serializeRawItems, sourceNamesFromQuery } from "@/lib/ingest/runIngest";
import { requireAdmin } from "@/lib/security/adminAuth";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function GET(req: NextRequest) {
  const auth = requireAdmin(req);
  if (!auth.ok) return auth.response;
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ ok: false, error: "Solo disponible en desarrollo." }, { status: 404 });
  }

  const source = sourceNamesFromQuery(req.nextUrl.searchParams.get("name"))[0];
  if (!source) {
    return NextResponse.json(
      { ok: false, error: "Fuente invalida. Usa name=SIDOF|DIPUTADOS|SCJN_SJF|SCJN_LEG." },
      { status: 400 }
    );
  }

  const days = parseInt(req.nextUrl.searchParams.get("days") || "7", 10);
  const limit = parseInt(req.nextUrl.searchParams.get("limit") || "20", 10);
  const result = await fetchRawSourceItems(source, { days, limit });
  return NextResponse.json({
    ok: result.ok,
    source,
    found: result.found,
    errors: result.errors,
    items: serializeRawItems(result.items.slice(0, limit)),
  });
}

