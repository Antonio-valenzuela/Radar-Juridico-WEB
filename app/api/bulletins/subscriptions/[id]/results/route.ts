import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireCaseAccess } from '@/lib/cases/access';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const access = await requireCaseAccess(request);
    const identity = access.ok
      ? { organizationId: access.context.organizationId, userId: access.context.userId }
      : { organizationId: 'org-demo-legal', userId: 'user-demo-legal' };

    const subscription = await prisma.bulletinSubscription.findFirst({
      where: { id, organizationId: identity.organizationId },
    });

    if (!subscription) {
      return NextResponse.json(
        { ok: false, error: 'Seguimiento no encontrado.' },
        { status: 404 }
      );
    }

    const matches = await prisma.bulletinMatch.findMany({
      where: { subscriptionId: id },
      orderBy: { seenAt: 'desc' },
    });

    return NextResponse.json({ ok: true, matches });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error.message || 'Error al obtener coincidencias.' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const access = await requireCaseAccess(request);
    const identity = access.ok
      ? { organizationId: access.context.organizationId, userId: access.context.userId }
      : { organizationId: 'org-demo-legal', userId: 'user-demo-legal' };
    const body = await request.json();

    const subscription = await prisma.bulletinSubscription.findFirst({
      where: { id, organizationId: identity.organizationId },
    });

    if (!subscription) {
      return NextResponse.json(
        { ok: false, error: 'Seguimiento no encontrado.' },
        { status: 404 }
      );
    }

    const { matchIds, markAll } = body;

    if (markAll) {
      await prisma.bulletinMatch.updateMany({
        where: { subscriptionId: id, reviewed: false },
        data: { reviewed: true, reviewedAt: new Date() },
      });
    } else if (Array.isArray(matchIds) && matchIds.length > 0) {
      await prisma.bulletinMatch.updateMany({
        where: { subscriptionId: id, id: { in: matchIds } },
        data: { reviewed: true, reviewedAt: new Date() },
      });
    }

    const matches = await prisma.bulletinMatch.findMany({
      where: { subscriptionId: id },
      orderBy: { seenAt: 'desc' },
    });

    return NextResponse.json({ ok: true, matches, message: 'Coincidencias actualizadas.' });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error.message || 'Error al actualizar coincidencias.' },
      { status: 500 }
    );
  }
}
