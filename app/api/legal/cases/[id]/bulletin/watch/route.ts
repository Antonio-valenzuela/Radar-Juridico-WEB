import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireCaseAccess, buildMatterTenantWhere } from '@/lib/cases/access';
import { normalizeBulletinQuery } from '@/lib/bulletins/types';
import { z } from 'zod';

type RouteContext = { params: Promise<{ id: string }> };

const watchActionSchema = z.object({
  watchId: z.string().trim().min(1).max(100),
  active: z.boolean().optional(),
}).strict();

export async function POST(request: Request, { params }: RouteContext) {
  const access = await requireCaseAccess(request);
  if (!access.ok) return access.response;
  const { id } = await params;
  const matter = await prisma.matter.findFirst({ where: buildMatterTenantWhere(id, access.context), select: { id: true } });
  if (!matter) return NextResponse.json({ ok: false, error: 'case_not_found' }, { status: 404 });
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const query = normalizeBulletinQuery(Object.fromEntries(
      ['sourceSlug', 'expedienteNumber', 'expedienteYear', 'matter', 'judicialDistrict', 'court', 'chamber']
        .filter((key) => body[key] !== undefined)
        .map((key) => [key, body[key]]),
    ));
    const source = await prisma.officialSource.findFirst({ where: { slug: query.sourceSlug, isActive: true, isOfficial: true }, select: { id: true, name: true, slug: true, baseUrl: true } });
    if (!source) return NextResponse.json({ ok: false, error: 'source_unavailable', message: 'La fuente judicial no está disponible.' }, { status: 503 });
    const watch = await prisma.caseBulletinWatch.upsert({
      where: { matterId_sourceId_expedienteNumber: { matterId: matter.id, sourceId: source.id, expedienteNumber: query.expedienteNumber } },
      update: {
        active: true, expedienteYear: query.expedienteYear, matterLabel: query.matter,
        judicialDistrict: query.judicialDistrict, court: query.court, chamber: query.chamber,
        subjectExternalId: typeof body.subjectExternalId === 'string' ? body.subjectExternalId.slice(0, 120) : undefined,
        districtExternalId: typeof body.districtExternalId === 'string' ? body.districtExternalId.slice(0, 120) : undefined,
        courtExternalId: typeof body.courtExternalId === 'string' ? body.courtExternalId.slice(0, 120) : undefined,
      },
      create: {
        matterId: matter.id, sourceId: source.id, expedienteNumber: query.expedienteNumber,
        expedienteYear: query.expedienteYear, matterLabel: query.matter,
        judicialDistrict: query.judicialDistrict, court: query.court, chamber: query.chamber,
        subjectExternalId: typeof body.subjectExternalId === 'string' ? body.subjectExternalId.slice(0, 120) : undefined,
        districtExternalId: typeof body.districtExternalId === 'string' ? body.districtExternalId.slice(0, 120) : undefined,
        courtExternalId: typeof body.courtExternalId === 'string' ? body.courtExternalId.slice(0, 120) : undefined,
        active: true,
      },
    });
    return NextResponse.json({ ok: true, watch, source: { name: source.name, url: source.baseUrl } }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    return NextResponse.json({ ok: false, error: message.startsWith('INVALID_QUERY') ? 'invalid_query' : 'watch_failed', message: message.startsWith('INVALID_QUERY') ? 'Los datos del expediente no son válidos.' : 'No fue posible activar la vigilancia.' }, { status: message.startsWith('INVALID_QUERY') ? 400 : 503 });
  }
}

export async function PATCH(request: Request, { params }: RouteContext) {
  const access = await requireCaseAccess(request);
  if (!access.ok) return access.response;
  const { id } = await params;
  const matter = await prisma.matter.findFirst({ where: buildMatterTenantWhere(id, access.context), select: { id: true } });
  if (!matter) return NextResponse.json({ ok: false, error: 'case_not_found' }, { status: 404 });
  const parsed = watchActionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: 'invalid_watch', message: 'La vigilancia no es válida.' }, { status: 400 });
  const result = await prisma.caseBulletinWatch.updateMany({
    where: { id: parsed.data.watchId, matterId: matter.id },
    data: { active: parsed.data.active ?? true },
  });
  if (result.count === 0) return NextResponse.json({ ok: false, error: 'watch_not_found' }, { status: 404 });
  return NextResponse.json({ ok: true, watchId: parsed.data.watchId, active: parsed.data.active ?? true });
}

export async function DELETE(request: Request, { params }: RouteContext) {
  const access = await requireCaseAccess(request);
  if (!access.ok) return access.response;
  const { id } = await params;
  const matter = await prisma.matter.findFirst({ where: buildMatterTenantWhere(id, access.context), select: { id: true } });
  if (!matter) return NextResponse.json({ ok: false, error: 'case_not_found' }, { status: 404 });
  const parsed = watchActionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: 'invalid_watch', message: 'Indica la vigilancia que deseas pausar.' }, { status: 400 });
  const result = await prisma.caseBulletinWatch.updateMany({ where: { id: parsed.data.watchId, matterId: matter.id }, data: { active: false } });
  return NextResponse.json({ ok: true, paused: result.count });
}
