import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireCaseAccess } from '@/lib/cases/access';

export const dynamic = 'force-dynamic';

/** Genera un slug URL-safe desde un título */
function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .substring(0, 80);
}

const customTemplateSchema = z.object({
  title: z.string().min(1).max(200),
  category: z.string().min(1).max(100),
  slug: z.string().optional(),
  jurisdiction: z.string().optional(),
  practiceArea: z.string().optional(),
  documentType: z.string().min(1).default('machote'),
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
  visibility: z.enum(['PRIVATE', 'ORG', 'PUBLIC']).optional().default('ORG'),
});

export async function GET(request: NextRequest) {
  try {
    const access = await requireCaseAccess(request);
    if (!access.ok) return access.response;

    const { searchParams } = new URL(request.url);
    const q = searchParams.get('q')?.trim();

    const where: any = { organizationId: access.context.organizationId };
    if (q) {
      where.OR = [
        { title: { contains: q, mode: 'insensitive' } },
        { category: { contains: q, mode: 'insensitive' } },
        { description: { contains: q, mode: 'insensitive' } },
        { content: { contains: q, mode: 'insensitive' } },
        { legalBasis: { contains: q, mode: 'insensitive' } },
      ];
    }

    const templates = await prisma.legalTemplate.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        slug: true,
        title: true,
        category: true,
        jurisdiction: true,
        practiceArea: true,
        documentType: true,
        description: true,
        legalBasis: true,
        applicableLaws: true,
        warnings: true,
        disclaimer: true,
        exportFormats: true,
        structureJson: true,
        originalText: true,
        content: true,
        variables: true,
        visibility: true,
        version: true,
        indexed: true,
        indexedAt: true,
        createdBy: true,
        sourceFileName: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({ ok: true, templates });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error.message || 'Error al obtener plantillas.' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const access = await requireCaseAccess(request);
    if (!access.ok) return access.response;

    const body = await request.json();
    const parsed = customTemplateSchema.parse(body);

    // Generar slug en servidor si no viene del cliente
    const baseSlug = parsed.slug?.trim() || slugify(parsed.title);
    // Asegurar unicidad añadiendo sufijo numérico si hay colisión
    let slug = baseSlug;
    const existing = await prisma.legalTemplate.findFirst({
      where: { organizationId: access.context.organizationId, slug },
      select: { id: true },
    });
    if (existing) {
      slug = `${baseSlug}-${Date.now().toString(36)}`;
    }

    const template = await prisma.legalTemplate.create({
      data: {
        organizationId: access.context.organizationId,
        createdBy: access.context.userId,
        title: parsed.title.trim(),
        slug,
        category: parsed.category,
        jurisdiction: parsed.jurisdiction || 'federal',
        practiceArea: parsed.practiceArea || null,
        documentType: parsed.documentType,
        description: parsed.description || null,
        legalBasis: parsed.legalBasis || null,
        applicableLaws: parsed.applicableLaws ?? [],
        warnings: parsed.warnings ?? [],
        disclaimer: parsed.disclaimer || null,
        exportFormats: parsed.exportFormats ?? ['docx', 'pdf', 'text'],
        variables: parsed.variables ?? undefined,
        structureJson: parsed.structureJson ?? undefined,
        originalText: parsed.originalText || parsed.content || null,
        content: parsed.content || parsed.originalText || null,
        aiInstructions: parsed.aiInstructions || null,
        systemPrompt: parsed.systemPrompt || null,
        sourceFileName: parsed.sourceFileName || null,
        visibility: parsed.visibility,
        version: 1,
        indexed: false,
      },
    });

    return NextResponse.json({ ok: true, template }, { status: 201 });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { ok: false, error: 'Datos no válidos para la plantilla.', details: error.issues },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { ok: false, error: error.message || 'Error al crear la plantilla.' },
      { status: 500 }
    );
  }
}
