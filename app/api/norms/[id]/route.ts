import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { isOfficialLegalSourceUrl } from '@/lib/legal/officialSourceUrl';
import { requireAdmin } from '@/lib/security/adminAuth';

type RouteContext = { params: Promise<{ id: string }> };

const optionalString = (value: unknown, maxLength: number): string | null => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, maxLength) : null;
};

export async function GET(_request: Request, { params }: RouteContext) {
  try {
    const { id } = await params;
    const norm = await prisma.norma.findUnique({
      where: { id },
      include: {
        versions: {
          orderBy: { verifiedAt: 'desc' },
          include: { articles: { orderBy: { articleNumber: 'asc' } } },
        },
        reforms: { orderBy: { publicationDate: 'desc' } },
        verifications: { orderBy: { checkedAt: 'desc' }, take: 20 },
      },
    });
    if (!norm) {
      return NextResponse.json({ error: 'Norma no encontrada.' }, { status: 404 });
    }
    return NextResponse.json(norm);
  } catch {
    return NextResponse.json(
      { error: 'No fue posible consultar la norma.' },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request, { params }: RouteContext) {
  const auth = requireAdmin(request);
  if (!auth.ok) return auth.response;

  try {
    const { id } = await params;
    const body = (await request.json()) as Record<string, unknown>;
    const urlBase =
      body.urlBase === undefined ? undefined : optionalString(body.urlBase, 2_000);
    if (urlBase && !isOfficialLegalSourceUrl(urlBase)) {
      return NextResponse.json(
        { error: 'La URL debe pertenecer a una fuente oficial permitida.' },
        { status: 400 }
      );
    }

    const norm = await prisma.norma.update({
      where: { id },
      data: {
        ...(body.nombre !== undefined
          ? { nombre: optionalString(body.nombre, 300) || undefined }
          : {}),
        ...(body.sigla !== undefined
          ? { sigla: optionalString(body.sigla, 80) }
          : {}),
        ...(body.fuente !== undefined
          ? { fuente: optionalString(body.fuente, 100) || undefined }
          : {}),
        ...(body.urlBase !== undefined ? { urlBase } : {}),
        ...(body.jurisdiction !== undefined
          ? { jurisdiction: optionalString(body.jurisdiction, 50) || undefined }
          : {}),
        ...(body.matter !== undefined
          ? { matter: optionalString(body.matter, 100) }
          : {}),
        ...(body.practicalUse !== undefined
          ? { practicalUse: optionalString(body.practicalUse, 2_000) }
          : {}),
      },
    });
    return NextResponse.json(norm);
  } catch {
    return NextResponse.json(
      { error: 'No fue posible actualizar la norma.' },
      { status: 500 }
    );
  }
}
