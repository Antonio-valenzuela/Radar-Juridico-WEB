import { prisma } from '@/lib/prisma';
import { buildBulletinDedupeKey, hashBulletinContent } from '@/lib/bulletins/dedupe';
import { queryFederalBulletin } from '@/lib/bulletins/adapters/federal';
import { queryJaliscoBulletin } from '@/lib/bulletins/adapters/jalisco';
import type { BulletinAdapterResult, BulletinQuery } from '@/lib/bulletins/types';

const JALISCO_SLUGS = new Set(['boletin_judicial_jalisco']);
const FEDERAL_SLUGS = new Set(['boletin_judicial_federal', 'cjf_sise', 'boletin_general_cjf']);

export type BulletinAccessContext = {
  organizationId: string;
  userId?: string | null;
};

export async function runBulletinCheck(input: {
  matterId: string;
  sourceId: string;
  watchId?: string;
  query: BulletinQuery;
  access: BulletinAccessContext;
  adapterResult?: BulletinAdapterResult;
}): Promise<{ runId: string; result: BulletinAdapterResult; newResults: number }> {
  const startedAt = new Date();
  const source = await prisma.officialSource.findUnique({ where: { id: input.sourceId } });
  if (!source) throw new Error('SOURCE_UNAVAILABLE: fuente judicial no encontrada');

  const run = await prisma.bulletinCheckRun.create({
    data: {
      sourceId: source.id,
      matterId: input.matterId,
      watchId: input.watchId,
      status: 'RUNNING',
      query: input.query as any,
      sourceUrl: source.baseUrl,
    },
  });

  let result: BulletinAdapterResult;
  try {
    result = input.adapterResult || await querySource(source.slug, input.query);
  } catch (error) {
    result = {
      status: 'SOURCE_UNAVAILABLE',
      checkedAt: new Date(),
      sourceUrl: source.baseUrl,
      results: [],
      warnings: ['No fue posible consultar la fuente oficial.'],
      responseHash: null,
      errorCode: 'SOURCE_UNAVAILABLE',
      errorMessage: error instanceof Error ? error.message : undefined,
    };
  }

  let newResults = 0;
  let lastPublishedAt: Date | null = null;
  for (const entry of result.results) {
    const contentHash = hashBulletinContent({
      expedienteNumber: entry.expedienteNumber,
      court: entry.court,
      publicationDate: entry.publicationDate,
      agreementDate: entry.agreementDate,
      proceedingType: entry.proceedingType,
      heading: entry.heading,
      extract: entry.extract,
      parties: entry.parties,
    });
    const dedupeKey = buildBulletinDedupeKey({
      sourceId: source.id,
      court: entry.court,
      expedienteNumber: entry.expedienteNumber,
      publicationDate: entry.publicationDate,
      contentHash,
    });

    const existing = await prisma.judicialBulletinEntry.findUnique({
      where: { dedupeKey },
      select: { id: true, actuation: { select: { id: true } } },
    });
    const saved = existing
      ? await prisma.judicialBulletinEntry.update({
          where: { id: existing.id },
          data: { lastSeenAt: new Date(), raw: entry.raw as any, verificationStatus: 'official_source' },
        })
      : await prisma.judicialBulletinEntry.create({
          data: {
            sourceId: source.id,
            matterId: input.matterId,
            externalId: entry.externalId,
            expedienteNumber: entry.expedienteNumber,
            expedienteYear: entry.expedienteYear,
            matterLabel: entry.matter,
            judicialDistrict: entry.judicialDistrict,
            court: entry.court,
            chamber: entry.chamber,
            bulletinNumber: entry.bulletinNumber,
            publicationDate: entry.publicationDate,
            agreementDate: entry.agreementDate,
            proceedingType: entry.proceedingType,
            heading: entry.heading,
            extract: entry.extract,
            parties: entry.parties as any,
            sourceUrl: entry.sourceUrl,
            contentHash,
            dedupeKey,
            raw: entry.raw as any,
            verificationStatus: 'official_source',
          },
        });

    if (!existing) {
      newResults += 1;
      const actuation = await prisma.caseActuation.findFirst({ where: { bulletinEntryId: saved.id } });
      if (!actuation) {
        await prisma.caseActuation.create({
          data: {
            matterId: input.matterId,
            date: entry.publicationDate || result.checkedAt,
            type: entry.proceedingType || 'Boletín Judicial',
            summary: entry.heading || entry.extract || `Publicación del expediente ${entry.expedienteNumber}`,
            sourceUrl: entry.sourceUrl,
            bulletinEntryId: saved.id,
          },
        });
      }

      const alertKey = `bulletin:${saved.id}`;
      const alert = await prisma.caseAlert.findUnique({ where: { dedupeKey: alertKey } });
      if (!alert) {
        await prisma.caseAlert.create({
          data: {
            matterId: input.matterId,
            level: 'warning',
            title: `Expediente ${entry.expedienteNumber} localizado en el Boletín Judicial`,
            description: [entry.court, entry.publicationDate ? `publicado el ${entry.publicationDate.toISOString().slice(0, 10)}` : 'fecha no entregada por la fuente', entry.heading || entry.extract].filter(Boolean).join('. '),
            dedupeKey: alertKey,
          },
        });
      }

      await prisma.notification.create({
        data: {
          organizationId: input.access.organizationId,
          userId: input.access.userId || null,
          channel: 'in-app',
          status: 'pending',
          payload: {
            kind: 'judicial_bulletin',
            matterId: input.matterId,
            entryId: saved.id,
            title: `El expediente ${entry.expedienteNumber} apareció en el Boletín Judicial.`,
            sourceUrl: entry.sourceUrl,
          },
        },
      });

      await prisma.auditLog.create({
        data: {
          organizationId: input.access.organizationId,
          userId: input.access.userId || null,
          action: 'bulletin_entry_created',
          entityType: 'JudicialBulletinEntry',
          entityId: saved.id,
          metadata: { sourceId: source.id, matterId: input.matterId, status: result.status } as any,
        },
      });
    }
    if (entry.publicationDate && (!lastPublishedAt || entry.publicationDate > lastPublishedAt)) lastPublishedAt = entry.publicationDate;
  }

  const completedAt = new Date();
  await prisma.bulletinCheckRun.update({
    where: { id: run.id },
    data: {
      completedAt,
      status: result.status,
      query: { ...input.query, ...(result.requestParams ? { requestParams: result.requestParams } : {}) } as any,
      resultsFound: result.results.length,
      newResults,
      errorCode: result.errorCode,
      errorMessage: result.errorMessage ? result.errorMessage.slice(0, 500) : null,
      responseHash: result.responseHash,
      sourceUrl: result.sourceUrl,
      httpStatus: result.httpStatus ?? null,
      durationMs: result.durationMs ?? completedAt.getTime() - startedAt.getTime(),
    },
  });

  await prisma.officialSource.update({
    where: { id: source.id },
    data: {
      lastCheckedAt: completedAt,
      ...(result.status === 'PUBLISHED' || result.status === 'NOT_FOUND_AS_OF'
        ? { lastSuccessAt: completedAt, lastErrorCategory: null }
        : { lastFailureAt: completedAt, lastErrorCategory: result.errorCode || result.status.toLowerCase() }),
    },
  }).catch((error) => console.warn('[bulletin] no se pudo actualizar salud de fuente', source.id, error instanceof Error ? error.message : String(error)));

  await prisma.caseBulletinWatch.updateMany({
    where: input.watchId ? { id: input.watchId } : { matterId: input.matterId, sourceId: source.id, expedienteNumber: input.query.expedienteNumber },
    data: { lastCheckedAt: completedAt, ...(lastPublishedAt ? { lastPublishedAt } : {}) },
  });

  return { runId: run.id, result, newResults };
}

export async function querySource(sourceSlug: string, query: BulletinQuery): Promise<BulletinAdapterResult> {
  const slug = sourceSlug.trim().toLowerCase();
  if (JALISCO_SLUGS.has(slug)) return queryJaliscoBulletin(query);
  if (FEDERAL_SLUGS.has(slug)) return queryFederalBulletin(query);
  return {
    status: 'UNSUPPORTED',
    checkedAt: new Date(),
    sourceUrl: 'https://tjajal.gob.mx/boletines',
    results: [],
    warnings: ['El adaptador para esta fuente aún requiere revisión manual.'],
    responseHash: null,
    errorCode: 'UNSUPPORTED',
  };
}
