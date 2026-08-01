import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireCaseAccess } from '@/lib/cases/access';
import { executeSubscriptionCheck } from '@/lib/bulletins/executionService';

export const dynamic = 'force-dynamic';

export async function POST(
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
      include: { source: true },
    });

    if (!subscription) {
      return NextResponse.json(
        { ok: false, error: 'Seguimiento no encontrado.' },
        { status: 404 }
      );
    }

    const runResult = await executeSubscriptionCheck(subscription);

    return NextResponse.json({
      ok: true,
      result: runResult,
      message: `Revisión manual completada. Coincidencias encontradas: ${runResult.newMatches}.`,
    });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error.message || 'Error al ejecutar revisión manual.' },
      { status: 500 }
    );
  }
}
