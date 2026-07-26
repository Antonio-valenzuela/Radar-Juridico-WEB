import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { buildJurisprudenciaSearchWhere } from '@/lib/jurisprudencia/validation';

const pageNumber = (value: unknown, fallback: number, maximum: number) =>
  typeof value === 'number' && Number.isInteger(value) && value >= 0
    ? Math.min(value, maximum)
    : fallback;

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const skip = pageNumber(body.skip, 0, 10_000);
    const take = pageNumber(body.take, 50, 100) || 50;
    const where = buildJurisprudenciaSearchWhere(body);

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
      { error: 'No fue posible realizar la búsqueda.' },
      { status: 500 }
    );
  }
}
