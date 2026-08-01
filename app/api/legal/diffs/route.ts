import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const matter = (searchParams.get("matter") || searchParams.get("materia") || "").trim().toLowerCase();
    const normaFilter = (searchParams.get("norma") || "").trim();
    const limit = Math.min(parseInt(searchParams.get("limit") || "50", 10), 100);

    const diffs = await prisma.normaDiff.findMany({
      where: normaFilter
        ? {
            toVersion: {
              norma: {
                OR: [
                  { id: normaFilter },
                  { sigla: normaFilter },
                  { nombre: normaFilter },
                ],
              },
            },
          }
        : undefined,
      orderBy: { createdAt: "desc" },
      take: limit,
      include: {
        toVersion: {
          include: {
            norma: true,
            sourceItem: {
              select: {
                id: true,
                title: true,
                tema: true,
                impacto: true,
                url: true,
                published: true,
              },
            },
          },
        },
      },
    });

    const mapped = diffs.map((diff) => {
      const norma = diff.toVersion?.norma;
      const item = diff.toVersion?.sourceItem;
      const temas = Array.isArray(item?.tema) && item.tema.length > 0
        ? item.tema
        : (norma?.matter ? [norma.matter.toLowerCase()] : ["general"]);

      return {
        id: diff.id,
        normaId: norma?.id || null,
        normaNombre: norma?.nombre || item?.title || "Reforma Normativa",
        sigla: norma?.sigla || null,
        fuente: norma?.fuente || item?.title || "Oficial",
        temas,
        fechaCambio: diff.createdAt.toISOString(),
        summaryBullets: Array.isArray(diff.summaryBullets) ? diff.summaryBullets : [],
        changedArticles: Array.isArray(diff.changedArticles) ? diff.changedArticles : [],
        executiveSummary: diff.executiveSummary || null,
        practicalImpact: diff.practicalImpact || null,
        recommendedAction: diff.recommendedAction || null,
        url: item?.url || norma?.urlBase || null,
      };
    });

    const filtered = mapped.filter((diff) => {
      const matchesMatter = !matter || diff.temas.some((tema) => tema.toLowerCase() === matter);
      const normalizedNorma = normaFilter.toLowerCase();
      const matchesNorma =
        !normaFilter ||
        diff.normaId?.toLowerCase() === normalizedNorma ||
        diff.sigla?.toLowerCase() === normalizedNorma ||
        diff.normaNombre.toLowerCase() === normalizedNorma;
      return matchesMatter && matchesNorma;
    });

    return NextResponse.json({
      ok: true,
      diffs: filtered,
      count: filtered.length,
    });
  } catch (error: any) {
    console.error("[GET /api/legal/diffs] Error:", error);
    return NextResponse.json(
      { ok: false, error: error.message || "Error al consultar cambios normativos" },
      { status: 500 }
    );
  }
}
