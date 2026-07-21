import { prisma } from "@/lib/prisma";
import { connection } from "@/lib/queue";

type DatabaseClient = {
  $queryRawUnsafe(query: string): Promise<unknown>;
};

type RedisClient = {
  ping(): Promise<string>;
};

export async function checkDatabase(client: DatabaseClient = prisma) {
  try {
    await client.$queryRawUnsafe("SELECT 1");
    return { ok: true };
  } catch (error) {
    console.error("[health] database check failed", {
      kind: error instanceof Error ? error.name : typeof error,
    });
    return { ok: false, error: "database_unavailable" };
  }
}

export async function checkRedis(client: RedisClient = connection) {
  try {
    const pong = await client.ping();
    return { ok: pong === "PONG" };
  } catch (error) {
    console.error("[health] redis check failed", {
      kind: error instanceof Error ? error.name : typeof error,
    });
    return { ok: false, error: "redis_unavailable" };
  }
}

export async function checkCoreReadiness() {
  const [db, redis] = await Promise.all([checkDatabase(), checkRedis()]);
  return {
    ok: db.ok && redis.ok,
    checks: { db, redis },
  };
}
