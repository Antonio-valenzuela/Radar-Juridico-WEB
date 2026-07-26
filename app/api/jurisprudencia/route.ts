import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/security/adminAuth';
import {
  buildJurisprudenciaSearchWhere,
  validateJurisprudenciaDraft,
} from '@/lib/jurisprudencia/validation';

const pageNumber = (value: string | null, fallback: number, maximum: number) => {
  const parsed = Number.parseInt(value || '', 10);
  return Number.isFinite(parsed) && parsed >= 0
    ? Math.min(parsed, maximum)
    : fallback;
};

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const skip = pageNumber(searchParams.get('skip'), 0, 10_000);
    const take = pageNumber(searchParams.get('take'), 50, 100) || 50;
    const where = buildJurisprudenciaSearchWhere({
      keyword: searchParams.get('keyword'),
      materia: searchParams.get('materia') || searchParams.get('matter'),
      registroDigital: searchParams.get('registroDigital'),
      organoEmisor: searchParams.get('organoEmisor'),
      epoca: searchParams.get('epoca') || searchParams.get('epoch'),
      tipoCriterio: searchParams.get('tipoCriterio') || searchParams.get('type'),
      fechaPublicacion: searchParams.get('fechaPublicacion'),
      temaJuridico: searchParams.get('temaJuridico'),
    });

    const [items, total] = await Promise.all([
      prisma.jurisprudencia.findMany({
        where,
        skip,
        take,
        orderBy: [{ publicationDate: 'desc' }, { createdAt: 'desc' }],
        include: {
          precedents: { orderBy: { createdAt: 'asc' } },
          contradictions: { orderBy: { createdAt: 'asc' } },
        },
      }),
      prisma.jurisprudencia.count({ where }),
    ]);

    return NextResponse.json({ data: items, meta: { total, skip, take } });
  } catch {
    return NextResponse.json(
      { error: 'No fue posible consultar los criterios verificados.' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const auth = requireAdmin(request);
  if (!auth.ok) return auth.response;

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const validation = validateJurisprudenciaDraft(body);
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    const item = await prisma.jurisprudencia.create({
      data: validation.data,
    });
    return NextResponse.json(item, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: 'No fue posible registrar el criterio pendiente.' },
      { status: 500 }
    );
  }
}
