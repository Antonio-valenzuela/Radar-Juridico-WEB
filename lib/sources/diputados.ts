import { fetchWithRetry } from "@/lib/sources/http";
import type { RawSourceItem, SourceFetchParams, SourceFetchResult, SourceModule } from "@/lib/sources/types";
import { cleanText, parseMxDate, stripHtml } from "@/lib/ingest/normalize";
import * as cheerio from "cheerio";

const INDEX_URL = "https://www.diputados.gob.mx/LeyesBiblio/index.htm";
const BASE_URL = "https://www.diputados.gob.mx/LeyesBiblio/";
const DEFAULT_LIMIT = 20;

export type DiputadosQualityStatus = "valid" | "suspicious";

export type DiputadosTitleAssessment = {
  status: DiputadosQualityStatus;
  reasons: string[];
  matter: string | null;
};

const KNOWN_TITLES: Record<string, string> = {
  "CPEUM.pdf": "Constitución Política de los Estados Unidos Mexicanos",
  "LFT.pdf": "Ley Federal del Trabajo",
  "LISR.pdf": "Ley del Impuesto sobre la Renta",
  "LIVA.pdf": "Ley del Impuesto al Valor Agregado",
  "CFF.pdf": "Código Fiscal de la Federación",
  "CPF.pdf": "Código Penal Federal",
  "CC.pdf": "Código Civil Federal",
  "CCF.pdf": "Código Civil Federal",
  "CCom.pdf": "Código de Comercio",
  "CJM.pdf": "Código de Justicia Militar",
  "CFPC.pdf": "Código Federal de Procedimientos Civiles",
  "CMPP.pdf": "Código Federal de Procedimientos Penales",
  "CNPCF.pdf": "Código Nacional de Procedimientos Civiles y Familiares",
  "CNPP.pdf": "Código Nacional de Procedimientos Penales",
  "LGSM.pdf": "Ley General de Sociedades Mercantiles",
  "LGS.pdf": "Ley General de Salud",
  "LA.pdf": "Ley de Amparo",
  "LAdua.pdf": "Ley Aduanera",
  "LAgra.pdf": "Ley Agraria",
  "LAASSP.pdf": "Ley de Adquisiciones, Arrendamientos y Servicios del Sector Público",
  "LAero.pdf": "Ley de Aeropuertos",
  "LAN.pdf": "Ley de Aguas Nacionales",
  "LACP.pdf": "Ley de Ahorro y Crédito Popular",
  "LAmn.pdf": "Ley de Amnistía",
};

function knownTitleFor(fileName: string) {
  const key = Object.keys(KNOWN_TITLES).find((candidate) => candidate.toLowerCase() === fileName.toLowerCase());
  return key ? KNOWN_TITLES[key] : undefined;
}

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
  const knownTitle = knownTitleFor(fileName);
  if (knownTitle) return knownTitle;
  return fileName
    .replace(/\.pdf$/i, "")
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function matterFromPdf(fileName: string, title: string): string | null {
  const text = `${fileName} ${title}`.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
  if (/CPEUM|CONSTITUCION|AMPARO/.test(text) || /^LA\.PDF$/i.test(fileName)) return "constitucional";
  if (/LFT|TRABAJO|LABORAL/.test(text)) return "laboral";
  if (/ADUAN|COMERCIO EXTERIOR|ARANCEL|IMPORTACION|EXPORTACION/.test(text)) return "aduanal";
  if (/LISR|LIVA|CFF|FISCAL|RENTA|VALOR AGREGADO|IMPUESTO|SAT/.test(text)) return "fiscal";
  if (/CPF|PENAL/.test(text)) return "penal";
  if (/\bCCF\b|\bCC\b|CIVIL/.test(text)) return "civil";
  if (/LGS|SALUD/.test(text)) return "salud";
  if (/LGSM|MERCANTIL|SOCIEDADES|\bCOMERCIO\b/.test(text)) return "mercantil";
  return null;
}

const LEGAL_TITLE_MARKERS = [
  /\bLEY(?:ES)?\b/u,
  /\bC[ÓO]DIGO(?:S)?\b/u,
  /\bCONSTITUCI[ÓO]N\b/u,
  /\bREGLAMENTO(?:S)?\b/u,
  /\bDECRETO(?:S)?\b/u,
  /\bESTATUTO(?:S)?\b/u,
  /\bLINEAMIENTO(?:S)?\b/u,
  /\bNORMA(?:S)?\b/u,
  /\bARANCEL(?:ES)?\b/u,
];

const NON_LEGAL_TITLE_MARKERS = [
  /\bLISTA(?:S)?\b/u,
  /\bDIRECTORIO\b/u,
  /\bSESIONES?\b/u,
  /\bCALENDARIO\b/u,
  /\bCONTACTO\b/u,
  /\bTRANSPARENCIA\b/u,
  /\bMANUAL(?:ES)?\b/u,
  /\bNOTICIA(?:S)?\b/u,
];

/** Evalúa si el enlace parece una norma o sólo navegación del portal. */
export function assessDiputadosTitle(title: string, fileName = ""): DiputadosTitleAssessment {
  const normalizedTitle = cleanText(title);
  const normalized = `${normalizedTitle} ${fileName}`
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase();
  const reasons: string[] = [];
  const hasLegalMarker = LEGAL_TITLE_MARKERS.some((pattern) => pattern.test(normalized));
  const codeLikeFile = /^[CL][A-Z][A-Z0-9]+\.PDF$/u.test(fileName.toUpperCase()) &&
    !NON_LEGAL_TITLE_MARKERS.some((pattern) => pattern.test(normalized));

  if (!normalizedTitle) reasons.push("title_missing");
  if (/^\d+$/u.test(normalizedTitle)) reasons.push("title_numeric");
  if (normalizedTitle.length > 0 && normalizedTitle.length < 5) reasons.push("title_too_short");
  if (/^(PDF|TEXTO|VER|DESCARGAR)$/u.test(normalizedTitle)) reasons.push("title_navigation_label");
  const fileStem = fileName.replace(/\.pdf$/iu, "").replace(/[_-]+/g, " ").trim().toUpperCase();
  if (fileStem && normalizedTitle.toUpperCase() === fileStem) reasons.push("filename_only");
  if (!hasLegalMarker && NON_LEGAL_TITLE_MARKERS.some((pattern) => pattern.test(normalized))) {
    reasons.push("title_noise");
  }
  if (!hasLegalMarker && !codeLikeFile && !knownTitleFor(fileName)) {
    reasons.push("title_not_legal");
  }

  return {
    status: reasons.length === 0 ? "valid" : "suspicious",
    reasons,
    matter: matterFromPdf(fileName, normalizedTitle),
  };
}

function datesFromContext(context: string): { publicationDate: Date | null; lastReformDate: Date | null } {
  const cleaned = cleanText(context);
  const tokens = [...cleaned.matchAll(/(?<!\d)\d{1,2}[/-]\d{1,2}[/-]\d{4}(?!\d)/g)]
    .map((match) => parseMxDate(match[0]))
    .filter((date): date is Date => Boolean(date));
  if (tokens.length === 0) return { publicationDate: null, lastReformDate: null };

  const labeledReform = cleaned.match(
    /(?:[ÚU]LTIMA\s+REFORMA|REFORMA)[^\d]*(\d{1,2}[/-]\d{1,2}[/-]\d{4})/i
  );
  if (labeledReform) {
    const lastReformDate = parseMxDate(labeledReform[1]);
    const publicationDate = tokens.find((date) => !lastReformDate || date.getTime() !== lastReformDate.getTime()) || null;
    return { publicationDate, lastReformDate };
  }

  if (tokens.length === 1) return { publicationDate: null, lastReformDate: tokens[0] };
  return { publicationDate: tokens[0], lastReformDate: tokens[tokens.length - 1] };
}

function qualityRawMetadata(
  quality: DiputadosTitleAssessment,
  publicationDate: Date | null,
  lastReformDate: Date | null,
  retrievedAt: Date,
  fileName: string
) {
  return {
    indexUrl: INDEX_URL,
    fileName,
    source: "LeyesBiblio PDF",
    qualityStatus: quality.status === "valid" ? "valid" : "pending_review",
    qualityReasons: quality.reasons,
    publicationDate: publicationDate?.toISOString() || null,
    reformDate: lastReformDate?.toISOString() || null,
    lastReformDate: lastReformDate?.toISOString() || null,
    retrievedAt: retrievedAt.toISOString(),
    dateSource: lastReformDate ? "dof_reform" : publicationDate ? "dof_publication" : "retrieved_at",
  };
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
    const quality = assessDiputadosTitle(title, fileName);
    const dates = datesFromContext($(element).closest("tr").text() || $(element).parent().text());
    const retrievedAt = new Date();
    const published = dates.lastReformDate || dates.publicationDate;
    const datedQuality: DiputadosTitleAssessment = published
      ? quality
      : {
          ...quality,
          status: "suspicious",
          reasons: Array.from(new Set([...quality.reasons, "date_unverified"])),
        };
    const sourceId = fileName.replace(/\.pdf$/i, "");

    items.push({
      source: "DIPUTADOS",
      sourceId,
      title,
      url,
      canonicalUrl: url,
      published,
      publicationDate: dates.publicationDate,
      lastReformDate: dates.lastReformDate,
      tipo: title.toUpperCase().includes("CÓDIGO") || title.toUpperCase().includes("CODIGO") ? "CODIGO" : "LEY",
      tema: datedQuality.matter,
      impacto: ["CPEUM", "LFT", "LISR", "LIVA", "CFF"].includes(sourceId.toUpperCase()) ? "alto" : "medio",
      summary: `Texto vigente en Cámara de Diputados LeyesBiblio: ${title}.`,
      rawRef: sourceId,
      raw: qualityRawMetadata(datedQuality, dates.publicationDate, dates.lastReformDate, retrievedAt, fileName),
      qualityStatus: datedQuality.status,
      qualityReasons: datedQuality.reasons,
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
    const dates = datesFromContext(cells.map(stripHtml).join(" "));
    const published = dates.lastReformDate || dates.publicationDate;

    const sourceId = url.includes("/ref/")
      ? url.split("/ref/")[1].replace(/\.htm.*$/i, "")
      : rawTitle.toLowerCase().replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "");
    const fileName = url.toLowerCase().endsWith(".pdf") ? pdfFileName(url) : "";
    const quality = assessDiputadosTitle(rawTitle, fileName);
    const datedQuality: DiputadosTitleAssessment = published
      ? quality
      : {
          ...quality,
          status: "suspicious",
          reasons: Array.from(new Set([...quality.reasons, "date_unverified"])),
        };
    const retrievedAt = new Date();
    const reformSummary = dates.lastReformDate
      ? dates.lastReformDate.toISOString().slice(0, 10)
      : cleanText(dateText || "");

    items.push({
      source: "DIPUTADOS",
      sourceId,
      title: rawTitle,
      url,
      canonicalUrl: url,
      published,
      publicationDate: dates.publicationDate,
      lastReformDate: dates.lastReformDate,
      tipo: rawTitle.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().includes("CODIGO")
        ? "CODIGO"
        : "LEY",
      impacto: /nueva\s+ley|nueva\s+reforma|nuevas\s+reformas/i.test(stripHtml(nameCell))
        ? "alto"
        : "medio",
      summary: `Texto vigente en LeyesBiblio. Ultima reforma publicada: ${reformSummary}.`,
      rawRef: sourceId,
      raw: {
        ...qualityRawMetadata(datedQuality, dates.publicationDate, dates.lastReformDate, retrievedAt, fileName),
        dateText: cleanText(dateText || ""),
      },
      qualityStatus: datedQuality.status,
      qualityReasons: datedQuality.reasons,
      tema: datedQuality.matter,
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
    (max, item) => item.published && (!max || item.published > max) ? item.published : max,
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
