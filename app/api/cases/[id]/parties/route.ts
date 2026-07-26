import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  buildMatterTenantWhere,
  requireCaseAccess,
  scopedChildWhere,
} from '@/lib/cases/access';
import { validatePartyCreate } from '@/lib/cases/validation';

type RouteContext = { params: Promise<{ id: string }> };

const accessibleMatter = async (id: string, organizationId: string) =>
  prisma.matter.findFirst({
    where: { id, organizationId },
    select: { id: true },
  });

export async function GET(request: Request, { params }: RouteContext) {
  const access = await requireCaseAccess(request);
  if (!access.ok) return access.response;
  const { id } = await params;
  const matter = await accessibleMatter(id, access.context.organizationId);
  if (!matter) return NextResponse.json({ error: 'Expediente no encontrado.' }, { status: 404 });
  const items = await prisma.caseParty.findMany({
    where: { matterId: matter.id },
    orderBy: { createdAt: 'asc' },
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

  const validation = validatePartyCreate(
    (await request.json()) as Record<string, unknown>
  );
  if (!validation.valid) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }
  const item = await prisma.caseParty.create({
    data: { ...validation.data, matterId: matter.id },
  });
  return NextResponse.json(item, { status: 201 });
}

export async function DELETE(request: Request, { params }: RouteContext) {
  const access = await requireCaseAccess(request);
  if (!access.ok) return access.response;
  const { id } = await params;
  const matter = await prisma.matter.findFirst({
    where: buildMatterTenantWhere(id, access.context),
    select: { id: true },
  });
  if (!matter) return NextResponse.json({ error: 'Expediente no encontrado.' }, { status: 404 });

  const body = (await request.json()) as Record<string, unknown>;
  if (typeof body.partyId !== 'string') {
    return NextResponse.json({ error: 'Falta partyId.' }, { status: 400 });
  }
  const deleted = await prisma.caseParty.deleteMany({
    where: scopedChildWhere(body.partyId, matter.id),
  });
  if (deleted.count === 0) {
    return NextResponse.json({ error: 'Parte no encontrada.' }, { status: 404 });
  }
  return new NextResponse(null, { status: 204 });
}
