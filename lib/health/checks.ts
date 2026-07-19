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
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

export async function checkRedis(client: RedisClient = connection) {
  try {
    const pong = await client.ping();
    return { ok: pong === "PONG" };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

export async function checkCoreReadiness() {
  const [db, redis] = await Promise.all([checkDatabase(), checkRedis()]);
  return {
    ok: db.ok && redis.ok,
    checks: { db, redis },
  };
}

