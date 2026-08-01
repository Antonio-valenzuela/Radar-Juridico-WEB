import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  buildMatterTenantWhere,
  requireCaseAccess,
} from '@/lib/cases/access';

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
        actuations: { orderBy: { date: 'asc' } },
        deadlines: { orderBy: { dueDate: 'asc' } },
        caseFiles: true,
        sourceChecks: { orderBy: { checkedAt: 'asc' } },
        caseAlerts: { orderBy: { createdAt: 'asc' } },
      },
    });
    if (!item) {
      return NextResponse.json(
        { error: 'Expediente no encontrado.' },
        { status: 404 }
      );
    }

    const fileName = `expediente-${item.caseNumber || item.id}.json`.replace(
      /[^a-zA-Z0-9._-]/g,
      '-'
    );
    return new NextResponse(JSON.stringify(item, null, 2), {
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="${fileName}"`,
      },
    });
  } catch {
    return NextResponse.json(
      { error: 'No fue posible exportar el expediente.' },
      { status: 500 }
    );
  }
}
