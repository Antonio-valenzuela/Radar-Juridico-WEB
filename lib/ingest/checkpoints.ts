import { prisma } from "@/lib/prisma";
import type { SourceName } from "@/lib/sources/types";

export async function getCheckpoint(source: SourceName) {
  const checkpoint = await prisma.ingestCheckpoint.findUnique({ where: { source } });
  if (!checkpoint) return null;
  return {
    source,
    cursor: checkpoint.cursor,
    lastPublishedAt: checkpoint.lastPublishedAt,
  };
}

export async function updateCheckpoint(params: {
  source: SourceName;
  cursor?: string | null;
  lastPublishedAt?: Date | null;
}) {
  return await prisma.ingestCheckpoint.upsert({
    where: { source: params.source },
    update: {
      cursor: params.cursor ?? undefined,
      lastPublishedAt: params.lastPublishedAt ?? undefined,
      updatedAt: new Date(),
    },
    create: {
      source: params.source,
      cursor: params.cursor ?? null,
      lastPublishedAt: params.lastPublishedAt ?? null,
    },
  });
}
