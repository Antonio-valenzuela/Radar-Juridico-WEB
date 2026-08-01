import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireCaseAccess, buildMatterTenantWhere } from '@/lib/cases/access';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: RouteContext) {
  const access = await requireCaseAccess(request);
  if (!access.ok) return access.response;
  try {
    const { id } = await params;
    const matter = await prisma.matter.findFirst({ where: buildMatterTenantWhere(id, access.context), select: { id: true } });
    if (!matter) return NextResponse.json({ ok: false, error: 'case_not_found' }, { status: 404 });
    const url = new URL(request.url);
    const page = Math.min(Math.max(Number(url.searchParams.get('page') || 1), 1), 100);
    const pageSize = Math.min(Math.max(Number(url.searchParams.get('pageSize') || 20), 1), 50);
    if (!Number.isInteger(page) || !Number.isInteger(pageSize)) return NextResponse.json({ ok: false, error: 'invalid_pagination' }, { status: 400 });
    const where = { matterId: matter.id };
    const [total, history] = await Promise.all([
      prisma.bulletinCheckRun.count({ where }),
      prisma.bulletinCheckRun.findMany({
        where,
        select: {
          id: true, status: true, queryStatus: true, publicationStatus: true,
          startedAt: true, completedAt: true, resultsFound: true, newResults: true,
          errorCode: true, sourceUrl: true, httpStatus: true, durationMs: true,
          source: { select: { name: true, slug: true, baseUrl: true } },
        },
        orderBy: { startedAt: 'desc' }, skip: (page - 1) * pageSize, take: pageSize,
      }),
    ]);
    return NextResponse.json({ ok: true, page, pageSize, total, history });
  } catch (error) {
    console.error('[bulletin-history] database error', error instanceof Error ? error.message : String(error));
    return NextResponse.json({ ok: false, error: 'database_unavailable', message: 'No fue posible consultar el historial.' }, { status: 503 });
  }
}
