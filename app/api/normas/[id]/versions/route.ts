import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const norma = await prisma.norma.findUnique({
    where: { id },
    include: {
      versions: {
        orderBy: { publishedAt: "desc" },
        include: {
          sourceItem: { select: { id: true, title: true, url: true, source: true } },
          diffsTo: { select: { id: true, changedArticles: true, summaryBullets: true, createdAt: true } },
        },
      },
    },
  });

  if (!norma) return NextResponse.json({ ok: false, error: "Norma no encontrada" }, { status: 404 });

  return NextResponse.json({
    ok: true,
    norma: {
      id: norma.id,
      nombre: norma.nombre,
      sigla: norma.sigla,
      fuente: norma.fuente,
      urlBase: norma.urlBase,
    },
    versions: norma.versions.map((version) => ({
      id: version.id,
      publishedAt: version.publishedAt.toISOString(),
      hash: version.hash,
      textPath: version.textPath,
      sourceItem: version.sourceItem,
      diff: version.diffsTo[0]
        ? {
            id: version.diffsTo[0].id,
            changedArticlesCount: Array.isArray(version.diffsTo[0].changedArticles)
              ? version.diffsTo[0].changedArticles.length
              : 0,
            summaryBullets: version.diffsTo[0].summaryBullets,
            createdAt: version.diffsTo[0].createdAt.toISOString(),
          }
        : null,
    })),
  });
}
