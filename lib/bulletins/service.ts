import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import {
  buildBulletinAlertDedupeKey,
  buildBulletinDedupeKey,
  hashBulletinEntryContent,
} from '@/lib/bulletins/dedupe';
import { buildBulletinEvidence } from '@/lib/bulletins/evidence';
import { queryFederalBulletin } from '@/lib/bulletins/adapters/federal';
import { queryJaliscoBulletin } from '@/lib/bulletins/adapters/jalisco';
import type { BulletinAdapterResult, BulletinQuery } from '@/lib/bulletins/types';
import { queryFailureResult } from '@/lib/bulletins/types';

const JALISCO_SLUGS = new Set(['boletin_judicial_jalisco']);
const FEDERAL_SLUGS = new Set(['boletin_judicial_federal', 'cjf_sise', 'boletin_general_cjf']);

export type BulletinAccessContext = {
  organizationId: string;
  userId?: string | null;
};

function asJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function publicErrorMessage(result: BulletinAdapterResult) {
  if (result.queryStatus === 'AUTH_REQUIRED') return 'La fuente requiere autenticación, CAPTCHA o revisión manual.';
  if (result.queryStatus === 'SOURCE_CHANGED') return 'La fuente oficial cambió y el adaptador requiere revisión.';
  if (result.queryStatus === 'TIMEOUT') return 'La fuente oficial excedió el tiempo de respuesta.';
  if (result.queryStatus === 'RATE_LIMITED') return 'La fuente limitó temporalmente las consultas.';
  if (result.queryStatus === 'SUCCESS') return null;
  return 'No fue posible consultar la fuente oficial.';
}

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
      query: asJson(input.query),
      sourceUrl: source.baseUrl,
    },
  });

  let result: BulletinAdapterResult;
  try {
    result = input.adapterResult || await querySource(source.slug, input.query);
  } catch (error) {
    result = queryFailureResult({
      queryStatus: 'SOURCE_UNAVAILABLE',
      sourceUrl: source.baseUrl,
      warnings: ['No fue posible consultar la fuente oficial.'],
      errorCode: 'SOURCE_UNAVAILABLE',
      errorMessage: error instanceof Error ? error.message : undefined,
    });
  }

  let newResults = 0;
  let lastPublishedAt: Date | null = null;
  const completedAt = new Date();
  const configuredRecheckMinutes = Number(process.env.BULLETIN_MIN_RECHECK_MINUTES || 15);
  const minimumRecheckMinutes = Number.isFinite(configuredRecheckMinutes) && configuredRecheckMinutes >= 1 ? configuredRecheckMinutes : 15;
  const nextCheckAt = new Date(completedAt.getTime() + minimumRecheckMinutes * 60_000);

  try {
    await prisma.$transaction(async (tx) => {
      for (const entry of result.results) {
        if (entry.evidenceKind !== 'bulletin_publication' && entry.evidenceKind !== 'manual_import') continue;
        const contentHash = hashBulletinEntryContent(entry);
        const dedupeKey = buildBulletinDedupeKey({
          provider: source.slug,
          matterId: input.matterId,
          caseNumber: entry.expedienteNumber,
          courtExternalId: entry.court,
          publicationDate: entry.publicationDate,
          agreementDate: entry.agreementDate,
          text: entry.heading || entry.extract || '',
        });
        const evidence = buildBulletinEvidence({
          provider: source.slug,
          sourceUrl: entry.sourceUrl,
          requestParams: result.requestParams,
          checkedAt: result.checkedAt,
          httpStatus: result.httpStatus,
          contentType: result.contentType,
          responseHash: result.responseHash,
          adapterVersion: result.adapterVersion || source.adapter,
          durationMs: result.durationMs,
          queryStatus: result.queryStatus,
          publicationStatus: result.publicationStatus,
          origin: result.origin,
          responseSnapshot: result.responseSnapshot,
          warnings: result.warnings,
        });

        const saved = await tx.judicialBulletinEntry.upsert({
          where: { dedupeKey },
          update: {
            lastSeenAt: result.checkedAt,
            raw: entry.raw === undefined ? undefined : asJson(entry.raw),
            verificationStatus: entry.evidenceKind === 'manual_import' ? 'manual_review' : 'official_source',
            evidence: asJson(evidence),
          },
          create: {
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
            publicationDateRaw: entry.publicationDateRaw,
            agreementDate: entry.agreementDate,
            agreementDateRaw: entry.agreementDateRaw,
            proceedingType: entry.proceedingType,
            heading: entry.heading,
            extract: entry.extract,
            parties: entry.parties ? asJson(entry.parties) : undefined,
            sourceUrl: entry.sourceUrl,
            contentHash,
            dedupeKey,
            raw: entry.raw === undefined ? undefined : asJson(entry.raw),
            verificationStatus: entry.evidenceKind === 'manual_import' ? 'manual_review' : 'official_source',
            evidenceKind: entry.evidenceKind,
            origin: result.origin || 'OFFICIAL_PUBLIC_SOURCE',
            adapterVersion: result.adapterVersion,
            evidence: asJson(evidence),
          },
        });

        const linkInsert = await tx.matterBulletinEntry.createMany({
          data: [{
            matterId: input.matterId,
            bulletinEntryId: saved.id,
            firstSeenAt: result.checkedAt,
            lastSeenAt: result.checkedAt,
          }],
          skipDuplicates: true,
        });
        const link = await tx.matterBulletinEntry.update({
          where: { matterId_bulletinEntryId: { matterId: input.matterId, bulletinEntryId: saved.id } },
          data: { lastSeenAt: result.checkedAt },
        });
        const isNewForMatter = linkInsert.count === 1;

        const alertKey = buildBulletinAlertDedupeKey(input.matterId, saved.id);
        const notificationKey = `notification:${alertKey}`;
        const auditKey = `audit:${alertKey}`;
        if (isNewForMatter) {
          await tx.caseActuation.upsert({
            where: { matterBulletinEntryId: link.id },
            update: {},
            create: {
              matterId: input.matterId,
              date: entry.publicationDate || entry.agreementDate || result.checkedAt,
              type: entry.proceedingType || 'Boletín Judicial',
              summary: [
                'Origen: Boletín Judicial oficial',
                entry.court ? `Juzgado: ${entry.court}` : null,
                entry.heading || entry.extract || `Publicación del expediente ${entry.expedienteNumber}`,
              ].filter(Boolean).join('. '),
              sourceUrl: entry.sourceUrl,
              matterBulletinEntryId: link.id,
            },
          });
          await tx.caseAlert.upsert({
            where: { dedupeKey: alertKey },
            update: {},
            create: {
              matterId: input.matterId,
              level: 'warning',
              title: `Expediente ${entry.expedienteNumber} localizado en el Boletín Judicial`,
              description: [
                entry.court,
                entry.publicationDate ? `publicado el ${entry.publicationDate.toISOString().slice(0, 10)}` : 'fecha no entregada por la fuente',
                entry.heading || entry.extract,
                entry.sourceUrl,
              ].filter(Boolean).join('. '),
              dedupeKey: alertKey,
            },
          });
          await tx.notification.upsert({
            where: { dedupeKey: notificationKey },
            update: {},
            create: {
              organizationId: input.access.organizationId,
              userId: input.access.userId || null,
              channel: 'in-app',
              status: 'pending',
              dedupeKey: notificationKey,
              payload: {
                kind: 'judicial_bulletin', matterId: input.matterId, entryId: saved.id,
                title: `El expediente ${entry.expedienteNumber} apareció en el Boletín Judicial.`,
                court: entry.court, matter: entry.matter, publicationDate: entry.publicationDate,
                heading: entry.heading, extract: entry.extract, sourceUrl: entry.sourceUrl,
                detectedAt: result.checkedAt,
              },
            },
          });
          await tx.auditLog.upsert({
            where: { dedupeKey: auditKey },
            update: {},
            create: {
              organizationId: input.access.organizationId,
              userId: input.access.userId || null,
              action: 'bulletin_entry_created',
              entityType: 'MatterBulletinEntry',
              entityId: link.id,
              dedupeKey: auditKey,
              metadata: { sourceId: source.id, matterId: input.matterId, entryId: saved.id, queryStatus: result.queryStatus },
            },
          });
        }

        if (isNewForMatter) newResults += 1;
        if (entry.publicationDate && (!lastPublishedAt || entry.publicationDate > lastPublishedAt)) lastPublishedAt = entry.publicationDate;
      }

      if (result.queryStatus === 'SUCCESS' && result.results.length > 0) {
        result = {
          ...result,
          status: 'PUBLISHED',
          publicationStatus: newResults > 0 ? 'NEW_PUBLICATIONS' : 'HAS_PREVIOUS_PUBLICATIONS',
        };
      }

      const runEvidence = buildBulletinEvidence({
        provider: source.slug,
        sourceUrl: result.sourceUrl,
        requestParams: result.requestParams,
        checkedAt: result.checkedAt,
        httpStatus: result.httpStatus,
        contentType: result.contentType,
        responseHash: result.responseHash,
        adapterVersion: result.adapterVersion || source.adapter,
        durationMs: result.durationMs ?? completedAt.getTime() - startedAt.getTime(),
        queryStatus: result.queryStatus,
        publicationStatus: result.publicationStatus,
        origin: result.origin,
        responseSnapshot: result.responseSnapshot,
        warnings: result.warnings,
      });

      await tx.bulletinCheckRun.update({
        where: { id: run.id },
        data: {
          completedAt,
          status: result.status,
          queryStatus: result.queryStatus,
          publicationStatus: result.publicationStatus,
          query: asJson({ ...input.query, ...(result.requestParams ? { requestParams: result.requestParams } : {}) }),
          resultsFound: result.results.length,
          newResults,
          errorCode: result.errorCode,
          errorMessage: publicErrorMessage(result),
          responseHash: result.responseHash,
          sourceUrl: result.sourceUrl,
          httpStatus: result.httpStatus ?? null,
          durationMs: result.durationMs ?? completedAt.getTime() - startedAt.getTime(),
          contentType: result.contentType,
          adapterVersion: result.adapterVersion || source.adapter,
          origin: result.origin || 'OFFICIAL_PUBLIC_SOURCE',
          evidence: asJson(runEvidence),
        },
      });

      await tx.officialSource.update({
        where: { id: source.id },
        data: {
          lastCheckedAt: completedAt,
          ...(result.queryStatus === 'SUCCESS'
            ? { lastSuccessAt: completedAt, lastErrorCategory: null }
            : { lastFailureAt: completedAt, lastErrorCategory: result.errorCode || result.queryStatus.toLowerCase() }),
        },
      });

      await tx.caseBulletinWatch.updateMany({
        where: input.watchId
          ? { id: input.watchId }
          : { matterId: input.matterId, sourceId: source.id, expedienteNumber: input.query.expedienteNumber },
        data: {
          lastCheckedAt: completedAt,
          lastQueryStatus: result.queryStatus,
          lastPublicationStatus: result.publicationStatus,
          lastErrorCode: result.queryStatus === 'SUCCESS' ? null : result.errorCode || result.queryStatus,
          lastErrorMessage: publicErrorMessage(result),
          ...(result.queryStatus === 'SUCCESS' ? { lastSuccessfulAt: completedAt } : {}),
          ...(lastPublishedAt ? { lastPublishedAt } : {}),
          nextCheckAt,
        },
      });
    });
  } catch (error) {
    console.error('[bulletin.persist_failed]', {
      runId: run.id,
      sourceId: source.id,
      matterId: input.matterId,
      error: error instanceof Error ? error.message : String(error),
    });
    result = queryFailureResult({
      queryStatus: 'PROVIDER_ERROR',
      sourceUrl: result.sourceUrl,
      errorCode: 'PERSISTENCE_FAILED',
      errorMessage: error instanceof Error ? error.message : undefined,
      warnings: ['La consulta terminó, pero no fue posible guardar sus resultados de forma consistente.'],
    });

    const runEvidence = buildBulletinEvidence({
      provider: source.slug,
      sourceUrl: result.sourceUrl,
      requestParams: result.requestParams,
      checkedAt: result.checkedAt,
      httpStatus: result.httpStatus,
      contentType: result.contentType,
      responseHash: result.responseHash,
      adapterVersion: result.adapterVersion || source.adapter,
      durationMs: result.durationMs ?? completedAt.getTime() - startedAt.getTime(),
      queryStatus: result.queryStatus,
      publicationStatus: result.publicationStatus,
      origin: result.origin,
      responseSnapshot: result.responseSnapshot,
      warnings: result.warnings,
    });

    await prisma.bulletinCheckRun.update({
      where: { id: run.id },
      data: {
        completedAt,
        status: result.status,
        queryStatus: result.queryStatus,
        publicationStatus: result.publicationStatus,
        query: asJson({ ...input.query, ...(result.requestParams ? { requestParams: result.requestParams } : {}) }),
        resultsFound: 0,
        newResults: 0,
        errorCode: result.errorCode,
        errorMessage: publicErrorMessage(result),
        responseHash: result.responseHash,
        sourceUrl: result.sourceUrl,
        httpStatus: result.httpStatus ?? null,
        durationMs: result.durationMs ?? completedAt.getTime() - startedAt.getTime(),
        contentType: result.contentType,
        adapterVersion: result.adapterVersion || source.adapter,
        origin: result.origin || 'OFFICIAL_PUBLIC_SOURCE',
        evidence: asJson(runEvidence),
      },
    }).catch(() => {});

    await prisma.caseBulletinWatch.updateMany({
      where: input.watchId
        ? { id: input.watchId }
        : { matterId: input.matterId, sourceId: source.id, expedienteNumber: input.query.expedienteNumber },
      data: {
        lastCheckedAt: completedAt,
        lastQueryStatus: result.queryStatus,
        lastPublicationStatus: result.publicationStatus,
        lastErrorCode: result.errorCode || result.queryStatus,
        lastErrorMessage: publicErrorMessage(result),
        nextCheckAt,
      },
    }).catch(() => {});
  }

  return { runId: run.id, result, newResults };
}

export async function querySource(sourceSlug: string, query: BulletinQuery): Promise<BulletinAdapterResult> {
  const slug = sourceSlug.trim().toLowerCase();
  if (JALISCO_SLUGS.has(slug)) return queryJaliscoBulletin(query);
  if (FEDERAL_SLUGS.has(slug)) return queryFederalBulletin(query);
  return queryFailureResult({
    queryStatus: 'UNSUPPORTED',
    sourceUrl: 'https://tjajal.gob.mx/boletines',
    warnings: ['El adaptador para esta fuente aún requiere revisión manual.'],
    errorCode: 'UNSUPPORTED',
  });
}
