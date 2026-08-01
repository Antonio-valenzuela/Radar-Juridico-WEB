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
    const history = await prisma.bulletinCheckRun.findMany({ where: { matterId: matter.id }, include: { source: { select: { name: true, slug: true, baseUrl: true } } }, orderBy: { startedAt: 'desc' }, take: 100 });
    return NextResponse.json({ ok: true, history });
  } catch (error) {
    console.error('[bulletin-history] database error', error instanceof Error ? error.message : String(error));
    return NextResponse.json({ ok: false, error: 'database_unavailable', message: 'No fue posible consultar el historial.' }, { status: 503 });
  }
}
