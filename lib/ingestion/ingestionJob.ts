// lib/ingestion/ingestionJob.ts

import { prisma } from '@/lib/prisma';
import { IngestionJob } from '@prisma/client';

export enum IngestionStatus {
  PENDIENTE = 'PENDIENTE',
  DESCARGANDO = 'DESCARGANDO',
  EXTRAYENDO_TEXTO = 'EXTRAYENDO_TEXTO',
  GENERANDO_EMBEDDINGS = 'GENERANDO_EMBEDDINGS',
  CLASIFICANDO_CON_IA = 'CLASIFICANDO_CON_IA',
  COMPLETADO = 'COMPLETADO',
  FALLIDO = 'FALLIDO',
  REINTENTANDO = 'REINTENTANDO',
  EN_DEAD_LETTER_QUEUE = 'EN_DEAD_LETTER_QUEUE',
}

export async function createIngestionJob(
  source: string,
  documentUrl: string
): Promise<IngestionJob> {
  return prisma.ingestionJob.create({
    data: {
      source,
      documentUrl,
      status: IngestionStatus.PENDIENTE,
      attempts: 0,
      maxAttempts: 5,
    },
  });
}

export async function updateIngestionJobStatus(
  jobId: string,
  status: IngestionStatus,
  error?: string
): Promise<IngestionJob> {
  return prisma.ingestionJob.update({
    where: { id: jobId },
    data: {
      status,
      lastError: error,
      updatedAt: new Date(),
    },
  });
}

export async function logIngestionEvent(
  jobId: string,
  message: string,
  level: 'INFO' | 'WARN' | 'ERROR' = 'INFO'
): Promise<void> {
  await prisma.ingestionLog.create({
    data: {
      ingestionJobId: jobId,
      message,
      level,
    },
  });
}

export async function markJobRetrying(jobId: string, attempt: number): Promise<IngestionJob> {
  return prisma.ingestionJob.update({
    where: { id: jobId },
    data: {
      status: IngestionStatus.REINTENTANDO,
      attempts: attempt,
      lastRetryAt: new Date(),
    },
  });
}

export async function moveJobToDeadLetter(
  jobId: string,
  finalError: string
): Promise<IngestionJob> {
  return prisma.ingestionJob.update({
    where: { id: jobId },
    data: {
      status: IngestionStatus.EN_DEAD_LETTER_QUEUE,
      lastError: finalError,
      completedAt: new Date(),
    },
  });
}

export async function completeIngestionJob(
  jobId: string,
  documentId: string
): Promise<IngestionJob> {
  return prisma.ingestionJob.update({
    where: { id: jobId },
    data: {
      status: IngestionStatus.COMPLETADO,
      documentId,
      completedAt: new Date(),
    },
  });
}
