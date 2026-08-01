import { Worker, type Job } from 'bullmq';
import { connection, QUEUE_NAMES } from '@/lib/queue';
import { prisma } from '@/lib/prisma';
import { JaliscoBulletinAdapter } from '@/lib/bulletins/adapters/jalisco';
import { querySource, runBulletinCheck } from '@/lib/bulletins/service';
import {
  bulletinExpedienteKey,
  createBulletinBatchPlan,
  createBulletinResultIndex,
  type BulletinBatchGroup,
  type BulletinBatchWatch,
} from '@/lib/bulletins/batch';
import type { BulletinAdapterResult } from '@/lib/bulletins/types';

export const BULLETIN_SCHEDULER_ID = 'schedule-bulletin-monitor';
export const BULLETIN_WORKER_JOB_CONCURRENCY = 1;
const BULLETIN_JOB_NAME = 'bulletin-monitor';

type BulletinEnvironment = Record<string, string | undefined>;

export type BulletinWorkerConfig = {
  enabled: boolean;
  cron: string;
  timezone: string;
  maxGroups: number;
  maxWatchesPerGroup: number;
  concurrency: number;
  minCheckIntervalMs: number;
  jitterMs: number;
};

export type BulletinWorkerWatch = {
  id: string;
  matterId: string;
  sourceId: string;
  expedienteNumber: string;
  expedienteYear: number | null;
  matterLabel: string | null;
  judicialDistrict: string | null;
  court: string | null;
  chamber: string | null;
  lastCheckedAt: Date | null;
  source: { slug: string; adapter: string };
  matter: { organizationId: string };
};

type PlannedBulletinWatch = BulletinWorkerWatch & BulletinBatchWatch;

type BulletinCheckOutcome = {
  runId: string;
  result: BulletinAdapterResult;
  newResults: number;
};

export type BulletinJobData = {
  maxGroups?: number;
  date?: string;
};

type BulletinProcessorDependencies = {
  listWatches: (limit: number) => Promise<BulletinWorkerWatch[]>;
  fetchGroup: (
    group: BulletinBatchGroup<PlannedBulletinWatch>,
  ) => Promise<BulletinAdapterResult>;
  checkWatch: (
    watch: BulletinWorkerWatch,
    adapterResult?: BulletinAdapterResult,
  ) => Promise<BulletinCheckOutcome>;
  delay: (milliseconds: number) => Promise<void>;
  now: () => Date;
};

const integerSetting = (value: string | undefined, fallback: number, min: number, max: number) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) ? Math.min(Math.max(parsed, min), max) : fallback;
};

export function buildBulletinWorkerConfig(
  environment: BulletinEnvironment = process.env,
): BulletinWorkerConfig {
  return {
    enabled: environment.BULLETIN_MONITOR_ENABLED === 'true',
    cron: environment.BULLETIN_MONITOR_CRON?.trim() || '0 8-18 * * 1-5',
    timezone: environment.BULLETIN_MONITOR_TIMEZONE?.trim() || 'America/Mexico_City',
    maxGroups: integerSetting(environment.BULLETIN_MAX_GROUPS_PER_RUN, 25, 1, 500),
    maxWatchesPerGroup: integerSetting(
      environment.BULLETIN_MAX_WATCHES_PER_GROUP || environment.BULLETIN_MAX_CASES_PER_RUN,
      500,
      1,
      2_000,
    ),
    concurrency: integerSetting(environment.BULLETIN_CONCURRENCY, 2, 1, 10),
    minCheckIntervalMs: integerSetting(environment.BULLETIN_MIN_CHECK_INTERVAL_MS, 5 * 60_000, 0, 24 * 60 * 60_000),
    jitterMs: integerSetting(environment.BULLETIN_REQUEST_JITTER_MS, 500, 0, 60_000),
  };
}

function dateInTimeZone(date: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value || '';
  return `${value('year')}-${value('month')}-${value('day')}`;
}

function defaultListWatches(limit: number): Promise<BulletinWorkerWatch[]> {
  return prisma.caseBulletinWatch.findMany({
    where: { active: true },
    include: {
      source: { select: { slug: true, adapter: true } },
      matter: { select: { organizationId: true } },
    },
    take: limit,
    orderBy: [
      { lastCheckedAt: { sort: 'asc', nulls: 'first' } },
      { createdAt: 'asc' },
    ],
  });
}

function queryForWatch(watch: BulletinWorkerWatch) {
  return {
    sourceSlug: watch.source.slug,
    expedienteNumber: watch.expedienteNumber,
    expedienteYear: watch.expedienteYear || undefined,
    matter: watch.matterLabel || undefined,
    judicialDistrict: watch.judicialDistrict || undefined,
    court: watch.court || undefined,
    chamber: watch.chamber || undefined,
  };
}

function defaultCheckWatch(
  watch: BulletinWorkerWatch,
  adapterResult?: BulletinAdapterResult,
): Promise<BulletinCheckOutcome> {
  return runBulletinCheck({
    matterId: watch.matterId,
    sourceId: watch.sourceId,
    watchId: watch.id,
    query: queryForWatch(watch),
    access: { organizationId: watch.matter.organizationId },
    adapterResult,
  });
}

const jaliscoAdapterCache = new Map<string, JaliscoBulletinAdapter>();

function jaliscoAdapter(sourceId: string) {
  let adapter = jaliscoAdapterCache.get(sourceId);
  if (!adapter) {
    adapter = new JaliscoBulletinAdapter();
    jaliscoAdapterCache.set(sourceId, adapter);
  }
  return adapter;
}

async function defaultFetchGroup(
  group: BulletinBatchGroup<PlannedBulletinWatch>,
): Promise<BulletinAdapterResult> {
  const representative = group.watches[0];
  if (!representative) throw new Error('INVALID_QUERY: grupo de boletín vacío');
  const isJalisco = representative.source.adapter === 'JALISCO_BULLETIN'
    || representative.source.slug === 'boletin_judicial_jalisco';
  if (isJalisco) {
    return jaliscoAdapter(representative.sourceId).fetchDailyBulletin({
      subjectId: group.matter,
      districtId: group.judicialDistrict,
      courtId: group.court,
      publicationDate: group.date,
    });
  }
  return querySource(representative.source.slug, queryForWatch(representative));
}

const defaultDependencies: BulletinProcessorDependencies = {
  listWatches: defaultListWatches,
  fetchGroup: defaultFetchGroup,
  checkWatch: defaultCheckWatch,
  delay: async (milliseconds) => {
    if (milliseconds > 0) await new Promise((resolve) => setTimeout(resolve, milliseconds));
  },
  now: () => new Date(),
};

type GroupSummary = {
  checked: number;
  providerRequests: number;
  reusedResults: number;
  failed: number;
};

async function processWithConcurrency<T>(
  values: T[],
  concurrency: number,
  operation: (value: T) => Promise<GroupSummary>,
) {
  const summaries: GroupSummary[] = [];
  let nextIndex = 0;
  const runners = Array.from({ length: Math.min(concurrency, values.length) }, async () => {
    while (nextIndex < values.length) {
      const index = nextIndex;
      nextIndex += 1;
      summaries[index] = await operation(values[index]);
    }
  });
  await Promise.all(runners);
  return summaries;
}

export function createBulletinJobProcessor(
  dependencies: BulletinProcessorDependencies = defaultDependencies,
  config: BulletinWorkerConfig = buildBulletinWorkerConfig(),
) {
  return async function processBulletinJob(job: Job<BulletinJobData>) {
    const maxGroups = typeof job.data?.maxGroups === 'number'
      ? integerSetting(String(job.data.maxGroups), config.maxGroups, 1, config.maxGroups)
      : config.maxGroups;
    const now = dependencies.now();
    const date = typeof job.data?.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(job.data.date)
      ? job.data.date
      : dateInTimeZone(now, config.timezone);
    const candidateLimit = Math.min(maxGroups * config.maxWatchesPerGroup, 10_000);
    const candidates = await dependencies.listWatches(candidateLimit);
    const eligible = candidates.filter((watch) => (
      !watch.lastCheckedAt || now.getTime() - watch.lastCheckedAt.getTime() >= config.minCheckIntervalMs
    ));
    const plannedWatches: PlannedBulletinWatch[] = eligible.map((watch) => ({
      ...watch,
      provider: watch.source.adapter || watch.source.slug,
      providerId: watch.sourceId,
    }));
    const plan = createBulletinBatchPlan(plannedWatches, {
      date,
      maxGroups,
      maxWatchesPerGroup: config.maxWatchesPerGroup,
    });

    const summaries = await processWithConcurrency(plan.groups, config.concurrency, async (group) => {
      const summary: GroupSummary = { checked: 0, providerRequests: 0, reusedResults: 0, failed: 0 };
      summary.providerRequests = 1;
      const jitter = config.jitterMs > 0 ? Math.floor(Math.random() * config.jitterMs) : 0;
      await dependencies.delay(jitter);
      const groupResult = await dependencies.fetchGroup(group);
      const resultIndex = groupResult.queryStatus === 'SUCCESS'
        ? createBulletinResultIndex(groupResult.results)
        : null;

      for (const watch of group.watches) {
        const matches = resultIndex?.get(bulletinExpedienteKey(watch)) || [];
        const watchResult = resultIndex
          ? {
              ...groupResult,
              status: matches.length > 0 ? 'PUBLISHED' as const : 'NOT_FOUND_AS_OF' as const,
              publicationStatus: matches.length > 0
                ? 'NEW_PUBLICATIONS' as const
                : 'NO_PUBLICATION_FOUND_AS_OF' as const,
              results: matches,
            }
          : groupResult;
        summary.reusedResults += 1;
        try {
          await dependencies.checkWatch(watch, watchResult);
          summary.checked += 1;
        } catch (error) {
          summary.failed += 1;
          console.warn('[bulletin-worker] watch failed', {
            watchId: watch.id,
            error: error instanceof Error ? error.name : 'UNKNOWN',
          });
        }
      }
      return summary;
    });

    const totals = summaries.reduce((total, summary) => ({
      checked: total.checked + summary.checked,
      providerRequests: total.providerRequests + summary.providerRequests,
      reusedResults: total.reusedResults + summary.reusedResults,
      failed: total.failed + summary.failed,
    }), { checked: 0, providerRequests: 0, reusedResults: 0, failed: 0 });

    if (totals.failed > 0) {
      throw new Error(`Bulletin batch failed for ${totals.failed} watch(es).`);
    }

    return {
      ...totals,
      groups: plan.groups.length,
      candidates: candidates.length,
      skipped: candidates.length - eligible.length,
      dropped: plan.droppedWatches,
      date,
    };
  };
}

export const processBulletinJob = createBulletinJobProcessor();

type ConsumerFactory<T> = (
  queueName: string,
  processor: (job: Job<BulletinJobData>) => Promise<unknown>,
) => T;

export function registerBulletinConsumer<T>(input: {
  config: BulletinWorkerConfig;
  processor: (job: Job<BulletinJobData>) => Promise<unknown>;
  createConsumer: ConsumerFactory<T>;
}): T | null {
  if (!input.config.enabled) return null;
  return input.createConsumer(QUEUE_NAMES.bulletins, input.processor);
}

type BulletinSchedulerQueue = {
  upsertJobScheduler: (
    id: string,
    repeat: { pattern: string; tz: string },
    template: { name: string; data: BulletinJobData },
  ) => Promise<unknown>;
  removeJobScheduler?: (id: string) => Promise<unknown>;
};

export async function upsertBulletinScheduler(
  queue: BulletinSchedulerQueue,
  config: BulletinWorkerConfig,
) {
  if (!config.enabled) {
    await queue.removeJobScheduler?.(BULLETIN_SCHEDULER_ID);
    return false;
  }
  await queue.upsertJobScheduler(
    BULLETIN_SCHEDULER_ID,
    { pattern: config.cron, tz: config.timezone },
    { name: BULLETIN_JOB_NAME, data: { maxGroups: config.maxGroups } },
  );
  return true;
}

export function startStandaloneBulletinWorker(config = buildBulletinWorkerConfig()) {
  if (!config.enabled) return null;
  const processor = createBulletinJobProcessor(defaultDependencies, config);
  const worker = new Worker<BulletinJobData>(QUEUE_NAMES.bulletins, processor, {
    connection: connection as any,
    concurrency: BULLETIN_WORKER_JOB_CONCURRENCY,
    settings: {
      backoffStrategy: (attemptsMade: number, _type?: string, _err?: Error, job?: any) => {
        const rawBackoff = job?.opts?.backoff;
        const delay = typeof rawBackoff === 'object' && rawBackoff !== null && 'delay' in rawBackoff
          ? Number((rawBackoff as any).delay) || 10000
          : typeof rawBackoff === 'number'
          ? rawBackoff
          : 10000;
        return Math.pow(2, attemptsMade) * delay + Math.random() * 500;
      }
    }
  });
  worker.on('failed', (job, error) => console.error('[bulletin-worker] job failed', {
    jobId: job?.id,
    code: error.name,
  }));
  console.log('[bulletin-worker] enabled');
  return worker;
}

const normalizedEntryPoint = (process.argv[1] || '').replace(/\\/g, '/');
const isDirectWorkerRun = normalizedEntryPoint.endsWith('/worker/bulletinWorker.ts')
  || normalizedEntryPoint.endsWith('/worker/bulletinWorker.js');

if (isDirectWorkerRun) {
  const worker = startStandaloneBulletinWorker();
  if (!worker) {
    console.log('[bulletin-worker] disabled; set BULLETIN_MONITOR_ENABLED=true to start');
  } else {
    let shuttingDown = false;
    const shutdown = async (signal: NodeJS.Signals) => {
      if (shuttingDown) return;
      shuttingDown = true;
      console.log(`[bulletin-worker] ${signal} received; closing worker`);
      await worker.close();
      connection.disconnect();
      await prisma.$disconnect();
    };
    for (const signal of ['SIGTERM', 'SIGINT'] as const) {
      process.once(signal, () => {
        void shutdown(signal).then(() => process.exit(0));
      });
    }
  }
}
