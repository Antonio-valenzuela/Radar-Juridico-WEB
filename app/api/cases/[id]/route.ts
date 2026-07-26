import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  buildMatterTenantWhere,
  requireCaseAccess,
} from '@/lib/cases/access';
import { validateMatterUpdate } from '@/lib/cases/validation';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: RouteContext) {
  const access = await requireCaseAccess(request);
  if (!access.ok) return access.response;

  try {
    const { id } = await params;
    const item = await prisma.matter.findFirst({
      where: buildMatterTenantWhere(id, access.context),
      include: {
        client: true,
        parties: true,
        actuations: { orderBy: { date: 'desc' } },
        deadlines: { orderBy: { dueDate: 'asc' } },
        caseFiles: { orderBy: { createdAt: 'desc' } },
        sourceChecks: { orderBy: { checkedAt: 'desc' } },
        caseAlerts: { orderBy: { createdAt: 'desc' } },
      },
    });
    if (!item) {
      return NextResponse.json(
        { error: 'Expediente no encontrado.' },
        { status: 404 }
      );
    }
    return NextResponse.json(item);
  } catch {
    return NextResponse.json(
      { error: 'No fue posible consultar el expediente.' },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request, { params }: RouteContext) {
  const access = await requireCaseAccess(request);
  if (!access.ok) return access.response;

  try {
    const { id } = await params;
    const body = (await request.json()) as Record<string, unknown>;
    const validation = validateMatterUpdate(body);
    const markReviewed = body.markReviewed === true;
    if (!validation.valid && !markReviewed) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    const updated = await prisma.matter.updateMany({
      where: buildMatterTenantWhere(id, access.context),
      data: {
        ...(validation.valid ? validation.data : {}),
        ...(markReviewed ? { lastReviewedAt: new Date() } : {}),
      },
    });
    if (updated.count === 0) {
      return NextResponse.json(
        { error: 'Expediente no encontrado.' },
        { status: 404 }
      );
    }
    const item = await prisma.matter.findUnique({ where: { id } });
    return NextResponse.json(item);
  } catch {
    return NextResponse.json(
      { error: 'No fue posible actualizar el expediente.' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request, { params }: RouteContext) {
  const access = await requireCaseAccess(request);
  if (!access.ok) return access.response;

  try {
    const { id } = await params;
    const deleted = await prisma.matter.deleteMany({
      where: buildMatterTenantWhere(id, access.context),
    });
    if (deleted.count === 0) {
      return NextResponse.json(
        { error: 'Expediente no encontrado.' },
        { status: 404 }
      );
    }
    return new NextResponse(null, { status: 204 });
  } catch {
    return NextResponse.json(
      { error: 'No fue posible eliminar el expediente.' },
      { status: 500 }
    );
  }
}
