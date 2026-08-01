import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireCaseAccess } from '@/lib/cases/access';
import { runBulletinCheck } from '@/lib/bulletins/service';

export async function POST(request: Request) {
  const access = await requireCaseAccess(request);
  if (!access.ok) return access.response;
  try {
    const body = (await request.json().catch(() => ({}))) as { maxCases?: number };
    const maxCases = Math.min(Math.max(Number(body.maxCases) || Number(process.env.BULLETIN_MAX_CASES_PER_RUN || 100), 1), 500);
    const watches = await prisma.caseBulletinWatch.findMany({ where: { active: true, matter: { organizationId: access.context.organizationId } }, include: { source: true, matter: { select: { id: true } } }, take: maxCases, orderBy: { lastCheckedAt: 'asc' } });
    const results = [];
    for (const watch of watches) {
      try {
        results.push(await runBulletinCheck({ matterId: watch.matterId, sourceId: watch.sourceId, watchId: watch.id, query: { sourceSlug: watch.source.slug, expedienteNumber: watch.expedienteNumber, expedienteYear: watch.expedienteYear || undefined, matter: watch.matterLabel || undefined, judicialDistrict: watch.judicialDistrict || undefined, court: watch.court || undefined, chamber: watch.chamber || undefined }, access: { organizationId: access.context.organizationId, userId: access.context.userId } }));
      } catch {
        results.push({ status: 'SOURCE_UNAVAILABLE', watchId: watch.id });
      }
    }
    return NextResponse.json({ ok: true, checked: results.length, results });
  } catch (error) {
    console.error('[admin/bulletins/run] database error', error instanceof Error ? error.message : String(error));
    return NextResponse.json({ ok: false, error: 'database_unavailable', message: 'No fue posible ejecutar el monitor.' }, { status: 503 });
  }
}
