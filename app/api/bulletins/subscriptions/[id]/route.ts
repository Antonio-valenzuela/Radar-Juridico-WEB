import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireCaseAccess } from '@/lib/cases/access';

export const dynamic = 'force-dynamic';

const updateSubscriptionSchema = z.object({
  sourceId: z.string().optional(),
  expediente: z.string().optional().nullable(),
  actor: z.string().optional().nullable(),
  demandado: z.string().optional().nullable(),
  juzgado: z.string().optional().nullable(),
  abogado: z.string().optional().nullable(),
  keywords: z.union([z.array(z.string()), z.string()]).optional().nullable(),
  frequency: z.enum(['diario', 'cada_6_horas', 'cada_12_horas', 'semanal']).optional(),
  status: z.enum(['active', 'paused', 'error']).optional(),
});

function normalizeKeywords(input?: string[] | string | null): string[] | undefined {
  if (input === undefined) return undefined;
  if (!input) return [];
  if (Array.isArray(input)) return input.map((k) => k.trim()).filter(Boolean);
  return input.split(',').map((k) => k.trim()).filter(Boolean);
}

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
      where: {
        id,
        organizationId: identity.organizationId,
      },
      include: {
        source: true,
        matches: {
          orderBy: { seenAt: 'desc' },
          take: 50,
        },
      },
    });

    if (!subscription) {
      return NextResponse.json(
        { ok: false, error: 'Seguimiento no encontrado.' },
        { status: 404 }
      );
    }

    return NextResponse.json({ ok: true, subscription });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error.message || 'Error al obtener seguimiento.' },
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
    const parsed = updateSubscriptionSchema.parse(body);

    const existing = await prisma.bulletinSubscription.findFirst({
      where: { id, organizationId: identity.organizationId },
    });

    if (!existing) {
      return NextResponse.json(
        { ok: false, error: 'Seguimiento no encontrado.' },
        { status: 404 }
      );
    }

    const updateData: any = {};
    if (parsed.sourceId !== undefined) updateData.sourceId = parsed.sourceId;
    if (parsed.expediente !== undefined) updateData.expediente = parsed.expediente?.trim() || null;
    if (parsed.actor !== undefined) updateData.actor = parsed.actor?.trim() || null;
    if (parsed.demandado !== undefined) updateData.demandado = parsed.demandado?.trim() || null;
    if (parsed.juzgado !== undefined) updateData.juzgado = parsed.juzgado?.trim() || null;
    if (parsed.abogado !== undefined) updateData.abogado = parsed.abogado?.trim() || null;
    if (parsed.frequency !== undefined) updateData.frequency = parsed.frequency;
    if (parsed.status !== undefined) updateData.status = parsed.status;

    const normKw = normalizeKeywords(parsed.keywords);
    if (normKw !== undefined) updateData.keywords = normKw;

    const subscription = await prisma.bulletinSubscription.update({
      where: { id },
      data: updateData,
      include: { source: true },
    });

    return NextResponse.json({ ok: true, subscription });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { ok: false, error: 'Datos no válidos.', details: error.issues },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { ok: false, error: error.message || 'Error al actualizar seguimiento.' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const access = await requireCaseAccess(request);
    const identity = access.ok
      ? { organizationId: access.context.organizationId, userId: access.context.userId }
      : { organizationId: 'org-demo-legal', userId: 'user-demo-legal' };

    const existing = await prisma.bulletinSubscription.findFirst({
      where: { id, organizationId: identity.organizationId },
    });

    if (!existing) {
      return NextResponse.json(
        { ok: false, error: 'Seguimiento no encontrado.' },
        { status: 404 }
      );
    }

    await prisma.bulletinSubscription.delete({
      where: { id },
    });

    return NextResponse.json({ ok: true, message: 'Seguimiento eliminado correctamente.' });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error.message || 'Error al eliminar seguimiento.' },
      { status: 500 }
    );
  }
}
