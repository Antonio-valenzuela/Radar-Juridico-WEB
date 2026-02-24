/**
 * GET /api/ingest/all
 * Trigger ingestion of all enabled sources in parallel.
 */
import { NextResponse } from "next/server";
import { runIngestion } from "@/lib/ingestDispatcher";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function GET(req: Request) {
    // Optional auth for GET (less strict since it's a read-trigger)
    const token =
        req.headers.get("x-admin-token") ||
        new URL(req.url).searchParams.get("token");

    if (token !== process.env.ADMIN_TOKEN) {
        return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    try {
        const result = await runIngestion({ source: "ALL" });
        return NextResponse.json({ ok: true, ...result });
    } catch (e: any) {
        console.error("GET /api/ingest/all error:", e);
        return NextResponse.json(
            { ok: false, error: e?.message || "Unknown error" },
            { status: 500 }
        );
    }
}
