import { NextRequest, NextResponse } from "next/server";
import { runSourceIngest, sourceNamesFromQuery } from "@/lib/ingest/runIngest";
import { requireAdmin } from "@/lib/security/adminAuth";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  const auth = requireAdmin(req);
  if (!auth.ok) return auth.response;
  const name = req.nextUrl.searchParams.get("name");
  const source = sourceNamesFromQuery(name)[0];
  if (!source) {
    return NextResponse.json(
      { ok: false, error: "Fuente invalida. Usa name=SIDOF|DIPUTADOS|SCJN_SJF|SCJN_LEG." },
      { status: 400 }
    );
  }

  const days = parseInt(req.nextUrl.searchParams.get("days") || "7", 10);
  const limit = parseInt(req.nextUrl.searchParams.get("limit") || "0", 10) || undefined;
  const result = await runSourceIngest(source, { days, limit });
  return NextResponse.json(result, { status: result.ok ? 200 : 502 });
}

