import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  buildMatterTenantWhere,
  requireCaseAccess,
  scopedChildWhere,
} from '@/lib/cases/access';
import { validateActuationCreate } from '@/lib/cases/validation';

type RouteContext = { params: Promise<{ id: string }> };

const getMatter = (id: string, organizationId: string) =>
  prisma.matter.findFirst({
    where: { id, organizationId },
    select: { id: true },
  });

export async function GET(request: Request, { params }: RouteContext) {
  const access = await requireCaseAccess(request);
  if (!access.ok) return access.response;
  const { id } = await params;
  const matter = await getMatter(id, access.context.organizationId);
  if (!matter) return NextResponse.json({ error: 'Expediente no encontrado.' }, { status: 404 });
  const items = await prisma.caseActuation.findMany({
    where: { matterId: matter.id },
    orderBy: { date: 'desc' },
  });
  return NextResponse.json({ data: items });
}

export async function POST(request: Request, { params }: RouteContext) {
  const access = await requireCaseAccess(request);
  if (!access.ok) return access.response;
  const { id } = await params;
  const matter = await prisma.matter.findFirst({
    where: buildMatterTenantWhere(id, access.context),
    select: { id: true },
  });
  if (!matter) return NextResponse.json({ error: 'Expediente no encontrado.' }, { status: 404 });
  const validation = validateActuationCreate(
    (await request.json()) as Record<string, unknown>
  );
  if (!validation.valid) return NextResponse.json({ error: validation.error }, { status: 400 });
  const item = await prisma.caseActuation.create({
    data: { ...validation.data, matterId: matter.id },
  });
  return NextResponse.json(item, { status: 201 });
}

export async function PUT(request: Request, { params }: RouteContext) {
  const access = await requireCaseAccess(request);
  if (!access.ok) return access.response;
  const { id } = await params;
  const matter = await getMatter(id, access.context.organizationId);
  if (!matter) return NextResponse.json({ error: 'Expediente no encontrado.' }, { status: 404 });
  const body = (await request.json()) as Record<string, unknown>;
  if (typeof body.actuationId !== 'string' || typeof body.reviewed !== 'boolean') {
    return NextResponse.json({ error: 'Actuación y estado de revisión inválidos.' }, { status: 400 });
  }
  const updated = await prisma.caseActuation.updateMany({
    where: scopedChildWhere(body.actuationId, matter.id),
    data: {
      reviewed: body.reviewed,
      reviewedAt: body.reviewed ? new Date() : null,
    },
  });
  if (updated.count === 0) return NextResponse.json({ error: 'Actuación no encontrada.' }, { status: 404 });
  return NextResponse.json(
    await prisma.caseActuation.findUnique({ where: { id: body.actuationId } })
  );
}

export async function DELETE(request: Request, { params }: RouteContext) {
  const access = await requireCaseAccess(request);
  if (!access.ok) return access.response;
  const { id } = await params;
  const matter = await getMatter(id, access.context.organizationId);
  if (!matter) return NextResponse.json({ error: 'Expediente no encontrado.' }, { status: 404 });
  const body = (await request.json()) as Record<string, unknown>;
  if (typeof body.actuationId !== 'string') {
    return NextResponse.json({ error: 'Falta actuationId.' }, { status: 400 });
  }
  const deleted = await prisma.caseActuation.deleteMany({
    where: scopedChildWhere(body.actuationId, matter.id),
  });
  if (deleted.count === 0) return NextResponse.json({ error: 'Actuación no encontrada.' }, { status: 404 });
  return new NextResponse(null, { status: 204 });
}
