import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { runSourceIngest } from "@/lib/ingest/runIngest";
import { requireAdmin } from "@/lib/security/adminAuth";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * GET /api/ingest/scjn-reformas?days=30
 *
 * Ingests SCJN comunicados for the last N days, then returns only
 * those classified as high/medium impact (reforms, new laws, etc.).
 *
 * Note: The SCJN does not publish a formal "reformas" API.
 * This endpoint uses the existing SCJN comunicados scraper and filters
 * for items with impacto=alto or tipo in [DECRETO, LEY, REGLAMENTO].
 */
export async function POST(req: NextRequest) {
  const auth = requireAdmin(req);
  if (!auth.ok) return auth.response;
  try {
    const days = parseInt(req.nextUrl.searchParams.get("days") || "30");

    const ingestResult = await runSourceIngest("SCJN_LEG", { days });

    // Fetch the reform-relevant items from the DB (recently saved SCJN items)
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);

    const reformas = await prisma.item.findMany({
      where: {
        source: "SCJN_LEG",
        published: { gte: cutoff },
        OR: [
          { impacto: "alto" },
          { impacto: "medio" },
          { tipo: { in: ["DECRETO", "LEY", "REGLAMENTO", "ACUERDO"] } },
        ],
      },
      orderBy: { published: "desc" },
      take: 50,
      select: { id: true, title: true, url: true, published: true, impacto: true, tipo: true, tema: true },
    });

    return NextResponse.json({
      ok: ingestResult.ok,
      ingest: { saved: ingestResult.saved, found: ingestResult.found },
      reformas: reformas.map((r) => ({ ...r, published: r.published.toISOString() })),
      count: reformas.length,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

