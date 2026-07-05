import { fetchJson, fetchText, sleep } from "@/lib/sources/http";
import type { RawSourceItem, SourceFetchParams, SourceFetchResult, SourceModule } from "@/lib/sources/types";
import { cleanText, parseMxDate, stripHtml, toSidofDate } from "@/lib/ingest/normalize";

const SIDOF_BASE =
  process.env.SIDOF_BASE_URL || "https://sidof.segob.gob.mx";

function isBadTitle(title: string) {
  const text = title
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  return (
    !text ||
    text.length < 10 ||
    text.includes("bienvenido al sistema") ||
    text.includes("diario oficial de la federacion") ||
    text === "dof" ||
    text === "sidof"
  );
}

function extractTitleFromHtml(html: string) {
  const og =
    html.match(/property=["']og:title["'][^>]*content=["']([^"']+)["']/i)?.[1] ||
    html.match(/content=["']([^"']+)["'][^>]*property=["']og:title["']/i)?.[1];
  if (og && !isBadTitle(cleanText(og))) return cleanText(og);

  for (const tag of ["h1", "h2"]) {
    const match = html.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"));
    const title = match ? stripHtml(match[1]) : "";
    if (title && !isBadTitle(title)) return title;
  }
  return "";
}

async function fetchBetterTitle(codNota: string, fecha: string) {
  try {
    const note = await fetchJson<Record<string, unknown>>(`${SIDOF_BASE}/notas/nota/${codNota}`);
    const title = cleanText(String(note.titulo || note.Titulo || ""));
    if (title && !isBadTitle(title)) return title;
  } catch {
    // keep fallback chain quiet
  }

  try {
    const fechaDof = fecha.replace(/-/g, "/");
    const html = await fetchText(
      `https://dof.gob.mx/nota_detalle.php?codigo=${codNota}&fecha=${fechaDof}`
    );
    const title = extractTitleFromHtml(html);
    if (title) return title;
  } catch {
    // keep fallback chain quiet
  }

  try {
    const html = await fetchText(`https://sidof.segob.gob.mx/notas/${codNota}`);
    const title = extractTitleFromHtml(html);
    if (title) return title;
  } catch {
    // keep fallback chain quiet
  }

  return "";
}

async function fetchDate(date: Date, checkpointDate?: Date | null): Promise<RawSourceItem[]> {
  const dateStr = toSidofDate(date);
  const diarios = await fetchJson<Record<string, unknown>>(
    `${SIDOF_BASE}/diarios/porFecha/${dateStr}`
  ).catch(() => ({}));
  const list = await fetchJson<Record<string, unknown>>(`${SIDOF_BASE}/notas/${dateStr}`);
  const notes = [
    ...((Array.isArray(list.NotasMatutinas) && list.NotasMatutinas) || []),
    ...((Array.isArray(list.NotasVespertinas) && list.NotasVespertinas) || []),
    ...((Array.isArray(list.NotasExtraordinarias) && list.NotasExtraordinarias) || []),
  ] as Array<Record<string, unknown>>;

  if (notes.length === 0) return [];

  const fullNotes: Array<Record<string, unknown>> = [];
  for (const listedNote of notes) {
    const codNota = cleanText(String(listedNote.codNota || listedNote.codigo || ""));
    if (!codNota) continue;
    try {
      const detail = await fetchJson<Record<string, unknown>>(
        `${SIDOF_BASE}/notas/nota/${codNota}`
      );
      fullNotes.push({ ...listedNote, ...detail, codNota });
      await sleep(150);
    } catch {
      fullNotes.push({ ...listedNote, codNota });
    }
  }

  const items: RawSourceItem[] = [];
  for (const note of fullNotes) {
    const sourceId = cleanText(String(note.codNota || ""));
    if (!sourceId) continue;

    const rawFecha = cleanText(String(note.fecha || dateStr));
    const published = parseMxDate(rawFecha) || date;
    if (checkpointDate && published <= checkpointDate) continue;

    let title = cleanText(String(note.titulo || note.Titulo || ""));
    if (!title || isBadTitle(title)) {
      title = await fetchBetterTitle(sourceId, rawFecha);
      await sleep(150);
    }
    if (!title || isBadTitle(title)) continue;

    const contenidoTxt = cleanText(String(note.contenidoTxt || ""));
    const cadenaContenido = String(note.cadenaContenido || "");
    const summary = contenidoTxt || (cadenaContenido ? stripHtml(cadenaContenido).slice(0, 1200) : null);
    const url = `${SIDOF_BASE}/notas/nota/${sourceId}`;
    const documentId = cleanText(String(note.idDocumento || note.documentoId || note.codDiario || ""));
    const pdfUrl = documentId ? `${SIDOF_BASE}/documentos/pdf/${documentId}` : null;

    items.push({
      source: "SIDOF",
      sourceId,
      title,
      url,
      canonicalUrl: url,
      published,
      summary,
      rawRef: sourceId,
      raw: {
        codNota: sourceId,
        codDiario: note.codDiario || null,
        fecha: rawFecha,
        pdfUrl,
        diarios,
      },
    });
  }

  return items;
}

export async function fetchItems(params: SourceFetchParams): Promise<SourceFetchResult> {
  const days = Math.max(1, Math.min(30, params.days || 1));
  const checkpointDate = params.checkpoint?.lastPublishedAt || null;
  const errors: string[] = [];
  const items: RawSourceItem[] = [];
  const today = new Date();

  for (let i = 0; i < days; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    try {
      items.push(...(await fetchDate(d, checkpointDate)));
    } catch (error) {
      errors.push(`SIDOF ${toSidofDate(d)}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  const newest = items.reduce<Date | null>(
    (max, item) => (!max || item.published > max ? item.published : max),
    checkpointDate
  );

  return {
    source: "SIDOF",
    ok: errors.length === 0 || items.length > 0,
    found: items.length,
    items,
    cursor: newest?.toISOString() || params.checkpoint?.cursor || null,
    errors,
  };
}

export const sidofSource: SourceModule = {
  name: "SIDOF",
  priority: 1,
  fetchItems,
};
