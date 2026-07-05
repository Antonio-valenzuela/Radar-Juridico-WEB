import { prisma } from "@/lib/prisma";
import { runSidofIngest, runSidofInitialBackfill } from "@/lib/ingest/sidof";

let bootstrapping: Promise<void> | null = null;

export async function ensureSidofBootstrap() {
  if (bootstrapping) return bootstrapping;

  bootstrapping = (async () => {
    const total = await prisma.item.count();
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const ranToday = await prisma.ingestRun.findFirst({
      where: { source: "SIDOF", startedAt: { gte: todayStart } },
      orderBy: { startedAt: "desc" },
    });

    if (!ranToday) await runSidofIngest();

    const afterToday = total === 0 ? await prisma.item.count() : total;
    if (afterToday === 0) {
      await runSidofInitialBackfill(7);
    }
  })()
    .catch((error) => {
      console.warn("[auto-sidof] bootstrap failed", error);
    })
    .finally(() => {
      bootstrapping = null;
    });

  return bootstrapping;
}
