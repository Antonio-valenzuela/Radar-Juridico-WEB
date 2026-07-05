import { prisma } from "@/lib/prisma";
import { classifyItem } from "@/lib/classifier";
import { runSourceIngest } from "@/lib/ingest/runIngest";
import { getCheckpoint, updateCheckpoint } from "@/lib/ingest/checkpoints";
import {
  stripHtml,
  extractTitleFromHtml,
  extractSummaryFromHtml,
  isBadGenericSidofTitle,
} from "@/lib/sidofParse";

const SIDOF_BASE =
  process.env.SIDOF_BASE_URL || "https://sidof.segob.gob.mx/dof/sidof";

const FETCH_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (compatible; JuridicoRadar/1.0; +https://github.com/juridico-radar)",
  Accept: "application/json, text/html, */*",
};

function formatMexicoCityDate(d = new Date()) {
  const parts = new Intl.DateTimeFormat("es-MX", {
    timeZone: "America/Mexico_City",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).formatToParts(d);

  const day = parts.find((p) => p.type === "day")?.value;
  const month = parts.find((p) => p.type === "month")?.value;
  const year = parts.find((p) => p.type === "year")?.value;
  return `${day}-${month}-${year}`;
}

export type IngestResult = {
  ok: boolean;
  date: string;
  found: number;
  saved: number;
  sample: Array<{ codNota: string; titulo: string; url: string }>;
  error?: string;
};

/**
 * Multi-strategy title extraction for a SIDOF nota.
 * 1. SIDOF API individual nota endpoint (JSON → titulo field)
 * 2. DOF nota_detalle.php HTML page (real document, has proper h1)
 * 3. SIDOF public note HTML page (sidof.segob.gob.mx/notas/{codNota})
 */
async function fetchBetterTitle(
  codNota: string,
  fecha: string // DD-MM-YYYY
): Promise<string> {
  // Strategy 1: SIDOF API for individual nota
  try {
    const r = await fetch(`${SIDOF_BASE}/notas/${codNota}`, {
      cache: "no-store",
      headers: FETCH_HEADERS,
    });
    if (r.ok) {
      const ct = r.headers.get("content-type") || "";
      if (ct.includes("json")) {
        const j: any = await r.json();
        const t = (j?.titulo || j?.Titulo || "").toString().trim();
        if (t && !isBadGenericSidofTitle(t)) return t;
      }
    }
  } catch {
    // continue
  }

  // Strategy 2: Official DOF nota_detalle.php (fecha as DD/MM/YYYY)
  const fechaDof = fecha.replace(/-/g, "/"); // "02-05-2026" → "02/05/2026"
  try {
    const dofUrl = `https://dof.gob.mx/nota_detalle.php?codigo=${codNota}&fecha=${fechaDof}`;
    const r = await fetch(dofUrl, {
      cache: "no-store",
      headers: { ...FETCH_HEADERS, Accept: "text/html, */*" },
    });
    if (r.ok) {
      const html = await r.text();
      const t = extractTitleFromHtml(html);
      if (t && !isBadGenericSidofTitle(t)) return t;
    }
  } catch {
    // continue
  }

  // Strategy 3: SIDOF public note page
  try {
    const sidofUrl = `https://sidof.segob.gob.mx/notas/${codNota}`;
    const r = await fetch(sidofUrl, {
      cache: "no-store",
      headers: { ...FETCH_HEADERS, Accept: "text/html, */*" },
    });
    if (r.ok) {
      const html = await r.text();
      const t = extractTitleFromHtml(html);
      if (t && !isBadGenericSidofTitle(t)) return t;
    }
  } catch {
    // continue
  }

  return "";
}

/**
 * Ingesta de notas SIDOF para una fecha dada (formato DD-MM-YYYY).
 * Si no se pasa fecha, usa hoy en zona CDMX.
 */
export async function ingestSidofByDate(date?: string): Promise<IngestResult> {
  const dateStr = date || formatMexicoCityDate();

  // 1. Obtener lista de notas del día
  const listRes = await fetch(`${SIDOF_BASE}/notas/${dateStr}`, {
    cache: "no-store",
    headers: FETCH_HEADERS,
  });

  if (!listRes.ok) {
    return {
      ok: false,
      date: dateStr,
      found: 0,
      saved: 0,
      sample: [],
      error: `SIDOF list failed (HTTP ${listRes.status})`,
    };
  }

  const listJson: any = await listRes.json();
  const mat = Array.isArray(listJson?.NotasMatutinas) ? listJson.NotasMatutinas : [];
  const ves = Array.isArray(listJson?.NotasVespertinas) ? listJson.NotasVespertinas : [];
  const ext = Array.isArray(listJson?.NotasExtraordinarias) ? listJson.NotasExtraordinarias : [];
  const notes = [...mat, ...ves, ...ext];

  if (notes.length === 0) {
    return { ok: true, date: dateStr, found: 0, saved: 0, sample: [] };
  }

  // 2. Obtener notas completas por diario (incluye titulo, contenidoTxt, etc.)
  const diarios = new Set<string>();
  for (const n of notes) {
    const codDiario = n?.codDiario?.toString?.();
    if (codDiario) diarios.add(codDiario);
  }

  const allNotas: any[] = [];
  for (const codDiario of diarios) {
    try {
      const r = await fetch(
        `${SIDOF_BASE}/notas/obtenerNotasPorDiario/${codDiario}`,
        { cache: "no-store", headers: FETCH_HEADERS }
      );
      if (!r.ok) continue;
      const j: any = await r.json();
      const arr =
        (Array.isArray(j?.Notas) && j.Notas) ||
        (Array.isArray(j?.notas) && j.notas) ||
        [];
      for (const it of arr) allNotas.push(it);
    } catch {
      // si falla un diario, seguimos
    }
  }

  // 3. Procesar y guardar cada nota
  let saved = 0;
  const sample: IngestResult["sample"] = [];

  for (const n of allNotas) {
    const codNota = n?.codNota?.toString?.();
    const fecha = (n?.fecha || dateStr)?.toString?.();
    if (!codNota) continue;

    let titulo = (n?.titulo || n?.Titulo || "").toString().trim();
    const contenidoTxt = (n?.contenidoTxt || "").toString().trim();
    const cadenaContenido = (n?.cadenaContenido || "").toString();

    // Si el título del API es genérico o vacío, intentar extraer mejor
    if (!titulo || isBadGenericSidofTitle(titulo)) {
      const betterTitle = await fetchBetterTitle(codNota, fecha);
      if (betterTitle) titulo = betterTitle;
    }

    // Si aún es malo, skip
    if (!titulo || isBadGenericSidofTitle(titulo)) continue;

    // Summary: usar contenidoTxt del API, o cadenaContenido, o HTML
    let summary: string | null = null;
    if (contenidoTxt) {
      summary = contenidoTxt.slice(0, 1200);
    } else if (cadenaContenido) {
      const plain = stripHtml(cadenaContenido);
      summary = plain ? plain.slice(0, 1200) : null;
    }

    // Si aún no hay summary, intentar desde HTML de DOF
    if (!summary) {
      try {
        const fechaDof = fecha.replace(/-/g, "/");
        const r = await fetch(
          `https://dof.gob.mx/nota_detalle.php?codigo=${codNota}&fecha=${fechaDof}`,
          { cache: "no-store", headers: { ...FETCH_HEADERS, Accept: "text/html, */*" } }
        );
        if (r.ok) {
          const html = await r.text();
          summary = extractSummaryFromHtml(html) || null;
        }
      } catch {
        // ok
      }
    }

    const publicUrl = `https://sidof.segob.gob.mx/notas/${codNota}`;
    const publishedDate = new Date(fecha.split("-").reverse().join("-"));

    const { impacto, tipo, tema, keywordsHit } = classifyItem(titulo, summary);

    await prisma.item.upsert({
      where: { url: publicUrl },
      update: {
        source: "DOF",
        title: titulo,
        published: publishedDate,
        summary,
        impacto: impacto || "bajo",
        tipo: tipo || "NOTA",
        tema,
        keywordsHit: keywordsHit.length > 0 ? keywordsHit.join(",") : null,
      },
      create: {
        source: "DOF",
        title: titulo,
        url: publicUrl,
        published: publishedDate,
        summary,
        impacto: impacto || "bajo",
        tipo: tipo || "NOTA",
        tema,
        keywordsHit: keywordsHit.length > 0 ? keywordsHit.join(",") : null,
      },
    });

    saved += 1;
    if (sample.length < 5) sample.push({ codNota, titulo, url: publicUrl });
  }

  return { ok: true, date: dateStr, found: notes.length, saved, sample };
}

/**
 * Ingesta de SIDOF para los últimos N días.
 */
export async function ingestSidofWeek(
  days = 7
): Promise<{ ok: boolean; days: number; results: IngestResult[] }> {
  const safeDays = Math.max(1, Math.min(30, days));
  const today = new Date();
  const results: IngestResult[] = [];

  for (let i = 0; i < safeDays; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dateStr = formatMexicoCityDate(d);

    try {
      const result = await ingestSidofByDate(dateStr);
      results.push(result);
    } catch (e: any) {
      results.push({
        ok: false,
        date: dateStr,
        found: 0,
        saved: 0,
        sample: [],
        error: e?.message || String(e),
      });
    }
  }

  return { ok: true, days: safeDays, results };
}

export async function runSidofIngest(date?: string) {
  if (date) return await ingestSidofByDate(date);
  return await runSourceIngest("SIDOF", { days: 1 });
}

export async function runSidofWeek(days = 7) {
  return await runSourceIngest("SIDOF", { days: Math.max(1, Math.min(30, days)) });
}

export async function runSidofInitialBackfill(days = 7) {
  const previous = await getCheckpoint("SIDOF");
  await updateCheckpoint({ source: "SIDOF", cursor: null, lastPublishedAt: null });
  try {
    return await runSidofWeek(days);
  } finally {
    const total = await prisma.item.count();
    if (total === 0 && previous) {
      await updateCheckpoint({
        source: "SIDOF",
        cursor: previous.cursor,
        lastPublishedAt: previous.lastPublishedAt,
      });
    }
  }
}
