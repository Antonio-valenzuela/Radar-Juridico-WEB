import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireCaseAccess } from '@/lib/cases/access';

export const dynamic = 'force-dynamic';

const createSubscriptionSchema = z.object({
  sourceId: z.string().min(1, 'La fuente es requerida'),
  expediente: z.string().optional().nullable(),
  actor: z.string().optional().nullable(),
  demandado: z.string().optional().nullable(),
  juzgado: z.string().optional().nullable(),
  abogado: z.string().optional().nullable(),
  keywords: z.union([z.array(z.string()), z.string()]).optional().nullable(),
  frequency: z.enum(['diario', 'cada_6_horas', 'cada_12_horas', 'semanal']).default('diario'),
});

function normalizeKeywords(input?: string[] | string | null): string[] {
  if (!input) return [];
  if (Array.isArray(input)) return input.map((k) => k.trim()).filter(Boolean);
  return input.split(',').map((k) => k.trim()).filter(Boolean);
}

export async function GET(request: NextRequest) {
  try {
    const access = await requireCaseAccess(request);
    const identity = access.ok
      ? { organizationId: access.context.organizationId, userId: access.context.userId }
      : { organizationId: 'org-demo-legal', userId: 'user-demo-legal' };

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');

    const whereClause: any = {
      organizationId: identity.organizationId,
    };
    if (status && ['active', 'paused', 'error'].includes(status)) {
      whereClause.status = status;
    }

    const subscriptions = await prisma.bulletinSubscription.findMany({
      where: whereClause,
      include: {
        source: {
          select: { id: true, name: true, slug: true, jurisdiction: true, state: true },
        },
        _count: {
          select: { matches: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ ok: true, subscriptions });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error.message || 'Error al listar seguimientos de boletín.' },
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
    const parsed = createSubscriptionSchema.parse(body);

    const keywordsArray = normalizeKeywords(parsed.keywords);

    // Verify source exists or resolve fallback source ID
    let sourceId = parsed.sourceId;
    const existingSource = await prisma.officialSource.findFirst({
      where: { OR: [{ id: sourceId }, { slug: sourceId }] },
    });

    if (existingSource) {
      sourceId = existingSource.id;
    } else {
      // Ensure default fallback source exists in DB
      const defaultSource = await prisma.officialSource.upsert({
        where: { slug: 'boletin-jalisco' },
        create: {
          name: 'Boletín Judicial del Estado de Jalisco (CJJ)',
          slug: 'boletin-jalisco',
          baseUrl: 'https://ciudadano.cjj.gob.mx/boletin_judicial/consultar',
          type: 'court',
          jurisdiction: 'Estatal',
          state: 'Jalisco',
        },
        update: {},
      });
      sourceId = defaultSource.id;
    }

    const subscription = await prisma.bulletinSubscription.create({
      data: {
        organizationId: identity.organizationId,
        userId: identity.userId,
        sourceId,
        expediente: parsed.expediente?.trim() || null,
        actor: parsed.actor?.trim() || null,
        demandado: parsed.demandado?.trim() || null,
        juzgado: parsed.juzgado?.trim() || null,
        abogado: parsed.abogado?.trim() || null,
        keywords: keywordsArray,
        frequency: parsed.frequency,
        status: 'active',
        nextRunAt: new Date(),
      },
      include: {
        source: {
          select: { id: true, name: true, slug: true },
        },
      },
    });

    return NextResponse.json({ ok: true, subscription }, { status: 201 });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { ok: false, error: 'Datos de seguimiento no válidos.', details: error.issues },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { ok: false, error: error.message || 'Error al crear seguimiento de boletín.' },
      { status: 500 }
    );
  }
}
