/**
 * POST /api/ingest/run
 * Unified ingestion trigger. Body: { source?: "SIDOF"|"DOF"|"SCJN"|"ALL", date?, days?, scjnStartId?, scjnCount? }
 */
import { NextResponse } from "next/server";
import { runIngestion } from "@/lib/ingestDispatcher";

export const dynamic = "force-dynamic";
export const maxDuration = 120; // allow long-running ingestion

export async function POST(req: Request) {
    const token = req.headers.get("x-admin-token");
    if (token !== process.env.ADMIN_TOKEN) {
        return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    try {
        const body = await req.json().catch(() => ({}));
        const { source, date, days, scjnStartId, scjnCount } = body;

        const result = await runIngestion({
            source: source?.toUpperCase() || "ALL",
            date,
            days,
            scjnStartId,
            scjnCount,
        });

        return NextResponse.json({ ok: true, ...result });
    } catch (e: any) {
        console.error("POST /api/ingest/run error:", e);
        return NextResponse.json(
            { ok: false, error: e?.message || "Unknown error" },
            { status: 500 }
        );
    }
}
