import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const startedAt = Date.now();
    const url = new URL(req.url);
    const q = (url.searchParams.get("q") || "").trim();
    const source = (url.searchParams.get("source") || "").trim();
    const impacto = (url.searchParams.get("impacto") || "").trim();
    const tipo = (url.searchParams.get("tipo") || "").trim();
    const tema = (url.searchParams.get("tema") || "").trim();
    const includeNoise = url.searchParams.get("includeNoise") === "true";
    const where: Prisma.ItemWhereInput = {};

    if (source) where.source = source;
    if (impacto) where.impacto = impacto;
    if (tipo) where.tipo = tipo;
    if (tema) where.tema = tema;
    if (!includeNoise) where.category = { not: "ruido" };
    if (q) {
      where.OR = [
        { title: { contains: q, mode: "insensitive" } },
        { summary: { contains: q, mode: "insensitive" } },
      ];
    }

    const items = await prisma.item.findMany({
      where,
      orderBy: { published: "desc" },
      take: 50,
    });
    return NextResponse.json(items, {
      headers: {
        "X-Search-Latency-Ms": String(Date.now() - startedAt),
        "X-Result-Count": String(items.length),
      },
    });
  } catch (err: unknown) {
    console.error("GET /api/items error:", err);
    return NextResponse.json({ error: "Error al obtener items" }, { status: 500 });
  }
}

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
        { error: "El campo 'published' no es una fecha valida" },
        { status: 400 }
      );
    }

    const item = await prisma.item.upsert({
      where: { url },
      update: { source, title, published: publishedDate, summary: summary ?? null },
      create: { source, title, url, published: publishedDate, summary: summary ?? null },
    });

    return NextResponse.json(item);
  } catch (err: unknown) {
    console.error("POST /api/items error:", err);
    return NextResponse.json({ error: "Error al crear/actualizar item" }, { status: 500 });
  }
}
