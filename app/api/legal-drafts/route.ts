import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireCaseAccess } from '@/lib/cases/access';

export const dynamic = 'force-dynamic';

const draftSchema = z.object({
  templateId: z.string().optional().nullable(),
  title: z.string().min(1, 'El título del borrador es requerido'),
  documentType: z.string().default('machote'),
  matter: z.string().optional().nullable(),
  jurisdiction: z.string().optional().nullable(),
  formData: z.any().optional().nullable(),
  renderedText: z.string().optional().nullable(),
  pendingMarkers: z.any().optional().nullable(),
  status: z.enum(['DRAFT', 'IN_REVIEW', 'READY_FOR_PROFESSIONAL_REVIEW', 'ARCHIVED']).default('DRAFT'),
});

export async function GET(request: NextRequest) {
  try {
    const access = await requireCaseAccess(request);
    const identity = access.ok
      ? { organizationId: access.context.organizationId, userId: access.context.userId }
      : { organizationId: 'org-demo-legal', userId: 'user-demo-legal' };

    const drafts = await prisma.legalDraft.findMany({
      where: {
        organizationId: identity.organizationId,
      },
      orderBy: { updatedAt: 'desc' },
    });

    return NextResponse.json({ ok: true, drafts });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error.message || 'Error al obtener borradores.' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const access = await requireCaseAccess(request);
    const identity = access.ok
      ? { organizationId: access.context.organizationId, userId: access.context.userId }
      : { organizationId: 'org-demo-legal', userId: 'user-demo-legal' };

    const body = await request.json();
    const parsed = draftSchema.parse(body);

    const draft = await prisma.legalDraft.create({
      data: {
        organizationId: identity.organizationId,
        userId: identity.userId,
        templateId: parsed.templateId || null,
        title: parsed.title.trim(),
        documentType: parsed.documentType,
        matter: parsed.matter || null,
        jurisdiction: parsed.jurisdiction || 'federal',
        formData: (parsed.formData || {}) as any,
        renderedText: parsed.renderedText || '',
        pendingMarkers: (parsed.pendingMarkers || []) as any,
        status: parsed.status,
      },
    });

    return NextResponse.json({ ok: true, draft }, { status: 201 });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { ok: false, error: 'Datos de borrador no válidos.', details: error.issues },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { ok: false, error: error.message || 'Error al guardar el borrador.' },
      { status: 500 }
    );
  }
}
