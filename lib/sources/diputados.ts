import { fetchWithRetry } from "@/lib/sources/http";
import type { RawSourceItem, SourceFetchParams, SourceFetchResult, SourceModule } from "@/lib/sources/types";
import { cleanText, parseMxDate, stripHtml } from "@/lib/ingest/normalize";

const INDEX_URL = "https://www.diputados.gob.mx/LeyesBiblio/index.htm";
const BASE_URL = "https://www.diputados.gob.mx/LeyesBiblio/";

function absoluteUrl(href: string) {
  return new URL(href.replace(/^\.\//, ""), BASE_URL).toString();
}

function decodeLeyesBiblio(bytes: Uint8Array) {
  const encodings = ["utf-8", "windows-1252", "latin1"];
  const candidates = encodings.map((encoding) => {
    const text = new TextDecoder(encoding).decode(bytes);
    const badCharacters = (text.match(/\uFFFD|Ã.|Â./g) || []).length;
    const htmlPenalty = /<html|<table|<tr/i.test(text) ? 0 : 1000;
    return { text, score: badCharacters + htmlPenalty };
  });
  candidates.sort((a, b) => a.score - b.score);
  return candidates[0].text;
}

function parseRows(html: string): RawSourceItem[] {
  const rows = [...html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)];
  const items: RawSourceItem[] = [];

  for (const row of rows) {
    const cells = [...row[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((m) => m[1]);
    if (cells.length < 3) continue;

    const nameCell = cells[1] || cells[0] || "";
    const rawTitle = stripHtml(nameCell)
      .replace(/\bNueva(s)?\s+(reforma|ley|declaratoria)[\s\S]*$/i, "")
      .trim();
    if (!rawTitle || rawTitle.length < 8 || /^ley\s*\/?/i.test(rawTitle)) continue;

    const href =
      nameCell.match(/href=["']([^"']*?\/ref\/[^"']+?\.htm[^"']*)["']/i)?.[1] ||
      nameCell.match(/href=["']([^"']+?\.htm[^"']*)["']/i)?.[1] ||
      nameCell.match(/href=["']([^"']+?\.pdf[^"']*)["']/i)?.[1];
    const url = href ? absoluteUrl(href) : INDEX_URL;

    const dateText = cells.map(stripHtml).find((c) => /\bDOF\b.*\d{1,2}[/-]\d{1,2}[/-]\d{4}/i.test(c));
    const published = dateText ? parseMxDate(dateText) : null;
    if (!published) continue;

    const sourceId = url.includes("/ref/")
      ? url.split("/ref/")[1].replace(/\.htm.*$/i, "")
      : rawTitle.toLowerCase().replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "");

    items.push({
      source: "DIPUTADOS",
      sourceId,
      title: rawTitle,
      url,
      canonicalUrl: url,
      published,
      tipo: rawTitle.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().includes("CODIGO")
        ? "CODIGO"
        : "LEY",
      impacto: /nueva\s+ley|nueva\s+reforma|nuevas\s+reformas/i.test(stripHtml(nameCell))
        ? "alto"
        : "medio",
      summary: `Texto vigente en LeyesBiblio. Ultima reforma publicada: ${cleanText(dateText || "")}.`,
      rawRef: sourceId,
      raw: { indexUrl: INDEX_URL, dateText: cleanText(dateText || "") },
    });
  }

  return items;
}

export async function fetchItems(params: SourceFetchParams): Promise<SourceFetchResult> {
  const checkpointDate = params.checkpoint?.lastPublishedAt || null;
  const days = Math.max(1, Math.min(365, params.days || 30));
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const threshold = checkpointDate && checkpointDate > cutoff ? checkpointDate : cutoff;

  const response = await fetchWithRetry(INDEX_URL);
  if (!response.ok) throw new Error(`${INDEX_URL} HTTP ${response.status}`);
  const html = decodeLeyesBiblio(new Uint8Array(await response.arrayBuffer()));
  const all = parseRows(html);
  const items = all.filter((item) => item.published > threshold);
  const newest = items.reduce<Date | null>(
    (max, item) => (!max || item.published > max ? item.published : max),
    checkpointDate
  );

  return {
    source: "DIPUTADOS",
    ok: true,
    found: items.length,
    items,
    cursor: newest?.toISOString() || params.checkpoint?.cursor || null,
    errors: all.length ? [] : ["No se pudieron parsear registros de LeyesBiblio"],
  };
}

export const diputadosSource: SourceModule = {
  name: "DIPUTADOS",
  priority: 1,
  fetchItems,
};
