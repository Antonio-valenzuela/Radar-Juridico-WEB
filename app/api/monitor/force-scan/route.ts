/**
 * API: Force Scan
 * POST /api/monitor/force-scan — trigger immediate scan
 */

import { NextRequest, NextResponse } from "next/server";
import { Queue } from "bullmq";
import IORedis from "ioredis";

export async function POST(req: NextRequest) {
    try {
        const body = await req.json().catch(() => ({}));
        const sourceId = body.sourceId || null;

        const connection = new IORedis(process.env.REDIS_URL!, {
            maxRetriesPerRequest: null,
        });

        const queue = new Queue("ingest", { connection });

        if (sourceId) {
            await queue.add("scan-source", { sourceId }, {
                removeOnComplete: { count: 20 },
                removeOnFail: { count: 10 },
            });
        } else {
            await queue.add("scan-all", {}, {
                removeOnComplete: { count: 20 },
                removeOnFail: { count: 10 },
            });
        }

        await connection.quit();

        return NextResponse.json({
            ok: true,
            message: sourceId
                ? `Escaneo programado para fuente ${sourceId}`
                : "Escaneo general programado",
        });
    } catch (err: any) {
        console.error("POST /api/monitor/force-scan error:", err);
        return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
    }
}
