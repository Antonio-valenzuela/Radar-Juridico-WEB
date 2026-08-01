import { NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { isOfficialLegalSourceUrl } from '@/lib/legal/officialSourceUrl';
import { requireAdmin } from '@/lib/security/adminAuth';

const parsePage = (value: string | null, fallback: number, maximum: number) => {
  const parsed = Number.parseInt(value || '', 10);
  if (!Number.isFinite(parsed) || parsed < 0) return fallback;
  return Math.min(parsed, maximum);
};

const optionalString = (value: unknown, maxLength: number): string | null => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, maxLength) : null;
};

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const skip = parsePage(searchParams.get('skip'), 0, 10_000);
    const take = parsePage(searchParams.get('take'), 50, 100) || 50;
    const search = optionalString(searchParams.get('search'), 200);
    const matter = optionalString(searchParams.get('matter'), 100);
    const jurisdiction = optionalString(searchParams.get('jurisdiction'), 50);
    const verificationStatus = optionalString(
      searchParams.get('verificationStatus'),
      50
    );

    const where: Prisma.NormaWhereInput = {
      ...(search
        ? {
            OR: [
              { nombre: { contains: search, mode: 'insensitive' } },
              { sigla: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
      ...(matter ? { matter } : {}),
      ...(jurisdiction ? { jurisdiction } : {}),
      ...(verificationStatus ? { verificationStatus } : {}),
    };

    const [norms, total] = await Promise.all([
      prisma.norma.findMany({
        where,
        skip,
        take,
        orderBy: [{ lastVerifiedAt: 'desc' }, { nombre: 'asc' }],
        include: {
          versions: {
            select: { publishedAt: true },
            orderBy: { publishedAt: 'desc' },
            take: 1,
          },
          _count: {
            select: { versions: true, articles: true, reforms: true },
          },
        },
      }),
      prisma.norma.count({ where }),
    ]);

    return NextResponse.json({ data: norms, meta: { total, skip, take } });
  } catch {
    return NextResponse.json(
      { error: 'No fue posible consultar la biblioteca normativa.' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const auth = requireAdmin(request);
  if (!auth.ok) return auth.response;

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const nombre = optionalString(body.nombre, 300);
    const fuente = optionalString(body.fuente, 100);
    const urlBase = optionalString(body.urlBase, 2_000);
    if (!nombre || !fuente || (urlBase && !isOfficialLegalSourceUrl(urlBase))) {
      return NextResponse.json(
        { error: 'Nombre, fuente y URL oficial válida son requeridos.' },
        { status: 400 }
      );
    }

    const norm = await prisma.norma.create({
      data: {
        nombre,
        fuente,
        sigla: optionalString(body.sigla, 80),
        urlBase,
        jurisdiction: optionalString(body.jurisdiction, 50) || 'MX',
        matter: optionalString(body.matter, 100),
        practicalUse: optionalString(body.practicalUse, 2_000),
        verificationStatus: 'pending',
        monitoringStatus: 'pending',
      },
    });
    return NextResponse.json(norm, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: 'No fue posible registrar la norma.' },
      { status: 500 }
    );
  }
}
