import { fetchJson, sleep } from "@/lib/sources/http";
import type { RawSourceItem, SourceFetchParams, SourceFetchResult, SourceModule } from "@/lib/sources/types";
import { cleanText, parseMxDate } from "@/lib/ingest/normalize";

const DETAIL_BASE = "https://sjf2.scjn.gob.mx/detalle/tesis";
const API_BASE = "https://sjf2.scjn.gob.mx/servicios/detalle/tesis";
const FALLBACK_START_ID = Number(process.env.SJF_START_ID || "2033000");

function readDate(value: unknown) {
  const text = cleanText(String(value || ""));
  return parseMxDate(text) || new Date();
}

function mapTipo(value: unknown) {
  const text = cleanText(String(value || "")).toUpperCase();
  return text.includes("JURISPRUDENCIA") ? "JURISPRUDENCIA" : "TESIS";
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

export async function fetchItems(params: SourceFetchParams): Promise<SourceFetchResult> {
  const startId = Number(params.checkpoint?.cursor || FALLBACK_START_ID);
  const limit = Math.max(20, Math.min(300, params.limit || (params.days || 7) * 50));
  const endId = Math.max(1, startId - limit);
  const checkpointDate = params.checkpoint?.lastPublishedAt || null;
  const errors: string[] = [];
  const items: RawSourceItem[] = [];
  let checked = 0;

  for (let id = startId; id > endId; id--) {
    checked++;
    try {
      const data = await fetchJson<Record<string, unknown>>(`${API_BASE}?registro=${id}`, {
        headers: { Accept: "application/json,text/plain,*/*" },
      });
      const tesis = asRecord(data.tesisDTO);
      if (!tesis?.rubro) continue;

      const published = readDate(tesis.fechaPublicacion || tesis.fechaSemanario);
      if (checkpointDate && published <= checkpointDate) continue;

      const tipo = mapTipo(tesis.ta_tj || tesis.tipoTesis);
      const url = `${DETAIL_BASE}/${id}`;
      const summary = cleanText(String(tesis.texto || tesis.precedentes || "")).slice(0, 1800);

      items.push({
        source: "SCJN_SJF",
        sourceId: String(tesis.registroDigital || id),
        title: cleanText(String(tesis.rubro)),
        url,
        canonicalUrl: url,
        published,
        summary,
        tipo,
        impacto: tipo === "JURISPRUDENCIA" ? "alto" : "medio",
        rawRef: String(id),
        raw: {
          registroDigital: tesis.registroDigital || id,
          instancia: tesis.instancia || null,
          materia: tesis.materia || tesis.materias || null,
          fechaPublicacion: tesis.fechaPublicacion || null,
        },
      });
    } catch (error) {
      errors.push(`SJF ${id}: ${error instanceof Error ? error.message : String(error)}`);
    }
    await sleep(350);
  }

  const maxRegistro = items.reduce((max, item) => {
    const n = Number(item.sourceId);
    return Number.isFinite(n) && n > max ? n : max;
  }, 0);

  return {
    source: "SCJN_SJF",
    ok: errors.length < checked,
    found: items.length,
    items,
    cursor: maxRegistro ? String(maxRegistro + 75) : String(startId),
    errors,
  };
}

export const scjnSjfSource: SourceModule = {
  name: "SCJN_SJF",
  priority: 1,
  fetchItems,
};
