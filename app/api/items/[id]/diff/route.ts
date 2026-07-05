import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { processItemNormaDiff } from "@/lib/normas/process";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  let item = await prisma.item.findUnique({
    where: { id },
    include: {
      normaVersions: {
        include: {
          norma: true,
          diffsTo: {
            include: {
              fromVersion: { select: { id: true, publishedAt: true, hash: true } },
              toVersion: { select: { id: true, publishedAt: true, hash: true } },
            },
          },
        },
      },
    },
  });

  if (!item) return NextResponse.json({ ok: false, error: "Item no encontrado" }, { status: 404 });

  if (item.normaVersions.length === 0) {
    await processItemNormaDiff(id);
    item = await prisma.item.findUnique({
      where: { id },
      include: {
        normaVersions: {
          include: {
            norma: true,
            diffsTo: {
              include: {
                fromVersion: { select: { id: true, publishedAt: true, hash: true } },
                toVersion: { select: { id: true, publishedAt: true, hash: true } },
              },
            },
          },
        },
      },
    });
  }

  const version = item?.normaVersions[0] || null;
  const diff = version?.diffsTo[0] || null;

  return NextResponse.json({
    ok: Boolean(diff),
    item: {
      id: item?.id,
      title: item?.title,
      source: item?.source,
      published: item?.published.toISOString(),
      url: item?.url,
    },
    norma: version?.norma
      ? {
          id: version.norma.id,
          nombre: version.norma.nombre,
          sigla: version.norma.sigla,
          fuente: version.norma.fuente,
        }
      : null,
    version: version
      ? {
          id: version.id,
          publishedAt: version.publishedAt.toISOString(),
          hash: version.hash,
        }
      : null,
    diff: diff
      ? {
          id: diff.id,
          fromVersionId: diff.fromVersionId,
          toVersionId: diff.toVersionId,
          changedArticles: diff.changedArticles,
          summaryBullets: diff.summaryBullets,
          createdAt: diff.createdAt.toISOString(),
        }
      : null,
  });
}
