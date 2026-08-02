import { prisma } from "@/lib/prisma";

export interface LogExecutionInput {
  source: string;
  sourceId?: string;
  startedAt: Date;
  finishedAt?: Date;
  status: "success" | "failed" | "warning";
  foundItems?: number;
  savedItems?: number;
  duplicateItems?: number;
  errorsCount?: number;
  errorCategory?: string;
  errorMessage?: string;
}

export async function recordSourceExecution(input: LogExecutionInput) {
  const finishedAt = input.finishedAt || new Date();
  const durationMs = finishedAt.getTime() - input.startedAt.getTime();
  const ok = input.status === "success" || input.status === "warning";

  // Create IngestRun record
  const run = await prisma.ingestRun.create({
    data: {
      source: input.source,
      startedAt: input.startedAt,
      finishedAt,
      ok,
      itemsFound: input.foundItems || 0,
      itemsSaved: input.savedItems || 0,
      duplicates: input.duplicateItems || 0,
      errorsCount: input.errorsCount || (input.status === "failed" ? 1 : 0),
      error: input.errorMessage || null,
    },
  }).catch((err) => {
    console.error("[ExecutionTracker] Failed to record IngestRun:", err);
    return null;
  });

  // If sourceId is provided, also create OfficialSourceFetchLog
  if (input.sourceId) {
    await prisma.officialSourceFetchLog.create({
      data: {
        sourceId: input.sourceId,
        status: input.status,
        foundItems: input.foundItems || 0,
        savedItems: input.savedItems || 0,
        duplicateItems: input.duplicateItems || 0,
        errorCategory: input.errorCategory || null,
        durationMs,
        createdAt: finishedAt,
      },
    }).catch((err) => {
      console.error("[ExecutionTracker] Failed to record OfficialSourceFetchLog:", err);
    });

    // Update OfficialSource lastCheckedAt, lastSuccessAt, lastFailureAt
    await prisma.officialSource.update({
      where: { id: input.sourceId },
      data: {
        lastCheckedAt: finishedAt,
        ...(input.status === "success" ? { lastSuccessAt: finishedAt } : {}),
        ...(input.status === "failed" ? { lastFailureAt: finishedAt, lastErrorCategory: input.errorCategory || "error" } : {}),
      },
    }).catch(() => null);
  }

  return run;
}
