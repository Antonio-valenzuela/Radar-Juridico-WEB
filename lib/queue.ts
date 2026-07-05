import { Queue, type JobsOptions } from "bullmq";
import IORedis from "ioredis";
export { cacheConnection } from "@/lib/cacheConnection";

export const connection = new IORedis(process.env.REDIS_URL || "redis://localhost:6379", {
  lazyConnect: true,
  maxRetriesPerRequest: null,
});

export const QUEUE_NAMES = {
  ingest: "ingest",
  pdfProcessing: "pdf-processing",
  embeddings: "embeddings",
  notifications: "notifications",
  failedJobs: "failed-jobs",
  documentIngestion: "document-ingestion",
} as const;

export const defaultJobOptions = {
  attempts: 3,
  backoff: { type: "exponential", delay: 5000 },
  removeOnComplete: { age: 60 * 60 * 24, count: 500 },
  removeOnFail: { age: 60 * 60 * 24 * 7, count: 1000 },
} as const;

function lazyQueue(name: string, options?: { defaultJobOptions?: JobsOptions }) {
  let queue: Queue | null = null;
  return new Proxy({} as Queue, {
    get(_target, prop) {
      queue ??= new Queue(name, { connection: connection as any, ...options });
      const value = queue[prop as keyof Queue];
      return typeof value === "function" ? value.bind(queue) : value;
    },
  });
}

export const ingestQueue = lazyQueue(QUEUE_NAMES.ingest, { defaultJobOptions });
export const pdfProcessingQueue = lazyQueue(QUEUE_NAMES.pdfProcessing, { defaultJobOptions });
export const embeddingsQueue = lazyQueue(QUEUE_NAMES.embeddings, { defaultJobOptions });
export const notificationsQueue = lazyQueue(QUEUE_NAMES.notifications, { defaultJobOptions });
export const failedJobsQueue = lazyQueue(QUEUE_NAMES.failedJobs, {
  defaultJobOptions: {
    attempts: 1,
    removeOnComplete: { age: 60 * 60 * 24 * 30, count: 5000 },
    removeOnFail: { age: 60 * 60 * 24 * 30, count: 5000 },
  },
});
export const documentIngestionQueue = lazyQueue(QUEUE_NAMES.documentIngestion, {
  defaultJobOptions: {
    attempts: 5,
    backoff: { type: "exponential", delay: 1000 },
    removeOnComplete: false,
  },
});

export const domainQueues = [
  ingestQueue,
  pdfProcessingQueue,
  embeddingsQueue,
  notificationsQueue,
  documentIngestionQueue,
] as const;

export async function getQueueSnapshots() {
  return await Promise.all(
    [...domainQueues, failedJobsQueue].map(async (queue) => {
      const counts = await queue.getJobCounts("waiting", "active", "completed", "failed", "delayed", "paused");
      return {
        name: queue.name,
        counts,
        size: Object.values(counts).reduce((sum, value) => sum + Number(value || 0), 0),
      };
    })
  );
}
