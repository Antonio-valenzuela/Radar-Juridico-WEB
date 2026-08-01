import type { RawSourceItem, SourceFetchParams, SourceFetchResult, SourceModule } from "@/lib/sources/types";
import { cleanText } from "@/lib/ingest/normalize";
import { fetchOfficialUrl } from "@/lib/sources/officialFetch";

const SOURCE = "PERIODICO_OFICIAL_JALISCO";
const API_BASE = "https://apiperiodico.jalisco.gob.mx/api";
const PORTAL_BASE = "https://periodicooficial.jalisco.gob.mx";
const FETCH_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (compatible; JuridicoRadar/1.0; +https://periodicooficial.jalisco.gob.mx)",
  Accept: "application/json,application/pdf,*/*",
};

export type JaliscoPublicationEntry = {
  identifier: string;
  page: number | null;
  title: string;
};

export type JaliscoNewspaperDetail = {
  id: number;
  post_date: string;
  volume: string | null;
  number: string | null;
  description: string;
  section: string | null;
  link: string;
};

type JaliscoNewspaperListEntry = {
  id_newspaper: number;
  date_newspaper: string;
};

type JaliscoApiEnvelope<T> = {
  errors?: boolean | Record<string, unknown>;
  status_code?: number;
  result?: T;
};

type JaliscoFetchDependencies = {
  now?: () => Date;
  fetchOfficial?: typeof fetchOfficialUrl;
  extractPdfPages?: (url: string) => Promise<Record<number, string>>;
};

function identifierFor(title: string, page: number | null, index: number) {
  const publishedIdentifier = title.match(
    /\b(?:DECRETO|ACUERDO)\s+(?:N[ÚU]MERO\s+)?([A-Z0-9]+(?:\/[A-Z0-9.-]+)+|\d+)/i
  )?.[1];

  if (publishedIdentifier) return publishedIdentifier.replace(/\//g, "-");
  return page ? `pagina-${page}-${index + 1}` : `publicacion-${index + 1}`;
}

export function parseJaliscoPublicationEntries(description: string): JaliscoPublicationEntry[] {
  const normalized = cleanText(description);
  if (!normalized) return [];

  const entries: JaliscoPublicationEntry[] = [];
  const pageMarker = /\s+-\s+(?:P[aá]g(?:ina)?\.?\s*)?(\d+)(?=\s+[A-ZÁÉÍÓÚÑ]|$)/giu;
  let cursor = 0;
  let match: RegExpExecArray | null;

  while ((match = pageMarker.exec(normalized))) {
    const title = cleanText(normalized.slice(cursor, match.index));
    const page = Number(match[1]);
    if (title) {
      entries.push({
        identifier: identifierFor(title, page, entries.length),
        page,
        title,
      });
    }
    cursor = pageMarker.lastIndex;
  }

  const trailing = cleanText(normalized.slice(cursor));
  if (trailing) {
    entries.push({
      identifier: identifierFor(trailing, null, entries.length),
      page: null,
      title: trailing,
    });
  }

  return entries.length
    ? entries
    : [{ identifier: "publicacion-1", page: null, title: normalized }];
}

function normaOverrideFor(title: string, pdfUrl: string) {
  if (/c[oó]digo civil del estado de jalisco/i.test(title)) {
    return {
      nombre: "Codigo Civil del Estado de Jalisco",
      sigla: "CCJAL",
      fuente: SOURCE,
      urlBase: pdfUrl,
    };
  }

  if (/c[oó]digo penal (?:para el estado libre y soberano de jalisco|del estado de jalisco)/i.test(title)) {
    return {
      nombre: "Codigo Penal para el Estado Libre y Soberano de Jalisco",
      sigla: "CPJAL",
      fuente: SOURCE,
      urlBase: pdfUrl,
    };
  }

  return undefined;
}

function textForEntry(
  entry: JaliscoPublicationEntry,
  nextEntry: JaliscoPublicationEntry | undefined,
  pages: Record<number, string>
) {
  if (!entry.page) return "";
  const endPage = nextEntry?.page && nextEntry.page > entry.page
    ? nextEntry.page
    : Math.max(entry.page + 1, ...Object.keys(pages).map(Number).filter(Number.isFinite).map((page) => page + 1));

  const text: string[] = [];
  for (let page = entry.page; page < endPage; page++) {
    if (pages[page]) text.push(pages[page]);
  }
  return cleanText(text.join("\n"));
}

export function buildJaliscoItemsFromDetail(
  detail: JaliscoNewspaperDetail,
  pages: Record<number, string> = {}
): RawSourceItem[] {
  const entries = parseJaliscoPublicationEntries(detail.description);
  const published = new Date(`${detail.post_date}T12:00:00-06:00`);
  const issueLabel = [
    `Periódico Oficial "El Estado de Jalisco"`,
    detail.number ? `No. ${detail.number}` : null,
    detail.section ? `Sección ${detail.section}` : null,
    detail.volume ? `Tomo ${detail.volume}` : null,
  ].filter(Boolean).join(", ");

  return entries.map((entry, index) => {
    const sourceId = `${detail.id}:${entry.identifier}`;
    const separator = detail.link.includes("?") ? "&" : "?";
    const itemUrl = `${detail.link}${separator}item=${encodeURIComponent(sourceId)}`;
    const extractedText = textForEntry(entry, entries[index + 1], pages);
    const normaOverride = normaOverrideFor(entry.title, detail.link);
    const leadingType = entry.title.match(
      /^(DECRETO|ACUERDO|LEY|C[ÓO]DIGO|REGLAMENTO|CONVOCATORIA|EDICTOS?)/i
    )?.[1];

    return {
      source: SOURCE,
      sourceId,
      title: entry.title,
      url: itemUrl,
      canonicalUrl: itemUrl,
      published,
      summary: `${issueLabel}. ${entry.title}`,
      tipo: leadingType ? cleanText(leadingType).toUpperCase().replace("Ó", "O") : null,
      rawRef: `${PORTAL_BASE}/seccion/periodico/${detail.id}`,
      raw: {
        jurisdiction: "Jalisco",
        officialDetailUrl: `${PORTAL_BASE}/seccion/periodico/${detail.id}`,
        pdfUrl: detail.link,
        issueId: detail.id,
        issueNumber: detail.number,
        issueSection: detail.section,
        issueVolume: detail.volume,
        page: entry.page,
        text: extractedText,
        pdfTextAvailable: Boolean(extractedText),
        ...(normaOverride ? { normaOverride } : {}),
      },
    };
  });
}

function formatJaliscoDate(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Mexico_City",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value || "";
  return `${value("year")}-${value("month")}-${value("day")}`;
}

async function extractPdfPages(
  url: string,
  fetchOfficial: typeof fetchOfficialUrl
): Promise<Record<number, string>> {
  const { response } = await fetchOfficial(url, {
    cache: "no-store",
    headers: FETCH_HEADERS,
  });
  if (!response.ok) return {};

  const { PDFParse } = await import("pdf-parse");
  const parser = new PDFParse({
    data: new Uint8Array(await response.arrayBuffer()),
  });

  try {
    const parsed = await parser.getText();
    return Object.fromEntries(parsed.pages.map((page) => [page.num, page.text]));
  } finally {
    await parser.destroy();
  }
}

export async function fetchJaliscoOfficialItems(
  params: SourceFetchParams,
  dependencies: JaliscoFetchDependencies = {}
): Promise<SourceFetchResult> {
  const fetchOfficial = dependencies.fetchOfficial || fetchOfficialUrl;
  const extractPages = dependencies.extractPdfPages ||
    ((url: string) => extractPdfPages(url, fetchOfficial));
  const now = dependencies.now?.() || new Date();
  const days = Math.max(1, Math.min(30, params.days || 1));
  const limit = Math.max(1, Math.min(500, params.limit || 100));
  const items: RawSourceItem[] = [];
  const errors: string[] = [];
  let cursor: string | null = null;

  for (let offset = 0; offset < days && items.length < limit; offset++) {
    const target = new Date(now);
    target.setUTCDate(target.getUTCDate() - offset);
    const date = formatJaliscoDate(target);
    const query = new URLSearchParams({
      fecha: date,
      search: "",
      page: "1",
      perPage: "100",
    });
    const listUrl = `${API_BASE}/newspaper/public?${query.toString()}`;

    try {
      const { response } = await fetchOfficial(listUrl, {
        cache: "no-store",
        headers: FETCH_HEADERS,
      });
      if (!response.ok) {
        errors.push(`Periódico Oficial Jalisco ${date}: HTTP ${response.status}`);
        continue;
      }

      const payload = await response.json() as JaliscoApiEnvelope<{
        data?: JaliscoNewspaperListEntry[];
      }>;
      const publications = Array.isArray(payload.result?.data) ? payload.result.data : [];

      for (const publication of publications) {
        if (items.length >= limit) break;
        const detailUrl = `${API_BASE}/newspaper/public/find?id=${publication.id_newspaper}`;

        try {
          const { response: detailResponse } = await fetchOfficial(detailUrl, {
            cache: "no-store",
            headers: FETCH_HEADERS,
          });
          if (!detailResponse.ok) {
            errors.push(`Periódico Oficial Jalisco edición ${publication.id_newspaper}: HTTP ${detailResponse.status}`);
            continue;
          }

          const detailPayload = await detailResponse.json() as JaliscoApiEnvelope<JaliscoNewspaperDetail>;
          const detail = detailPayload.result;
          if (!detail?.id || !detail.link || !detail.post_date) {
            errors.push(`Periódico Oficial Jalisco edición ${publication.id_newspaper}: respuesta incompleta`);
            continue;
          }

          const pages = await extractPages(detail.link).catch(() => ({}));
          const detailItems = buildJaliscoItemsFromDetail(detail, pages);
          items.push(...detailItems.slice(0, limit - items.length));
          cursor = `${detail.post_date}:${detail.id}`;
        } catch (error) {
          errors.push(
            `Periódico Oficial Jalisco edición ${publication.id_newspaper}: ${
              error instanceof Error ? error.message : String(error)
            }`
          );
        }
      }
    } catch (error) {
      errors.push(
        `Periódico Oficial Jalisco ${date}: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  return {
    source: SOURCE,
    ok: errors.length === 0,
    found: items.length,
    items,
    cursor,
    errors,
  };
}

export const jaliscoOfficialSource: SourceModule = {
  name: "PERIODICO_OFICIAL_JALISCO",
  priority: 1,
  fetchItems: fetchJaliscoOfficialItems,
};
