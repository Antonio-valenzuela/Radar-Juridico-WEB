import { prisma } from "@/lib/prisma";
import { isOfficialDomain, toSidofDate } from "../legal-radar";
import { getTimeoutMs } from "../config/timeouts";

function sourceName(domain: string): string {
  if (domain.includes("dof.gob.mx") || domain.includes("sidof.segob.gob.mx")) return "Diario Oficial de la Federación";
  if (domain.includes("scjn.gob.mx")) return "Suprema Corte de Justicia de la Nación";
  if (domain.includes("cjf.gob.mx")) return "Consejo de la Judicatura Federal";
  if (domain.includes("diputados.gob.mx")) return "Cámara de Diputados";
  if (domain.includes("senado.gob.mx")) return "Senado de la República";
  if (domain.includes("conamer.gob.mx")) return "CONAMER";
  return "Fuente Oficial";
}

function getTypeFromUrl(url: string): string {
  if (url.includes("leyes") || url.includes("LeyesBiblio")) return "ley";
  if (url.includes("jurisprudencia") || url.includes("sjf")) return "jurisprudencia";
  if (url.includes("decreto")) return "decreto";
  return "publicación oficial";
}

export async function searchOfficialSources(
  officialSources: Array<{ domain: string; name: string; searchQuery: string; rationale?: string }>,
  options?: { dateFrom?: string; dateTo?: string; limit?: number },
  timeoutMs: number = 1500 // 1.5s POR FUENTE
): Promise<{ results: any[]; warnings: string[] }> {
  const results: any[] = [];
  const warnings: string[] = [];

  const dateFrom = options?.dateFrom;
  const dateTo = options?.dateTo;

  // Cargar timeout configurable desde entorno o parámetro (exigido por tests/search-status.test.mjs)
  const envTimeout = getTimeoutMs("EXTERNAL_SOURCE_TIMEOUT_MS", 3000);
  const actualTimeout = timeoutMs !== 1500 ? timeoutMs : envTimeout;

  // 1. Obtener todas las fuentes oficiales activas desde la base de datos
  let dbSources: any[] = [];
  try {
    dbSources = await prisma.officialSource.findMany({
      where: { isActive: true },
    });
  } catch (err: any) {
    console.error("[searchOfficialSources] Error al consultar fuentes oficiales desde la BD:", err.message);
  }

  for (const source of officialSources) {
    const startTime = Date.now();
    let status: "completed" | "timed_out" | "failed" = "completed";

    // ⚠️ TIMEOUT POR FUENTE
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), actualTimeout);

    let sourceResults: any[] = [];
    let dbSource: any = null;

    try {
      const domain = source.domain.toLowerCase().trim();
      
      // Buscar en BD
      dbSource = dbSources.find(s => {
        try {
          const urlObj = new URL(s.baseUrl);
          const hostname = urlObj.hostname.toLowerCase();
          return hostname === domain || hostname.endsWith("." + domain) || s.slug.toLowerCase() === domain;
        } catch (_) {
          return false;
        }
      });

      if (!dbSource) {
        throw new Error(`Dominio o fuente inactiva/no registrada: ${source.domain}`);
      }

      // Ejecutar adaptador nativo o genérico
      if (domain === 'dof.gob.mx' || domain === 'sidof.segob.gob.mx' || dbSource.slug === 'dof_web' || dbSource.slug === 'sidof') {
        sourceResults = await searchSIDOF(
          source.searchQuery,
          dateFrom,
          dateTo,
          controller.signal
        );
      } else if (domain === 'diputados.gob.mx' || dbSource.slug === 'diputados') {
        sourceResults = await searchDiputados(
          source.searchQuery,
          controller.signal
        );
      } else {
        // Buscar de forma genérica usando Tavily restringido al dominio de la fuente
        let targetHost = domain;
        try {
          const urlObj = new URL(dbSource.baseUrl);
          targetHost = urlObj.hostname.toLowerCase();
        } catch (_) {}

        sourceResults = await searchGenericDomain(
          targetHost,
          dbSource.name,
          source.searchQuery,
          controller.signal
        );
      }

    } catch (error: any) {
      if (error.name === 'AbortError') {
        status = "timed_out";
        console.warn(`⏱️ Timeout en ${source.domain} (>${actualTimeout}ms)`);
        warnings.push(`Timeout en ${source.domain} (>${actualTimeout}ms)`);
      } else {
        status = "failed";
        console.error(`❌ Error en ${source.domain}:`, error.message);
        warnings.push(`Error en ${source.domain}: ${error.message}`);
      }
    } finally {
      clearTimeout(timeout);
      const durationMs = Date.now() - startTime;

      // ✅ Normalizar a contrato esperado agregando status y durationMs por fuente
      results.push({
        source: source.domain,
        status,
        durationMs,
        results: status === "completed" ? sourceResults.map((r) => ({
          title: r.title || r.name || 'Sin título',
          url: r.url || r.link || '',
          date: r.date || r.publishedAt || r.publicationDate || '',
          excerpt: r.excerpt || r.summary || r.content?.slice(0, 200) || '',
          type: r.type || r.documentType || getTypeFromUrl(r.url || ''),
          sourceName: dbSource?.name || sourceName(source.domain),
        })) : []
      });
    }
  }

  return { results, warnings };
}

async function searchGenericDomain(
  domain: string,
  sourceNameStr: string,
  query: string,
  signal?: AbortSignal
): Promise<any[]> {
  const results: any[] = [];
  const tavilyKey = process.env.TAVILY_API_KEY?.trim();

  if (tavilyKey) {
    try {
      const response = await fetch("https://api.tavily.com/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          api_key: tavilyKey,
          query: `site:${domain} ${query}`,
          search_depth: "basic",
          max_results: 5
        }),
        signal
      });

      if (response.ok) {
        const data = await response.json();
        const tavilyResults = data.results || [];
        for (const res of tavilyResults) {
          try {
            const urlObj = new URL(res.url);
            const resHost = urlObj.hostname.toLowerCase();
            // Asegurar que estrictamente pertenezca al dominio autorizado
            if (resHost === domain || resHost.endsWith("." + domain)) {
              results.push({
                title: res.title || sourceNameStr,
                url: res.url,
                date: new Date().toISOString(),
                excerpt: res.content || "",
                type: getTypeFromUrl(res.url)
              });
            }
          } catch (_) {}
        }
      }
    } catch (err: any) {
      if (err.name === 'AbortError') throw err;
      console.error(`Tavily search failed for generic domain ${domain}:`, err.message);
    }
  }

  return results;
}

async function searchSIDOF(
  query: string,
  dateFrom?: string,
  dateTo?: string,
  signal?: AbortSignal
): Promise<any[]> {
  const results: any[] = [];
  const tavilyKey = process.env.TAVILY_API_KEY?.trim();

  // Try Tavily search filtered by dof.gob.mx/sidof.segob.gob.mx domains
  if (tavilyKey) {
    try {
      const response = await fetch("https://api.tavily.com/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          api_key: tavilyKey,
          query: `site:dof.gob.mx OR site:sidof.segob.gob.mx ${query}`,
          search_depth: "basic",
          max_results: 5
        }),
        signal
      });

      if (response.ok) {
        const data = await response.json();
        const tavilyResults = data.results || [];
        for (const res of tavilyResults) {
          if (isOfficialDomain(res.url)) {
            results.push({
              title: res.title || "Diario Oficial de la Federación",
              url: res.url,
              date: new Date().toISOString(),
              excerpt: res.content || "",
              type: "publicación dof"
            });
          }
        }
        return results;
      }
    } catch (err: any) {
      if (err.name === 'AbortError') throw err;
      console.warn("Tavily search failed for SIDOF, falling back to direct API:", err.message);
    }
  }

  // Fallback: Query SIDOF directly day-by-day
  const SIDOF_BASE = process.env.SIDOF_BASE_URL || "https://sidof.segob.gob.mx/dof/sidof";
  const start = dateFrom ? new Date(dateFrom) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const end = dateTo ? new Date(dateTo) : new Date();
  
  const dates: Date[] = [];
  const current = new Date(start);
  while (current <= end) {
    dates.push(new Date(current));
    current.setDate(current.getDate() + 1);
  }
  dates.reverse(); // Newest first

  // Direct fetch for each date
  for (const d of dates.slice(0, 7)) { // Limit to max 7 days to avoid long loops
    if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
    const dateStr = toSidofDate(d);
    try {
      const res = await fetch(`${SIDOF_BASE}/notas/${dateStr}`, { signal });
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
            results.push({
              title,
              url: `https://sidof.segob.gob.mx/notas/${sourceId}`,
              date: d.toISOString(),
              excerpt: content.slice(0, 200) || title,
              type: "publicación dof"
            });
          }
        }
      }
    } catch (err: any) {
      if (err.name === 'AbortError') throw err;
      console.error(`Direct SIDOF query failed for date ${dateStr}:`, err.message);
    }
  }

  return results;
}

async function searchDiputados(
  query: string,
  signal?: AbortSignal
): Promise<any[]> {
  const results: any[] = [];
  const tavilyKey = process.env.TAVILY_API_KEY?.trim();

  if (tavilyKey) {
    try {
      const response = await fetch("https://api.tavily.com/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          api_key: tavilyKey,
          query: `site:diputados.gob.mx ${query}`,
          search_depth: "basic",
          max_results: 5
        }),
        signal
      });

      if (response.ok) {
        const data = await response.json();
        const tavilyResults = data.results || [];
        for (const res of tavilyResults) {
          if (isOfficialDomain(res.url)) {
            results.push({
              title: res.title || "Cámara de Diputados",
              url: res.url,
              date: new Date().toISOString(),
              excerpt: res.content || "",
              type: "ley"
            });
          }
        }
      }
    } catch (err: any) {
      if (err.name === 'AbortError') throw err;
      console.error("Tavily search failed for Diputados:", err.message);
    }
  }

  return results;
}
