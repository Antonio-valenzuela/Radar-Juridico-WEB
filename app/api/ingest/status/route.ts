/**
 * GET /api/ingest/status
 * Returns latest IngestRun records per source.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { SOURCE_REGISTRY } from "@/lib/sourceRegistry";

export const dynamic = "force-dynamic";

export async function GET() {
    try {
        // Last 10 runs
        const recentRuns = await prisma.ingestRun.findMany({
            orderBy: { startedAt: "desc" },
            take: 10,
        });

        // Totals
        const totalItems = await prisma.item.count();

        // Per-source counts
        const sourceCounts = await prisma.item.groupBy({
            by: ["source"],
            _count: { _all: true },
        });

        // Sources config
        const sources = SOURCE_REGISTRY.map((s) => ({
            name: s.name,
            label: s.label,
            enabled: s.enabled,
            itemCount:
                sourceCounts.find(
                    (sc) => sc.source.toUpperCase() === s.name.toUpperCase()
                )?._count._all || 0,
            lastRun: recentRuns.find(
                (r) =>
                    r.source.toUpperCase() === s.name.toUpperCase() ||
                    r.source === "ALL"
            ) || null,
        }));

        return NextResponse.json({
            ok: true,
            totalItems,
            sources,
            recentRuns,
        });
    } catch (e: any) {
        console.error("GET /api/ingest/status error:", e);
        return NextResponse.json(
            { ok: false, error: e?.message || "Unknown error" },
            { status: 500 }
        );
    }
}
