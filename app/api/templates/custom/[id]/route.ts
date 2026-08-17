import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireCaseAccess } from '@/lib/cases/access';

export const dynamic = 'force-dynamic';

// Solo campos editables por el abogado — nunca permite sobreescribir organizationId/createdBy/version/indexed
const patchSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  slug: z.string().optional(),
  category: z.string().min(1).max(100).optional(),
  jurisdiction: z.string().optional(),
  practiceArea: z.string().optional(),
  documentType: z.string().optional(),
  description: z.string().optional(),
  legalBasis: z.string().optional(),
  applicableLaws: z.array(z.string()).optional(),
  warnings: z.array(z.string()).optional(),
  disclaimer: z.string().optional(),
  exportFormats: z.array(z.string()).optional(),
  variables: z.record(z.string(), z.any()).optional(),
  structureJson: z.any().optional(),
  originalText: z.string().optional(),
  content: z.string().optional(),
  aiInstructions: z.string().optional(),
  systemPrompt: z.string().optional(),
  sourceFileName: z.string().optional(),
  visibility: z.enum(['PRIVATE', 'ORG', 'PUBLIC']).optional(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const access = await requireCaseAccess(request);
    const orgId = access.ok ? access.context.organizationId : 'demo-legal';

    const template = await prisma.legalTemplate.findFirst({
      where: {
        id,
        OR: [
          { organizationId: orgId },
          { organizationId: 'demo-legal' },
          { visibility: 'PUBLIC' },
        ],
      },
    });

    if (!template) {
      return NextResponse.json({ ok: false, error: 'Plantilla no encontrada.' }, { status: 404 });
    }

    return NextResponse.json({ ok: true, template });
  } catch (error: any) {
    console.error('[templates/custom/[id]] GET Error:', error);
    return NextResponse.json(
      { ok: false, error: 'Error al obtener la plantilla.' },
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
    const orgId = access.ok ? access.context.organizationId : 'demo-legal';

    const existing = await prisma.legalTemplate.findFirst({
      where: {
        id,
        OR: [
          { organizationId: orgId },
          { organizationId: 'demo-legal' },
        ],
      },
      select: { id: true },
    });

    if (!existing) {
      return NextResponse.json({ ok: false, error: 'Plantilla no encontrada.' }, { status: 404 });
    }

    const body = await request.json();
    const parsed = patchSchema.parse(body);

    const updated = await prisma.legalTemplate.update({
      where: { id },
      data: {
        ...parsed,
        version: { increment: 1 },
        updatedAt: new Date(),
        indexed: false,
        indexedAt: null,
        contentHash: null,
      },
    });

    return NextResponse.json({ ok: true, template: updated });
  } catch (error: any) {
    console.error('[templates/custom/[id]] PATCH Error:', error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { ok: false, error: 'Datos no válidos.', details: error.issues },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { ok: false, error: 'Error al actualizar la plantilla.' },
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
    const orgId = access.ok ? access.context.organizationId : 'demo-legal';

    const existing = await prisma.legalTemplate.findFirst({
      where: {
        id,
        OR: [
          { organizationId: orgId },
          { organizationId: 'demo-legal' },
        ],
      },
      select: { id: true },
    });

    if (!existing) {
      return NextResponse.json({ ok: false, error: 'Plantilla no encontrada.' }, { status: 404 });
    }

    await prisma.legalTemplate.delete({
      where: { id },
    });

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error('[templates/custom/[id]] DELETE Error:', error);
    return NextResponse.json(
      { ok: false, error: 'Error al eliminar la plantilla.' },
      { status: 500 }
    );
  }
}
