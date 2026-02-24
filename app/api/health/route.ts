import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
    try {
        // Test DB connection and tables
        const itemPromise = prisma.item.count();
        const sourcePromise = prisma.source.count();
        const runPromise = prisma.ingestRun.count();

        const [itemCount, sourceCount, runCount] = await Promise.all([
            itemPromise,
            sourcePromise,
            runPromise
        ]);

        return NextResponse.json({
            ok: true,
            status: "UP",
            database: "connected",
            tables: {
                item: itemCount,
                source: sourceCount,
                ingestRun: runCount
            },
            timestamp: new Date().toISOString()
        });
    } catch (err: any) {
        console.error("Health check failed:", err);
        return NextResponse.json({
            ok: false,
            status: "DOWN",
            error: err.message,
            timestamp: new Date().toISOString()
        }, { status: 500 });
    }
}
