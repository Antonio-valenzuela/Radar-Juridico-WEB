import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireCaseAccess } from '@/lib/cases/access';

export const dynamic = 'force-dynamic';

const updateDraftSchema = z.object({
  title: z.string().optional(),
  templateId: z.string().optional().nullable(),
  matter: z.string().optional().nullable(),
  jurisdiction: z.string().optional().nullable(),
  formData: z.any().optional().nullable(),
  renderedText: z.string().optional().nullable(),
  pendingMarkers: z.any().optional().nullable(),
  structuredDoc: z.any().optional().nullable(),
  pipelineState: z.any().optional().nullable(),
  sourceDocuments: z.any().optional().nullable(),
  validationResults: z.any().optional().nullable(),
  generationMetadata: z.any().optional().nullable(),
  status: z.enum(['DRAFT', 'IN_REVIEW', 'READY_FOR_PROFESSIONAL_REVIEW', 'ARCHIVED']).optional(),
});

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

    const draft = await prisma.legalDraft.findFirst({
      where: { id, organizationId: identity.organizationId },
    });

    if (!draft) {
      return NextResponse.json({ ok: false, error: 'Borrador no encontrado.' }, { status: 404 });
    }

    return NextResponse.json({ ok: true, draft });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error.message || 'Error al obtener borrador.' },
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
    const parsed = updateDraftSchema.parse(body);

    const existing = await prisma.legalDraft.findFirst({
      where: { id, organizationId: identity.organizationId },
    });

    if (!existing) {
      return NextResponse.json({ ok: false, error: 'Borrador no encontrado.' }, { status: 404 });
    }

    const draft = await prisma.legalDraft.update({
      where: { id },
      data: {
        ...(parsed.title ? { title: parsed.title.trim() } : {}),
        ...(parsed.templateId !== undefined ? { templateId: parsed.templateId } : {}),
        ...(parsed.matter !== undefined ? { matter: parsed.matter } : {}),
        ...(parsed.jurisdiction !== undefined ? { jurisdiction: parsed.jurisdiction } : {}),
        ...(parsed.formData !== undefined ? { formData: parsed.formData as any } : {}),
        ...(parsed.renderedText !== undefined ? { renderedText: parsed.renderedText } : {}),
        ...(parsed.pendingMarkers !== undefined ? { pendingMarkers: parsed.pendingMarkers as any } : {}),
        ...(parsed.structuredDoc !== undefined ? { structuredDoc: parsed.structuredDoc as any } : {}),
        ...(parsed.pipelineState !== undefined ? { pipelineState: parsed.pipelineState as any } : {}),
        ...(parsed.sourceDocuments !== undefined ? { sourceDocuments: parsed.sourceDocuments as any } : {}),
        ...(parsed.validationResults !== undefined ? { validationResults: parsed.validationResults as any } : {}),
        ...(parsed.generationMetadata !== undefined ? { generationMetadata: parsed.generationMetadata as any } : {}),
        ...(parsed.status ? { status: parsed.status } : {}),
      },
    });

    return NextResponse.json({ ok: true, draft });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { ok: false, error: 'Datos no válidos.', details: error.issues },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { ok: false, error: error.message || 'Error al actualizar borrador.' },
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

    const existing = await prisma.legalDraft.findFirst({
      where: { id, organizationId: identity.organizationId },
    });

    if (!existing) {
      return NextResponse.json({ ok: false, error: 'Borrador no encontrado.' }, { status: 404 });
    }

    await prisma.legalDraft.delete({ where: { id } });

    return NextResponse.json({ ok: true, message: 'Borrador eliminado.' });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error.message || 'Error al eliminar borrador.' },
      { status: 500 }
    );
  }
}
