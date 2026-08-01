import { Worker, type Job } from 'bullmq';
import { connection } from '@/lib/queue';
import { prisma } from '@/lib/prisma';
import { runBulletinCheck } from '@/lib/bulletins/service';

const enabled = process.env.BULLETIN_MONITOR_ENABLED === 'true';
const maxCases = Math.min(Math.max(Number(process.env.BULLETIN_MAX_CASES_PER_RUN || 100), 1), 500);

export async function processBulletinJob(job: Job<{ maxCases?: number }>) {
  const watches = await prisma.caseBulletinWatch.findMany({
    where: { active: true },
    include: { source: true, matter: { select: { organizationId: true } } },
    take: Math.min(Math.max(Number(job.data?.maxCases || maxCases), 1), maxCases),
    orderBy: { lastCheckedAt: 'asc' },
  });
  const results = [];
  for (const watch of watches) {
    if (watch.lastCheckedAt && Date.now() - watch.lastCheckedAt.getTime() < 5 * 60 * 1000) continue;
    await new Promise((resolve) => setTimeout(resolve, Math.floor(Math.random() * 500)));
    results.push(await runBulletinCheck({
      matterId: watch.matterId,
      sourceId: watch.sourceId,
      watchId: watch.id,
      query: {
        sourceSlug: watch.source.slug,
        expedienteNumber: watch.expedienteNumber,
        expedienteYear: watch.expedienteYear || undefined,
        matter: watch.matterLabel || undefined,
        judicialDistrict: watch.judicialDistrict || undefined,
        court: watch.court || undefined,
        chamber: watch.chamber || undefined,
      },
      access: { organizationId: watch.matter.organizationId },
    }));
  }
  return { checked: results.length, results };
}

if (enabled) {
  const worker = new Worker('bulletins', (job) => processBulletinJob(job), {
    connection: connection as any,
    concurrency: Math.min(Math.max(Number(process.env.BULLETIN_CONCURRENCY || 2), 1), 10),
  });
  worker.on('failed', (job, error) => console.error('[bulletin-worker] job failed', { jobId: job?.id, code: error.name }));
  console.log('[bulletin-worker] enabled');
} else {
  console.log('[bulletin-worker] disabled; set BULLETIN_MONITOR_ENABLED=true to start');
}
