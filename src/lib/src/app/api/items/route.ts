import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * GET /api/items
 * Devuelve los últimos 50 items (más recientes primero)
 */
export async function GET() {
  try {
    const items = await prisma.item.findMany({
      orderBy: { published: "desc" },
      take: 50,
    });

    return NextResponse.json(items);
  } catch (err: any) {
    console.error("GET /api/items error:", err);
    return NextResponse.json(
      { error: "Error al obtener items" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/items
 * Crea/actualiza un item basado en url (upsert)
 * Body JSON:
 * {
 *   "source": "DOF",
 *   "title": "....",
 *   "url": "https://....",
 *   "published": "2026-01-24T00:00:00.000Z",
 *   "summary": "..."
 * }
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { source, title, url, published, summary } = body ?? {};

    if (!source || !title || !url || !published) {
      return NextResponse.json(
        { error: "Faltan campos: source, title, url, published" },
        { status: 400 }
      );
    }

    const publishedDate = new Date(published);
    if (Number.isNaN(publishedDate.getTime())) {
      return NextResponse.json(
        { error: "El campo 'published' no es una fecha válida" },
        { status: 400 }
      );
    }

    const item = await prisma.item.upsert({
      where: { url },
      update: {
        source,
        title,
        published: publishedDate,
        summary: summary ?? null,
      },
      create: {
        source,
        title,
        url,
        published: publishedDate,
        summary: summary ?? null,
      },
    });

    return NextResponse.json(item);
  } catch (err: any) {
    console.error("POST /api/items error:", err);
    return NextResponse.json(
      { error: "Error al crear/actualizar item" },
      { status: 500 }
    );
  }
}
