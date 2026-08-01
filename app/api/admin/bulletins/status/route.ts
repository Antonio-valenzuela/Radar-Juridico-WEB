import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireCaseAccess } from '@/lib/cases/access';

export async function GET(request: Request) {
  const access = await requireCaseAccess(request);
  if (!access.ok) return access.response;
  try {
    const [watches, runs, entries] = await Promise.all([
      prisma.caseBulletinWatch.count({ where: { active: true, matter: { organizationId: access.context.organizationId } } }),
      prisma.bulletinCheckRun.findMany({ where: { matter: { organizationId: access.context.organizationId } }, orderBy: { startedAt: 'desc' }, take: 20, include: { source: { select: { name: true, slug: true } } } }),
      prisma.judicialBulletinEntry.count({
        where: { matterLinks: { some: { matter: { organizationId: access.context.organizationId } } } },
      }),
    ]);
    return NextResponse.json({ ok: true, activeWatches: watches, entries, runs });
  } catch (error) {
    console.error('[admin/bulletins/status] database error', error instanceof Error ? error.message : String(error));
    return NextResponse.json({ ok: false, error: 'database_unavailable', message: 'No fue posible consultar el estado del monitor.' }, { status: 503 });
  }
}
