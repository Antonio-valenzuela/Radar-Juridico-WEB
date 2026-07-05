import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/security/adminAuth";
import { prisma } from "@/lib/prisma";
import { hybridSearch } from "@/lib/search/hybridSearch";
import { findExcerptAndMatches } from "@/lib/legal-radar";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const adminCheck = requireAdmin(req);
    if (!adminCheck.ok) {
      return adminCheck.response;
    }

    const { searchParams } = new URL(req.url);
    const query = (searchParams.get("q") || searchParams.get("query") || "").trim();

    if (!query) {
      return NextResponse.json({ error: "El parametro 'q' o 'query' es obligatorio." }, { status: 400 });
    }

    const localSearchResults = await hybridSearch({ query, limit: 10 });
    const localItemIds = localSearchResults.map((r: any) => r.item.id);

    const docVersions = await prisma.documentVersion.findMany({
      where: { sourceItemId: { in: localItemIds } },
      select: { sourceItemId: true, rawText: true, updatedAt: true }
    });
    const versionMap = new Map(docVersions.map(v => [v.sourceItemId, v]));

    const normaVersions = await prisma.normaVersion.findMany({
      where: { sourceItemId: { in: localItemIds } },
      include: { diffsTo: true }
    });
    const normaVersionMap = new Map(normaVersions.map(nv => [nv.sourceItemId, nv]));

    const lookbackLimit = new Date();
    lookbackLimit.setDate(lookbackLimit.getDate() - 7);

    const localResults = localSearchResults.map((r: any) => {
      const item = r.item;
      const v = versionMap.get(item.id);
      const nv = normaVersionMap.get(item.id);
      
      const fullText = v?.rawText || item.summary || item.title || "";
      const matchesInfo = findExcerptAndMatches(fullText, query);

      let status: "nuevo" | "modificado" | "sin cambios" | "desconocido" = "sin cambios";
      if (nv) {
        const hasDiffs = nv.diffsTo && nv.diffsTo.length > 0 && nv.diffsTo.some(d => d.fromVersionId !== null);
        if (hasDiffs) {
          status = "modificado";
        } else if (item.published >= lookbackLimit) {
          status = "nuevo";
        }
      } else {
        if (item.published >= lookbackLimit) {
          status = "nuevo";
        }
      }

      return {
        title: item.title,
        source: item.source,
        type: (item.tipo || "documento").toLowerCase(),
        publishedAt: item.published ? new Date(item.published).toISOString() : null,
        lastModifiedAt: v?.updatedAt ? new Date(v.updatedAt).toISOString() : null,
        status,
        matches: matchesInfo.matches,
        excerpt: matchesInfo.excerpt || item.summary || "",
        officialUrl: item.url,
        score: typeof r.score === "number" ? Number(r.score.toFixed(4)) : 0
      };
    }).filter((r: any) => r.matches > 0 || r.score >= 0.35);

    return NextResponse.json({ query, localResults });

  } catch (error: any) {
    console.error("API /api/legal/search error:", error);
    return NextResponse.json(
      { ok: false, error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
