import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { compareNormArticles } from '@/lib/norms/versioning';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: RouteContext) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const fromId = searchParams.get('from')?.trim();
    const toId = searchParams.get('to')?.trim();
    if (!fromId || !toId || fromId === toId) {
      return NextResponse.json(
        { error: 'Selecciona dos versiones distintas.' },
        { status: 400 }
      );
    }

    const [from, to] = await Promise.all([
      prisma.normaVersion.findFirst({
        where: { id: fromId, normaId: id },
        include: { articles: true },
      }),
      prisma.normaVersion.findFirst({
        where: { id: toId, normaId: id },
        include: { articles: true },
      }),
    ]);
    if (!from || !to) {
      return NextResponse.json(
        { error: 'Una de las versiones no pertenece a la norma.' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      from: {
        id: from.id,
        versionLabel: from.versionLabel,
        publishedAt: from.publishedAt,
        hash: from.hash,
      },
      to: {
        id: to.id,
        versionLabel: to.versionLabel,
        publishedAt: to.publishedAt,
        hash: to.hash,
      },
      changedArticles: compareNormArticles(from.articles, to.articles),
    });
  } catch {
    return NextResponse.json(
      { error: 'No fue posible comparar las versiones.' },
      { status: 500 }
    );
  }
}
