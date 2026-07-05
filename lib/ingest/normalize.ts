import type { RawSourceItem, SourceName } from "@/lib/sources/types";

export type NormalizedItem = {
  source: SourceName;
  sourceId: string;
  title: string;
  url: string;
  canonicalUrl: string;
  published: Date;
  retrievedAt: Date;
  summary: string | null;
  tipo: string | null;
  tema: string | null;
  impacto: "alto" | "medio" | "bajo" | null;
  keywordsHit: string[];
  rawRef: string | null;
  raw: Record<string, unknown> | null;
};

export function normalizeUnicode(value: string) {
  return value.normalize("NFC");
}

export function cleanText(value?: string | null) {
  return normalizeUnicode(value || "")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function stripHtml(html: string) {
  return cleanText(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
  );
}

export function canonicalizeUrl(url: string) {
  const parsed = new URL(url);
  parsed.hash = "";
  parsed.protocol = parsed.protocol.toLowerCase();
  parsed.hostname = parsed.hostname.toLowerCase();
  parsed.searchParams.sort();
  return parsed.toString();
}

export function parseMxDate(raw: string): Date | null {
  const text = cleanText(raw).toLowerCase();
  const numeric = text.match(/(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})/);
  if (numeric) {
    const d = new Date(
      Date.UTC(Number(numeric[3]), Number(numeric[2]) - 1, Number(numeric[1]))
    );
    return Number.isNaN(d.getTime()) ? null : d;
  }

  const spanish = text.match(
    /(\d{1,2})\s+de\s+([a-záéíóúñ]+)\s+(?:de\s+)?(\d{4})/i
  );
  if (!spanish) return null;

  const months: Record<string, number> = {
    enero: 0,
    febrero: 1,
    marzo: 2,
    abril: 3,
    mayo: 4,
    junio: 5,
    julio: 6,
    agosto: 7,
    septiembre: 8,
    octubre: 9,
    noviembre: 10,
    diciembre: 11,
  };
  const month = months[spanish[2].normalize("NFC")];
  if (month === undefined) return null;

  const d = new Date(Date.UTC(Number(spanish[3]), month, Number(spanish[1])));
  return Number.isNaN(d.getTime()) ? null : d;
}

export function toSidofDate(date: Date) {
  const parts = new Intl.DateTimeFormat("es-MX", {
    timeZone: "America/Mexico_City",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).formatToParts(date);
  const day = parts.find((p) => p.type === "day")?.value;
  const month = parts.find((p) => p.type === "month")?.value;
  const year = parts.find((p) => p.type === "year")?.value;
  return `${day}-${month}-${year}`;
}

export function normalizeRawItem(item: RawSourceItem): NormalizedItem {
  const title = cleanText(item.title);
  const summary = item.summary ? cleanText(item.summary).slice(0, 2000) : null;
  const canonicalUrl = canonicalizeUrl(item.canonicalUrl || item.url);

  return {
    source: item.source,
    sourceId: cleanText(item.sourceId),
    title,
    url: item.url,
    canonicalUrl,
    published: item.published,
    retrievedAt: new Date(),
    summary,
    tipo: item.tipo ? cleanText(item.tipo).toUpperCase() : null,
    tema: item.tema ? cleanText(item.tema).toLowerCase() : null,
    impacto: item.impacto || null,
    keywordsHit: item.keywordsHit || [],
    rawRef: item.rawRef || item.sourceId || null,
    raw: item.raw || null,
  };
}
