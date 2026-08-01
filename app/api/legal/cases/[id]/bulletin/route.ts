import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireCaseAccess, buildMatterTenantWhere } from '@/lib/cases/access';
import { normalizeBulletinQuery } from '@/lib/bulletins/types';
import { runBulletinCheck } from '@/lib/bulletins/service';

type RouteContext = { params: Promise<{ id: string }> };

async function getMatter(id: string, organizationId: string) {
  return prisma.matter.findFirst({ where: buildMatterTenantWhere(id, { organizationId, userId: '', role: '' }), select: { id: true, organizationId: true } });
}

export async function GET(request: Request, { params }: RouteContext) {
  const access = await requireCaseAccess(request);
  if (!access.ok) return access.response;
  try {
    const { id } = await params;
    const matter = await getMatter(id, access.context.organizationId);
    if (!matter) return NextResponse.json({ ok: false, error: 'case_not_found' }, { status: 404 });

    const [watches, links, history] = await Promise.all([
      prisma.caseBulletinWatch.findMany({ where: { matterId: matter.id }, include: { source: { select: { id: true, name: true, slug: true, baseUrl: true } } }, orderBy: { updatedAt: 'desc' } }),
      prisma.matterBulletinEntry.findMany({
        where: { matterId: matter.id },
        include: {
          bulletinEntry: {
            select: {
              id: true, expedienteNumber: true, expedienteYear: true, matterLabel: true,
              judicialDistrict: true, court: true, chamber: true, bulletinNumber: true,
              publicationDate: true, publicationDateRaw: true, agreementDate: true,
              agreementDateRaw: true, proceedingType: true, heading: true, extract: true,
              sourceUrl: true, contentHash: true, firstSeenAt: true, lastSeenAt: true,
              verificationStatus: true, evidenceKind: true, origin: true,
              source: { select: { name: true, slug: true, baseUrl: true } },
            },
          },
          actuation: { select: { id: true, reviewed: true } },
        },
        orderBy: { lastSeenAt: 'desc' },
        take: 50,
      }),
      prisma.bulletinCheckRun.findMany({
        where: { matterId: matter.id },
        select: {
          id: true, status: true, queryStatus: true, publicationStatus: true,
          startedAt: true, completedAt: true, resultsFound: true, newResults: true,
          errorCode: true, sourceUrl: true,
        },
        orderBy: { startedAt: 'desc' }, take: 20,
      }),
    ]);
    const entries = links.map(({ bulletinEntry, ...link }) => ({
      ...bulletinEntry,
      linkId: link.id,
      reviewed: link.reviewed,
      reviewedAt: link.reviewedAt,
      notes: link.notes,
      firstSeenAt: link.firstSeenAt,
      lastVerifiedAt: link.lastSeenAt,
      actuation: link.actuation,
    }));
    return NextResponse.json({
      ok: true,
      watches,
      entries,
      history,
      lastCheck: history[0] || null,
      nextCheckAt: watches.filter((watch) => watch.active).map((watch) => watch.nextCheckAt).filter(Boolean).sort()[0] || null,
    });
  } catch (error) {
    console.error('[bulletin] database error', error instanceof Error ? error.message : String(error));
    return NextResponse.json({ ok: false, error: 'database_unavailable', message: 'No fue posible consultar el Boletín Judicial.' }, { status: 503 });
  }
}

export async function POST(request: Request, { params }: RouteContext) {
  const access = await requireCaseAccess(request);
  if (!access.ok) return access.response;
  const { id } = await params;
  const matter = await getMatter(id, access.context.organizationId);
  if (!matter) return NextResponse.json({ ok: false, error: 'case_not_found' }, { status: 404 });
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const query = normalizeBulletinQuery((body.query && typeof body.query === 'object' ? body.query : body) as Record<string, unknown>);
    const source = await prisma.officialSource.findFirst({ where: { slug: query.sourceSlug, isActive: true, isOfficial: true }, select: { id: true, name: true, slug: true, baseUrl: true } });
    if (!source) return NextResponse.json({ ok: false, error: 'source_unavailable', message: 'La fuente judicial no está disponible.' }, { status: 503 });
    const watch = await prisma.caseBulletinWatch.findUnique({ where: { matterId_sourceId_expedienteNumber: { matterId: matter.id, sourceId: source.id, expedienteNumber: query.expedienteNumber } } });
    const result = await runBulletinCheck({ matterId: matter.id, sourceId: source.id, watchId: watch?.id, query, access: { organizationId: access.context.organizationId, userId: access.context.userId } });
    return NextResponse.json({
      ok: true,
      status: result.result.status,
      queryStatus: result.result.queryStatus,
      publicationStatus: result.result.publicationStatus,
      checkedAt: result.result.checkedAt.toISOString(),
      source: { name: source.name, url: result.result.sourceUrl },
      results: result.result.results.map(({ raw: _raw, ...entry }) => entry),
      warnings: result.result.warnings,
      runId: result.runId,
      newResults: result.newResults,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    const invalid = message.startsWith('INVALID_QUERY');
    return NextResponse.json({ ok: false, error: invalid ? 'invalid_query' : 'search_failed', message: invalid ? 'Los datos del expediente no son válidos.' : 'No fue posible consultar el Boletín Judicial.' }, { status: invalid ? 400 : 503 });
  }
}
