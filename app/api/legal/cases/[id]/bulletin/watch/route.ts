import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireCaseAccess, buildMatterTenantWhere } from '@/lib/cases/access';
import { normalizeBulletinQuery } from '@/lib/bulletins/types';

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: RouteContext) {
  const access = await requireCaseAccess(request);
  if (!access.ok) return access.response;
  const { id } = await params;
  const matter = await prisma.matter.findFirst({ where: buildMatterTenantWhere(id, access.context), select: { id: true } });
  if (!matter) return NextResponse.json({ ok: false, error: 'case_not_found' }, { status: 404 });
  try {
    const query = normalizeBulletinQuery((await request.json()) as Record<string, unknown>);
    const source = await prisma.officialSource.findFirst({ where: { slug: query.sourceSlug, isActive: true, isOfficial: true }, select: { id: true, name: true, slug: true, baseUrl: true } });
    if (!source) return NextResponse.json({ ok: false, error: 'source_unavailable', message: 'La fuente judicial no está disponible.' }, { status: 503 });
    const watch = await prisma.caseBulletinWatch.upsert({
      where: { matterId_sourceId_expedienteNumber: { matterId: matter.id, sourceId: source.id, expedienteNumber: query.expedienteNumber } },
      update: { active: true, expedienteYear: query.expedienteYear, matterLabel: query.matter, judicialDistrict: query.judicialDistrict, court: query.court, chamber: query.chamber },
      create: { matterId: matter.id, sourceId: source.id, expedienteNumber: query.expedienteNumber, expedienteYear: query.expedienteYear, matterLabel: query.matter, judicialDistrict: query.judicialDistrict, court: query.court, chamber: query.chamber, active: true },
    });
    return NextResponse.json({ ok: true, watch, source: { name: source.name, url: source.baseUrl } }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    return NextResponse.json({ ok: false, error: message.startsWith('INVALID_QUERY') ? 'invalid_query' : 'watch_failed', message: message.startsWith('INVALID_QUERY') ? 'Los datos del expediente no son válidos.' : 'No fue posible activar la vigilancia.' }, { status: message.startsWith('INVALID_QUERY') ? 400 : 503 });
  }
}

export async function DELETE(request: Request, { params }: RouteContext) {
  const access = await requireCaseAccess(request);
  if (!access.ok) return access.response;
  const { id } = await params;
  const matter = await prisma.matter.findFirst({ where: buildMatterTenantWhere(id, access.context), select: { id: true } });
  if (!matter) return NextResponse.json({ ok: false, error: 'case_not_found' }, { status: 404 });
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const watchId = typeof body.watchId === 'string' ? body.watchId : null;
  const result = watchId
    ? await prisma.caseBulletinWatch.updateMany({ where: { id: watchId, matterId: matter.id }, data: { active: false } })
    : await prisma.caseBulletinWatch.updateMany({ where: { matterId: matter.id, active: true }, data: { active: false } });
  return NextResponse.json({ ok: true, paused: result.count });
}
