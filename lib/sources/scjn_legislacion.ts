import { fetchText } from "@/lib/sources/http";
import type { RawSourceItem, SourceFetchParams, SourceFetchResult, SourceModule } from "@/lib/sources/types";
import { cleanText, parseMxDate, stripHtml } from "@/lib/ingest/normalize";

const URL = "https://legislacion.scjn.gob.mx/Buscador/Paginas/wfReformasResultados.aspx?TPub=1";

function slug(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 90);
}

function parseReformas(html: string): RawSourceItem[] {
  const text = stripHtml(html);
  const chunks = text
    .split(/\s+(?=\d{1,2}\s+[A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ\s.,()/-]{6,}\s+Fecha de publicación:)/g)
    .filter((chunk) => /Fecha de publicación:/i.test(chunk));

  const items: RawSourceItem[] = [];
  chunks.forEach((chunk, idx) => {
    const titleMatch = chunk.match(/^\s*(\d{1,2})\s+(.+?)\s+Fecha de publicación:/i);
    const title = cleanText(titleMatch?.[2] || "");
    const dateMatch = chunk.match(/Fecha de publicación:\s*([0-9\/-]+)/i);
    const published = dateMatch ? parseMxDate(dateMatch[1]) : null;
    if (!title || !published) return;

    const category = cleanText(chunk.match(/Categoria:\s*([A-ZÁÉÍÓÚÑ ()]+?)\s+Vigencia:/i)?.[1] || "DECRETO");
    const extract = cleanText(
      chunk.match(/Cuaderno:\s*\d+\s+([\s\S]*?)(?:Visualizar texto completo|Visualizar la cronología|$)/i)?.[1] ||
        ""
    ).slice(0, 1200);
    const sourceId = `${published.toISOString().slice(0, 10)}-${slug(title)}-${idx + 1}`;

    items.push({
      source: "SCJN_LEG",
      sourceId,
      title,
      url: `${URL}#${sourceId}`,
      canonicalUrl: `${URL}#${sourceId}`,
      published,
      summary: extract || `Reforma reciente registrada por el sistema de legislacion de la SCJN.`,
      tipo: category,
      impacto: /CONSTITUCION|CODIGO|LEY|DECRETO/i.test(`${title} ${category}`) ? "alto" : "medio",
      rawRef: sourceId,
      raw: { category, sourceUrl: URL },
    });
  });

  return items;
}

export async function fetchItems(params: SourceFetchParams): Promise<SourceFetchResult> {
  const checkpointDate = params.checkpoint?.lastPublishedAt || null;
  const days = Math.max(1, Math.min(365, params.days || 30));
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const threshold = checkpointDate && checkpointDate > cutoff ? checkpointDate : cutoff;

  const html = await fetchText(URL);
  const all = parseReformas(html);
  const items = all.filter((item) => item.published > threshold);
  const newest = items.reduce<Date | null>(
    (max, item) => (!max || item.published > max ? item.published : max),
    checkpointDate
  );

  return {
    source: "SCJN_LEG",
    ok: true,
    found: items.length,
    items,
    cursor: newest?.toISOString() || params.checkpoint?.cursor || null,
    errors: all.length ? [] : ["No se pudieron parsear reformas recientes SCJN"],
  };
}

export const scjnLegislacionSource: SourceModule = {
  name: "SCJN_LEG",
  priority: 1,
  fetchItems,
};
