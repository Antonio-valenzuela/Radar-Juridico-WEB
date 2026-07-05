import { classifyItem as legacyClassifyItem } from "@/lib/classifier";
import type { NormalizedItem } from "@/lib/ingest/normalize";

const VALID_TYPES = new Set([
  "DECRETO",
  "LEY",
  "CODIGO",
  "REGLAMENTO",
  "ACUERDO",
  "JURISPRUDENCIA",
  "TESIS",
  "INICIATIVA",
  "AVISO",
  "OTRO",
]);

const TOPIC_ALIASES: Record<string, string> = {
  civil: "civil/familiar",
  constitucional: "constitucional/amparo",
};

export function classifyNormalizedItem(item: NormalizedItem) {
  const detected = legacyClassifyItem(item.title, item.summary);
  const text = `${item.title} ${item.summary || ""}`;
  const category = detectCategory(text);
  const tipo = normalizeTipo(item.tipo || detected.tipo, item.title);
  const tema = normalizeTema(item.tema || detectTema(`${item.title} ${item.summary || ""}`) || detected.tema);
  const impacto = category === "ruido"
    ? "bajo"
    : category === "normativo"
    ? "alto"
    : item.impacto || detected.impacto || "bajo";
  const keywordsHit = Array.from(
    new Set([...(item.keywordsHit || []), ...(detected.keywordsHit || [])])
  );

  return { tipo, tema, impacto, category, keywordsHit };
}

function detectCategory(raw: string): "normativo" | "administrativo" | "ruido" {
  const text = raw.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
  if (
    /TIPO DE CAMBIO|TASAS? DE INTERES|TIIE|INPC|SUBASTA|AVISO REF/.test(text)
  ) {
    return "ruido";
  }
  if (/DECRETO|REFORMA|REFORMAN|ADICIONA|ADICIONAN|ABROGA|ABROGACION|DEROGA|DEROGAN|EXPIDE|ENTRA EN VIGOR|TRANSITORIOS|CODIGO|CONSTITUCION/.test(text)) {
    return "normativo";
  }
  return "administrativo";
}

function detectTema(raw: string) {
  const text = raw.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
  if (/(MERCANTIL|COMERCIO|SOCIEDADES MERCANTILES|TITULOS Y OPERACIONES DE CREDITO)/.test(text)) return "mercantil";
  if (/(SALUD|SANITARIO|MEDICAMENTO|COFEPRIS)/.test(text)) return "salud";
  if (/(ENERGIA|ELECTRIC|HIDROCARBURO|PETROL|CRE|CENACE)/.test(text)) return "energia";
  if (/(FINANCIER|BANCAR|VALORES|SEGUROS|AFORE|CNBV|CONDUSEF)/.test(text)) return "financiero";
  return null;
}

function normalizeTipo(raw: string | null, title: string) {
  const text = `${raw || ""} ${title}`.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
  if (text.includes("JURISPRUDENCIA")) return "JURISPRUDENCIA";
  if (text.includes("TESIS")) return "TESIS";
  if (text.includes("INICIATIVA")) return "INICIATIVA";
  if (text.includes("DECRETO")) return "DECRETO";
  if (text.includes("CODIGO")) return "CODIGO";
  if (text.includes("REGLAMENTO")) return "REGLAMENTO";
  if (text.includes("ACUERDO")) return "ACUERDO";
  if (text.includes("AVISO")) return "AVISO";
  if (text.includes("LEY")) return "LEY";
  return VALID_TYPES.has(text.trim()) ? text.trim() : "OTRO";
}

function normalizeTema(raw: string | null) {
  if (!raw) return null;
  const key = raw.toLowerCase();
  return TOPIC_ALIASES[key] || key;
}
