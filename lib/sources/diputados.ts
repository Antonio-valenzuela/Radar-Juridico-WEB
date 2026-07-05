import { fetchWithRetry } from "@/lib/sources/http";
import type { RawSourceItem, SourceFetchParams, SourceFetchResult, SourceModule } from "@/lib/sources/types";
import { cleanText, parseMxDate, stripHtml } from "@/lib/ingest/normalize";
import * as cheerio from "cheerio";

const INDEX_URL = "https://www.diputados.gob.mx/LeyesBiblio/index.htm";
const BASE_URL = "https://www.diputados.gob.mx/LeyesBiblio/";
const DEFAULT_LIMIT = 20;

const KNOWN_TITLES: Record<string, string> = {
  "CPEUM.pdf": "Constitución Política de los Estados Unidos Mexicanos",
  "LFT.pdf": "Ley Federal del Trabajo",
  "LISR.pdf": "Ley del Impuesto sobre la Renta",
  "LIVA.pdf": "Ley del Impuesto al Valor Agregado",
  "CFF.pdf": "Código Fiscal de la Federación",
  "CPF.pdf": "Código Penal Federal",
  "CC.pdf": "Código Civil Federal",
  "CCF.pdf": "Código Civil Federal",
  "LGSM.pdf": "Ley General de Sociedades Mercantiles",
  "LGS.pdf": "Ley General de Salud",
  "LA.pdf": "Ley de Amparo",
};

function absoluteUrl(href: string) {
  return new URL(href.replace(/^\.\//, ""), BASE_URL).toString();
}

function pdfFileName(url: string) {
  return decodeURIComponent(new URL(url).pathname.split("/").pop() || "").trim();
}

function titleFromPdf(fileName: string, linkText: string) {
  if (linkText && linkText.length > 5 && !/^(pdf|texto|ver|descargar)$/i.test(linkText)) {
    return linkText;
  }
  if (KNOWN_TITLES[fileName]) return KNOWN_TITLES[fileName];
  return fileName
    .replace(/\.pdf$/i, "")
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function matterFromPdf(fileName: string, title: string) {
  const text = `${fileName} ${title}`.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
  if (/CPEUM|CONSTITUCION|AMPARO/.test(text) || /^LA\.PDF$/i.test(fileName)) return "constitucional";
  if (/LFT|TRABAJO|LABORAL/.test(text)) return "laboral";
  if (/LISR|LIVA|CFF|FISCAL|RENTA|VALOR AGREGADO|IMPUESTO|SAT/.test(text)) return "fiscal";
  if (/CPF|PENAL/.test(text)) return "penal";
  if (/\bCCF\b|\bCC\b|CIVIL/.test(text)) return "civil";
  if (/LGS|SALUD/.test(text)) return "salud";
  if (/LGSM|MERCANTIL|SOCIEDADES/.test(text)) return "mercantil";
  return "administrativo";
}

export function extractDiputadosPdfItems(html: string, limit = DEFAULT_LIMIT): RawSourceItem[] {
  const $ = cheerio.load(html);
  const seen = new Set<string>();
  const items: RawSourceItem[] = [];
  const hrefSample: string[] = [];

  $("a[href]").each((_, element) => {
    const rawHref = String($(element).attr("href") || "").trim();
    if (!rawHref) return;
    if (hrefSample.length < 20) hrefSample.push(rawHref);

    const isPdf =
      /\/LeyesBiblio\/pdf\//i.test(rawHref) ||
      /^pdf\//i.test(rawHref) ||
      /\.pdf(?:$|[?#])/i.test(rawHref);
    if (!isPdf) return;

    let url: string;
    try {
      url = absoluteUrl(rawHref);
    } catch {
      return;
    }
    if (!/\/LeyesBiblio\/pdf\/[^/]+\.pdf(?:$|[?#])/i.test(url)) return;
    if (seen.has(url)) return;
    seen.add(url);

    const fileName = pdfFileName(url);
    const title = titleFromPdf(fileName, cleanText($(element).text()));
    const tema = matterFromPdf(fileName, title);
    const sourceId = fileName.replace(/\.pdf$/i, "");

    items.push({
      source: "DIPUTADOS",
      sourceId,
      title,
      url,
      canonicalUrl: url,
      published: new Date(),
      tipo: title.toUpperCase().includes("CÓDIGO") || title.toUpperCase().includes("CODIGO") ? "CODIGO" : "LEY",
      tema,
      impacto: ["CPEUM", "LFT", "LISR", "LIVA", "CFF"].includes(sourceId.toUpperCase()) ? "alto" : "medio",
      summary: `Texto vigente en Cámara de Diputados LeyesBiblio: ${title}.`,
      rawRef: sourceId,
      raw: { indexUrl: INDEX_URL, fileName, source: "LeyesBiblio PDF" },
    });
  });

  if (items.length === 0) {
    console.warn("[diputados-ingest] no-pdf-hrefs", { hrefSample });
  }

  return items.slice(0, Math.max(1, limit));
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
  const limit = Math.max(1, Math.min(50, params.limit || DEFAULT_LIMIT));

  const response = await fetchWithRetry(INDEX_URL);
  if (!response.ok) throw new Error(`${INDEX_URL} HTTP ${response.status}`);
  const html = decodeLeyesBiblio(new Uint8Array(await response.arrayBuffer()));
  console.log("[diputados-ingest] html-length", html.length);

  const pdfItems = extractDiputadosPdfItems(html, limit);
  console.log("[diputados-ingest] pdf-hrefs", pdfItems.length, pdfItems.slice(0, 10).map((item) => item.url));

  const all = pdfItems.length ? pdfItems : parseRows(html).slice(0, limit);
  const items = all;
  const newest = items.reduce<Date | null>(
    (max, item) => (!max || item.published > max ? item.published : max),
    params.checkpoint?.lastPublishedAt || null
  );

  return {
    source: "DIPUTADOS",
    ok: items.length > 0,
    found: items.length,
    items,
    cursor: newest?.toISOString() || params.checkpoint?.cursor || null,
    errors: items.length ? [] : ["No se encontraron PDFs en Cámara de Diputados."],
  };
}

export const diputadosSource: SourceModule = {
  name: "DIPUTADOS",
  priority: 1,
  fetchItems,
};
