import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  buildMatterTenantWhere,
  requireCaseAccess,
  scopedChildWhere,
} from '@/lib/cases/access';
import { validateCaseFileCreate } from '@/lib/cases/validation';

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
  const items = await prisma.caseFile.findMany({
    where: { matterId: matter.id },
    orderBy: { createdAt: 'desc' },
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
  const validation = validateCaseFileCreate(
    (await request.json()) as Record<string, unknown>
  );
  if (!validation.valid) return NextResponse.json({ error: validation.error }, { status: 400 });
  const item = await prisma.caseFile.create({
    data: { ...validation.data, matterId: matter.id },
  });
  return NextResponse.json(item, { status: 201 });
}

export async function DELETE(request: Request, { params }: RouteContext) {
  const access = await requireCaseAccess(request);
  if (!access.ok) return access.response;
  const { id } = await params;
  const matter = await getMatter(id, access.context.organizationId);
  if (!matter) return NextResponse.json({ error: 'Expediente no encontrado.' }, { status: 404 });
  const body = (await request.json()) as Record<string, unknown>;
  if (typeof body.documentId !== 'string') {
    return NextResponse.json({ error: 'Falta documentId.' }, { status: 400 });
  }
  const deleted = await prisma.caseFile.deleteMany({
    where: scopedChildWhere(body.documentId, matter.id),
  });
  if (deleted.count === 0) return NextResponse.json({ error: 'Documento no encontrado.' }, { status: 404 });
  return new NextResponse(null, { status: 204 });
}
