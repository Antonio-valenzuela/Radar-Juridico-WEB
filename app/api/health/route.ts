import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getQueueSnapshots } from "../../../lib/queue";
import { checkDatabase, checkRedis } from "@/lib/health/checks";

export const dynamic = "force-dynamic";

export async function GET() {
  const db = await checkDatabase();
  const redis = await checkRedis();
  const [latestIngest, totalItems] = await Promise.all([
    prisma.ingestRun.findFirst({ orderBy: { startedAt: "desc" } }).catch(() => null),
    prisma.item.count().catch(() => 0),
  ]);
  const queues = await getQueueSnapshots().catch((error) => {
    console.error("[health] queue snapshot failed", {
      kind: error instanceof Error ? error.name : typeof error,
    });
    return [{ name: "queues", ok: false, error: "queues_unavailable" }];
  });

  return NextResponse.json({
    ok: db.ok && redis.ok,
    service: "juridico-radar",
    checkedAt: new Date().toISOString(),
    db,
    redis,
    queues,
    latestIngest: latestIngest
      ? {
          source: latestIngest.source,
          startedAt: latestIngest.startedAt.toISOString(),
          finishedAt: latestIngest.finishedAt?.toISOString() || null,
          ok: latestIngest.ok,
          saved: latestIngest.itemsSaved,
        }
      : null,
    totalItems,
  });
}
