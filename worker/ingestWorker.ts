import IORedis from "ioredis";
import { Job, Worker } from "bullmq";
import { runNotifications } from "@/lib/notifications/run";
import { computeMetricsDaily } from "@/lib/metrics/compute";
import {
  runPriority1Ingest,
  runSidofIngest,
  runSidofInitialBackfill,
  runSidofWeek,
  runWeeklyRefresh,
} from "@/lib/ingest/sourceRunners";
import {
  QUEUE_NAMES,
  connection as queueConnection,
  failedJobsQueue,
  ingestQueue,
  notificationsQueue,
} from "@/lib/queue";
import { prisma } from "@/lib/prisma";
import { assertRuntimeEnv } from "@/lib/config/env";
import { checkDatabase, checkRedis } from "@/lib/health/checks";
import { closeHealthServer, startHealthServer } from "@/lib/health/server";

assertRuntimeEnv();

const workerConnection = new IORedis(process.env.REDIS_URL || "redis://localhost:6379", {
  maxRetriesPerRequest: null,
});
const workers: Worker[] = [];
let shuttingDown = false;

function createTrackedWorker<T>(
  queueName: string,
  processor: (job: Job) => Promise<T>
) {
  const worker = new Worker(
    queueName,
    async (job) => {
      const startedAt = new Date();
      const processingJob = await prisma.processingJob
        .create({
          data: {
            queueName,
            jobName: job.name,
            jobId: job.id,
            type: String(job.data?.type || job.name),
            source: job.data?.source ? String(job.data.source) : null,
            status: "active",
            attempt: job.attemptsMade + 1,
            payload: job.data || {},
            startedAt,
          },
        })
        .catch(() => null);

      console.log(JSON.stringify({ event: "worker.job.start", queueName, job: job.name, id: job.id }));

      try {
        const result = await processor(job);
        await markProcessingJob(processingJob?.id, "completed", result, null, startedAt);
        console.log(JSON.stringify({ event: "worker.job.done", queueName, job: job.name, id: job.id, durationMs: Date.now() - startedAt.getTime() }));
        return result;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        await markProcessingJob(processingJob?.id, "failed", null, message, startedAt);
        throw error;
      }
    },
    { connection: workerConnection as any }
  );

  worker.on("failed", (job, error) => {
    void recordDeadLetter(queueName, job, error);
  });

  workers.push(worker);
  return worker;
}

createTrackedWorker(QUEUE_NAMES.ingest, async (job) => {
  const days = Number(job.data?.days || 7);

  if (job.name === "sidof-today" || job.name === "run-now") {
    return await runSidofIngest();
  }

  if (job.name === "sidof-week") {
    return await runSidofWeek(Number(job.data?.days || 7));
  }

  if (job.name === "ingest-daily" || job.name === "all") {
    const result = await runPriority1Ingest(days);
    if (result.saved > 0) await runNotifications({ days: 1 });
    return result;
  }

  if (job.name === "ingest-weekly") {
    const result = await runWeeklyRefresh(days);
    if (result.saved > 0) await runNotifications({ days: 7 });
    return result;
  }

  if (job.name === "notify-daily") {
    return await runNotifications({ days: Number(job.data?.days || 1) });
  }

  if (job.name === "compute-metrics") {
    const date = job.data?.date ? new Date(job.data.date) : new Date();
    const metrics = await computeMetricsDaily(date);
    return { ok: true, date: metrics.date.toISOString().slice(0, 10) };
  }

  throw new Error(`job desconocido: ${job.name}`);
});

createTrackedWorker(QUEUE_NAMES.pdfProcessing, async (job) => ({
  ok: true,
  queue: QUEUE_NAMES.pdfProcessing,
  job: job.name,
  message: "PDF processing queue ready for extractor implementation.",
}));

import { processDocumentIngestion } from "./documentIngestProcessor";

createTrackedWorker(QUEUE_NAMES.documentIngestion, async (job) => {
  return await processDocumentIngestion(job);
});

import { processEmbeddingJob } from "./embeddingWorker";

createTrackedWorker(QUEUE_NAMES.embeddings, async (job) => {
  return await processEmbeddingJob(job);
});

createTrackedWorker(QUEUE_NAMES.notifications, async (job) => {
  return await runNotifications({
    days: Number(job.data?.days || 1),
    email: job.data?.email ? String(job.data.email) : undefined,
    orgSlug: job.data?.orgSlug ? String(job.data.orgSlug) : undefined,
    channels: Array.isArray(job.data?.channels) ? job.data.channels : undefined,
    dryRun: Boolean(job.data?.dryRun),
  });
});

createTrackedWorker(QUEUE_NAMES.failedJobs, async (job) => {
  console.log(JSON.stringify({ event: "worker.dlq.received", id: job.id, payload: job.data }));
  return { ok: true, retained: true };
});

const healthServer = startHealthServer({
  name: "ingest-worker",
  port: Number(process.env.WORKER_HEALTH_PORT || 9101),
  readiness: async () => {
    const [db, redis] = await Promise.all([
      checkDatabase(prisma),
      checkRedis(workerConnection),
    ]);
    return {
      ok: !shuttingDown && db.ok && redis.ok && workers.length > 0,
      checks: { db, redis, workers: workers.length, shuttingDown },
    };
  },
});

async function shutdown(signal: NodeJS.Signals) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`[worker] ${signal} received; closing workers`);

  await closeHealthServer(healthServer);
  await Promise.allSettled(workers.map((worker) => worker.close()));
  workerConnection.disconnect();
  queueConnection.disconnect();
  await prisma.$disconnect();
}

for (const signal of ["SIGTERM", "SIGINT"] as const) {
  process.once(signal, () => {
    void shutdown(signal).then(() => process.exit(0));
  });
}

console.log("[worker] workers running");
console.log("[worker] queues: ingest | pdf-processing | embeddings | notifications | failed-jobs");

void bootstrapWorker();

async function bootstrapWorker() {
  try {
    await ingestQueue.upsertJobScheduler(
      "schedule-ingest-daily",
      { pattern: "0 7 * * *", tz: "America/Mexico_City" },
      { name: "ingest-daily", data: { days: 1 } }
    );
    await ingestQueue.upsertJobScheduler(
      "schedule-ingest-weekly",
      { pattern: "10 7 * * 1", tz: "America/Mexico_City" },
      { name: "ingest-weekly", data: { days: 7 } }
    );
    await notificationsQueue.upsertJobScheduler(
      "schedule-notify-daily",
      { pattern: "30 7 * * *", tz: "America/Mexico_City" },
      { name: "notify-daily", data: { days: 1 } }
    );

    await runPriority1Ingest(1);
    const total = await prisma.item.count();
    if (total === 0) await runSidofInitialBackfill(7);
  } catch (error) {
    console.warn("[worker] bootstrap failed", error);
  }
}

async function markProcessingJob(
  id: string | undefined,
  status: string,
  result: unknown,
  error: string | null,
  startedAt: Date
) {
  if (!id) return;
  await prisma.processingJob
    .update({
      where: { id },
      data: {
        status,
        result: result === null ? undefined : JSON.parse(JSON.stringify(result)),
        error,
        finishedAt: new Date(),
      },
    })
    .catch(() => {
      const durationMs = Date.now() - startedAt.getTime();
      console.warn(JSON.stringify({ event: "worker.processing_job.update_failed", id, status, durationMs }));
    });
}

async function recordDeadLetter(queueName: string, job: Job | undefined, error: Error) {
  if (!job) return;
  const payload = {
    queueName,
    jobName: job.name,
    jobId: job.id,
    attemptsMade: job.attemptsMade,
    payload: job.data || {},
    error: error.message,
  };

  await Promise.allSettled([
    failedJobsQueue.add("dead-letter", payload, {
      jobId: `${queueName}:${job.id || job.name}:${Date.now()}`,
      attempts: 1,
    }),
    prisma.deadLetterJob.create({
      data: {
        queueName,
        jobName: job.name,
        payload,
        error: error.message,
      },
    }),
  ]);
}
