import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  buildMatterTenantWhere,
  requireCaseAccess,
  scopedChildWhere,
} from '@/lib/cases/access';
import { validateDeadlineCreate } from '@/lib/cases/validation';

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
  const items = await prisma.caseDeadline.findMany({
    where: { matterId: matter.id },
    orderBy: { dueDate: 'asc' },
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
  const validation = validateDeadlineCreate(
    (await request.json()) as Record<string, unknown>
  );
  if (!validation.valid) return NextResponse.json({ error: validation.error }, { status: 400 });
  const item = await prisma.caseDeadline.create({
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
  if (typeof body.deadlineId !== 'string' || typeof body.completed !== 'boolean') {
    return NextResponse.json({ error: 'Plazo y estado inválidos.' }, { status: 400 });
  }
  const updated = await prisma.caseDeadline.updateMany({
    where: scopedChildWhere(body.deadlineId, matter.id),
    data: {
      completed: body.completed,
      completedAt: body.completed ? new Date() : null,
    },
  });
  if (updated.count === 0) return NextResponse.json({ error: 'Plazo no encontrado.' }, { status: 404 });
  return NextResponse.json(
    await prisma.caseDeadline.findUnique({ where: { id: body.deadlineId } })
  );
}

export async function DELETE(request: Request, { params }: RouteContext) {
  const access = await requireCaseAccess(request);
  if (!access.ok) return access.response;
  const { id } = await params;
  const matter = await getMatter(id, access.context.organizationId);
  if (!matter) return NextResponse.json({ error: 'Expediente no encontrado.' }, { status: 404 });
  const body = (await request.json()) as Record<string, unknown>;
  if (typeof body.deadlineId !== 'string') {
    return NextResponse.json({ error: 'Falta deadlineId.' }, { status: 400 });
  }
  const deleted = await prisma.caseDeadline.deleteMany({
    where: scopedChildWhere(body.deadlineId, matter.id),
  });
  if (deleted.count === 0) return NextResponse.json({ error: 'Plazo no encontrado.' }, { status: 404 });
  return new NextResponse(null, { status: 204 });
}
