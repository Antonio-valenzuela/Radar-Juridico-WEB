/**
 * POST /api/ingest/sidof
 * Quick SIDOF-only ingestion for today (or a specific date).
 * Uses the real JSON API parser from lib/ingest/sidof.ts.
 */
import { NextResponse } from "next/server";
import { ingestSidofByDate } from "@/lib/ingest/sidof";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const token = req.headers.get("x-admin-token");
  if (token !== process.env.ADMIN_TOKEN) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const date = body?.date; // optional DD-MM-YYYY

    const result = await ingestSidofByDate(date);

    return NextResponse.json({
      ok: result.ok,
      date: result.date,
      found: result.found,
      saved: result.saved,
      sample: result.sample,
      error: result.error,
    });
  } catch (e: any) {
    console.error("POST /api/ingest/sidof error:", e);
    return NextResponse.json(
      { ok: false, error: e?.message || "Unknown error" },
      { status: 500 }
    );
  }
}