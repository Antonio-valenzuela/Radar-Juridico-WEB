// app/api/documents/[id]/changes/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: documentId } = await params;

    if (!documentId) {
      return NextResponse.json(
        { ok: false, error: 'bad_request', message: 'El ID del documento es requerido.' },
        { status: 400 }
      );
    }

    const versions = await prisma.documentVersion.findMany({
      where: { documentId },
      include: { changes: true },
      orderBy: { versionNumber: 'asc' },
    });

    if (versions.length === 0) {
      return NextResponse.json({ ok: true, changes: [] });
    }

    const allChanges = versions.flatMap((v) =>
      v.changes.map((change) => ({
        type: change.changeType,
        before: change.before,
        after: change.after,
        summary: change.changeDescription,
        extractedPlazoDias: change.extractedPlazoDias,
        extractedPorcentaje: change.extractedPorcentaje,
        date: change.createdAt.toISOString().slice(0, 10),
      }))
    );

    return NextResponse.json({ ok: true, changes: allChanges });
  } catch (error: any) {
    console.error('[api/documents/changes] GET error:', error);
    return NextResponse.json(
      { ok: false, error: 'server_error', message: 'Error interno al obtener los cambios del documento.' },
      { status: 500 }
    );
  }
}
