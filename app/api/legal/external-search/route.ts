import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/security/adminAuth";
import { prisma } from "@/lib/prisma";
import {
  findExcerptAndMatches,
  isOfficialDomain,
  getSourceFromUrl,
  getTypeFromUrl,
  toSidofDate
} from "@/lib/legal-radar";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const adminCheck = requireAdmin(req);
    if (!adminCheck.ok) {
      return adminCheck.response;
    }

    let body;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const query = (body.query || body.q || body.keyword || "").trim();

    if (!query) {
      return NextResponse.json({ error: "El parametro 'query', 'q' o 'keyword' es obligatorio." }, { status: 400 });
    }

    let externalResults: any[] = [];
    const externalSourcesQueried: string[] = [];

    const tavilyKey = process.env.TAVILY_API_KEY?.trim();
    if (tavilyKey) {
      console.error("Querying Tavily for external search...");
      externalSourcesQueried.push("Tavily Search");
      try {
        const response = await fetch("https://api.tavily.com/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            api_key: tavilyKey,
            query: `site:dof.gob.mx OR site:scjn.gob.mx OR site:diputados.gob.mx OR site:senado.gob.mx OR site:cjf.gob.mx OR site:conamer.gob.mx ${query}`,
            search_depth: "basic",
            max_results: 10
          })
        });
        if (response.ok) {
          const data = await response.json();
          const results = data.results || [];
          for (const res of results) {
            if (isOfficialDomain(res.url)) {
              externalResults.push({
                title: res.title || "Resultado oficial externo",
                source: getSourceFromUrl(res.url),
                type: getTypeFromUrl(res.url),
                publishedAt: new Date().toISOString(),
                lastModifiedAt: null,
                status: "desconocido",
                matches: 1,
                excerpt: res.content || "",
                officialUrl: res.url,
                score: res.score || 0.5
              });
            }
          }
        }
      } catch (err) {
        console.error("Tavily search failed in external-search route:", err);
      }
    }

    // Fallback directly to SIDOF API
    if (externalResults.length === 0) {
      const SIDOF_BASE = process.env.SIDOF_BASE_URL || "https://sidof.segob.gob.mx/dof/sidof";
      const lookbackDays = Number(process.env.LEGAL_RADAR_LOOKBACK_DAYS) || 7;
      console.error(`Querying SIDOF directly for lookback of ${lookbackDays} days...`);
      externalSourcesQueried.push("Diario Oficial de la Federación (SIDOF API)");
      const today = new Date();

      for (let i = 0; i < lookbackDays; i++) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        const dateStr = toSidofDate(d);
        try {
          const res = await fetch(`${SIDOF_BASE}/notas/${dateStr}`);
          if (res.ok) {
            const list = await res.json();
            const notes = [
              ...((Array.isArray(list.NotasMatutinas) && list.NotasMatutinas) || []),
              ...((Array.isArray(list.NotasVespertinas) && list.NotasVespertinas) || []),
              ...((Array.isArray(list.NotasExtraordinarias) && list.NotasExtraordinarias) || []),
            ] as any[];

            for (const note of notes) {
              const title = note.titulo || note.Titulo || "";
              const content = note.contenidoTxt || note.cadenaContenido || "";
              if (
                title.toLowerCase().includes(query.toLowerCase()) ||
                content.toLowerCase().includes(query.toLowerCase())
              ) {
                const sourceId = note.codNota || "";
                const url = `https://sidof.segob.gob.mx/notas/${sourceId}`;
                const matchesInfo = findExcerptAndMatches(content || title, query);

                externalResults.push({
                  title: title,
                  source: "Diario Oficial de la Federación",
                  type: "publicación dof",
                  publishedAt: d.toISOString(),
                  lastModifiedAt: null,
                  status: "nuevo",
                  matches: matchesInfo.matches || 1,
                  excerpt: matchesInfo.excerpt || title,
                  officialUrl: url,
                  score: 0.8
                });
              }
            }
          }
        } catch (err) {
          console.error(`SIDOF direct fetch failed in route for ${dateStr}:`, err);
        }
      }
    }

    // Cache results in local DB without contaminating main index
    for (const ext of externalResults) {
      try {
        await prisma.item.upsert({
          where: { url: ext.officialUrl },
          update: {},
          create: {
            source: ext.source,
            title: ext.title,
            url: ext.officialUrl,
            published: new Date(ext.publishedAt),
            summary: ext.excerpt,
            category: "external_official",
            raw: {
              ingestionStatus: "pending_review",
              sourceType: "official_external",
              matches: ext.matches,
              excerpt: ext.excerpt
            }
          }
        });
      } catch (dbErr) {
        console.error("Failed to cache external result in database:", dbErr);
      }
    }

    return NextResponse.json({ query, externalResults, debug: { externalSourcesQueried } });

  } catch (error: any) {
    console.error("API /api/legal/external-search error:", error);
    return NextResponse.json(
      { ok: false, error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
