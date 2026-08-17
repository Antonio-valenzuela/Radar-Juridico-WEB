import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireCaseAccess } from '@/lib/cases/access';
import { extractPdfTextServer } from '@/lib/pdf/pdfExtractor';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/** Limpia texto extraído de caracteres corruptos o cuadritos */
function sanitizeExtractedText(raw: string): string {
  if (!raw) return '';
  return raw
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uD800-\uDFFF\uFFFD]/g, '')
    .replace(/[□■]+/g, ' ')
    .replace(/\s{3,}/g, ' ')
    .trim();
}

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

const customTemplateJsonSchema = z.object({
  title: z.string().min(1).max(200),
  category: z.string().min(1).max(100).default('General'),
  slug: z.string().optional(),
  jurisdiction: z.string().optional().default('federal'),
  practiceArea: z.string().optional(),
  documentType: z.string().min(1).default('machote'),
  description: z.string().optional(),
  legalBasis: z.string().optional(),
  applicableLaws: z.array(z.string()).optional(),
  warnings: z.array(z.string()).optional(),
  disclaimer: z.string().optional(),
  exportFormats: z.array(z.string()).optional(),
  variables: z.any().optional(),
  structureJson: z.any().optional(),
  originalText: z.string().optional().nullable(),
  content: z.string().optional().nullable(),
  aiInstructions: z.string().optional().nullable(),
  systemPrompt: z.string().optional().nullable(),
  sourceFileName: z.string().optional().nullable(),
  visibility: z.enum(['PRIVATE', 'ORG', 'PUBLIC']).optional().default('ORG'),
});

export async function GET(request: NextRequest) {
  try {
    const access = await requireCaseAccess(request);
    const orgId = access.ok ? access.context.organizationId : 'demo-legal';

    const { searchParams } = new URL(request.url);
    const q = searchParams.get('q')?.trim();

    const where: any = {
      OR: [
        { organizationId: orgId },
        { organizationId: 'demo-legal' },
        { visibility: 'PUBLIC' },
      ],
    };

    if (q) {
      where.AND = [
        {
          OR: [
            { title: { contains: q, mode: 'insensitive' } },
            { category: { contains: q, mode: 'insensitive' } },
            { description: { contains: q, mode: 'insensitive' } },
            { content: { contains: q, mode: 'insensitive' } },
            { legalBasis: { contains: q, mode: 'insensitive' } },
          ],
        },
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

    return NextResponse.json({ ok: true, success: true, templates });
  } catch (error: any) {
    console.error('[templates/custom] GET Error:', error);
    return NextResponse.json(
      { ok: false, success: false, error: 'No fue posible obtener las plantillas.' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    let orgId = 'demo-legal';
    let userId = 'demo-user-1';

    try {
      const access = await requireCaseAccess(request);
      if (access.ok) {
        orgId = access.context.organizationId || 'demo-legal';
        userId = access.context.userId || 'demo-user-1';
      }
    } catch {
      // Fallback seguro a workspace
    }

    const contentType = request.headers.get('content-type') || '';

    // ── MODO 1: SUBIDA CON ARCHIVO FÍSICO (FormData) ─────────────────────────
    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      const file = formData.get('file') as File | null;
      const rawTitle = formData.get('title') as string | null;
      const title = rawTitle?.trim() || file?.name?.replace(/\.[^/.]+$/, '') || 'Machote Oficial';
      const category = (formData.get('category') as string)?.trim() || 'Amparo';
      const legalBasis = (formData.get('legalBasis') as string)?.trim() || null;
      let documentContent = (formData.get('documentContent') as string)?.trim() || '';
      let structureJson: any = null;

      const rawStructure = formData.get('structureJson') as string | null;
      if (rawStructure) {
        try {
          structureJson = JSON.parse(rawStructure);
        } catch { /* noop */ }
      }

      let sourceFileName = file?.name || null;
      let fileUrl: string | null = null;
      let pageCount = 1;

      // 1. Guardar archivo físico en almacenamiento persistente (OBLIGATORIO)
      if (file && file.size > 0) {
        const uploadDir = path.join(process.cwd(), 'data', 'uploads', 'templates');
        if (!fs.existsSync(uploadDir)) {
          fs.mkdirSync(uploadDir, { recursive: true });
        }

        const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
        const savedFileName = `${Date.now()}-${sanitizedName}`;
        const filePath = path.join(uploadDir, savedFileName);

        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        fs.writeFileSync(filePath, buffer);

        fileUrl = `/api/templates/files/${savedFileName}`;

        // 2. Extracción semántica ligera para IA (OPCIONAL - NUNCA ABORTA SI FALLA)
        try {
          const ext = file.name.split('.').pop()?.toLowerCase();
          if (ext === 'pdf') {
            const pdfResult = await extractPdfTextServer(buffer);
            pageCount = pdfResult.numpages || 1;
            const cleaned = sanitizeExtractedText(pdfResult.text || '');
            if (cleaned.length > 20 && !documentContent) {
              documentContent = cleaned;
            }
          }
        } catch (e: any) {
          console.warn('[templates/custom] Extracción auxiliar no bloqueante omitida:', e?.message);
        }

        structureJson = {
          ...(structureJson || {}),
          pageCount,
          fileUrl,
          storage: {
            filePath,
            savedFileName,
            originalFileName: file.name,
            fileSize: file.size,
            mimeType: file.type || 'application/octet-stream',
            uploadedAt: new Date().toISOString(),
          },
        };
      }

      if (!file && !documentContent) {
        return NextResponse.json(
          { ok: false, success: false, error: 'Por favor selecciona un archivo o escribe el contenido del machote.' },
          { status: 400 }
        );
      }

      const baseSlug = slugify(title) || 'machote';
      const slug = `${baseSlug}-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;

      const template = await prisma.legalTemplate.create({
        data: {
          organizationId: orgId,
          createdBy: userId,
          title,
          slug,
          category,
          jurisdiction: 'federal',
          practiceArea: category.toLowerCase(),
          documentType: 'machote',
          description: `Machote oficial (${sourceFileName || 'Documento'})`,
          legalBasis,
          applicableLaws: [],
          warnings: [],
          exportFormats: ['docx', 'pdf', 'text'],
          variables: { QUEJOSO: '', EXPEDIENTE: '', AUTORIDAD: '', FECHA: '' },
          structureJson: structureJson ?? undefined,
          originalText: documentContent || null,
          content: documentContent || null,
          sourceFileName,
          visibility: 'ORG',
          version: 1,
          indexed: false,
        },
      });

      return NextResponse.json(
        {
          ok: true,
          success: true,
          id: template.id,
          filename: sourceFileName,
          pages: pageCount,
          template,
        },
        { status: 201 }
      );
    }

    // ── MODO 2: TEXTO PLANO / JSON ───────────────────────────────────────────
    const body = await request.json();
    const parsed = customTemplateJsonSchema.parse(body);

    const baseSlug = slugify(parsed.title) || 'machote';
    const slug = `${baseSlug}-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;

    const template = await prisma.legalTemplate.create({
      data: {
        organizationId: orgId,
        createdBy: userId,
        title: parsed.title.trim(),
        slug,
        category: parsed.category,
        jurisdiction: parsed.jurisdiction || 'federal',
        practiceArea: parsed.practiceArea || parsed.category.toLowerCase(),
        documentType: parsed.documentType,
        description: parsed.description || `Machote personalizado (${parsed.category})`,
        legalBasis: parsed.legalBasis || null,
        applicableLaws: parsed.applicableLaws ?? [],
        warnings: parsed.warnings ?? [],
        disclaimer: parsed.disclaimer || null,
        exportFormats: parsed.exportFormats ?? ['docx', 'pdf', 'text'],
        variables: parsed.variables ?? undefined,
        structureJson: parsed.structureJson ?? undefined,
        originalText: sanitizeExtractedText(parsed.originalText || parsed.content || '') || null,
        content: sanitizeExtractedText(parsed.content || parsed.originalText || '') || null,
        aiInstructions: parsed.aiInstructions || null,
        systemPrompt: parsed.systemPrompt || null,
        sourceFileName: parsed.sourceFileName || null,
        visibility: parsed.visibility,
        version: 1,
        indexed: false,
      },
    });

    return NextResponse.json(
      {
        ok: true,
        success: true,
        id: template.id,
        filename: parsed.sourceFileName,
        pages: 1,
        template,
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('[templates/custom] POST Error:', error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { ok: false, success: false, error: 'Datos no válidos para la plantilla.', details: error.issues },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { ok: false, success: false, error: 'No fue posible guardar el machote.' },
      { status: 500 }
    );
  }
}
