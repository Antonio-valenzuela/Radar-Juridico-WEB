import { prisma } from "@/lib/prisma";
import type { Item } from "@prisma/client";
import { cleanText } from "@/lib/ingest/normalize";

type NormaCandidate = {
  nombre: string;
  sigla: string | null;
  fuente: string;
  urlBase: string | null;
};

const KNOWN_NORMAS: Array<{ sigla: string; nombre: string; patterns: RegExp[] }> = [
  { sigla: "CPEUM", nombre: "Constitucion Politica de los Estados Unidos Mexicanos", patterns: [/constituci[oó]n pol[ií]tica/i, /\bCPEUM\b/i] },
  { sigla: "CNPCF", nombre: "Codigo Nacional de Procedimientos Civiles y Familiares", patterns: [/c[oó]digo nacional de procedimientos civiles y familiares/i, /\bCNPCF\b/i] },
  { sigla: "CFF", nombre: "Codigo Fiscal de la Federacion", patterns: [/c[oó]digo fiscal de la federaci[oó]n/i, /\bCFF\b/i] },
  { sigla: "LFT", nombre: "Ley Federal del Trabajo", patterns: [/ley federal del trabajo/i, /\bLFT\b/i] },
  { sigla: "LISR", nombre: "Ley del Impuesto sobre la Renta", patterns: [/ley del impuesto sobre la renta/i, /\bLISR\b/i] },
  { sigla: "LIVA", nombre: "Ley del Impuesto al Valor Agregado", patterns: [/ley del impuesto al valor agregado/i, /\bLIVA\b/i] },
  { sigla: "LGSM", nombre: "Ley General de Sociedades Mercantiles", patterns: [/ley general de sociedades mercantiles/i, /\bLGSM\b/i] },
  { sigla: "LA", nombre: "Ley de Amparo", patterns: [/ley de amparo/i] },
];

export async function detectOrCreateNorma(item: Item, extractedText?: string | null) {
  const candidate = await detectNormaCandidate(item, extractedText);
  if (!candidate) return null;

  return await prisma.norma.upsert({
    where: { fuente_nombre: { fuente: candidate.fuente, nombre: candidate.nombre } },
    update: {
      sigla: candidate.sigla,
      urlBase: candidate.urlBase,
    },
    create: {
      nombre: candidate.nombre,
      sigla: candidate.sigla,
      fuente: candidate.fuente,
      urlBase: candidate.urlBase,
      aliases: candidate.sigla ? [candidate.sigla] : undefined,
    },
  });
}

async function detectNormaCandidate(item: Item, extractedText?: string | null): Promise<NormaCandidate | null> {
  const manual = await detectManualOverride(item);
  if (manual) return manual;

  const haystack = `${item.title} ${item.summary || ""} ${(extractedText || "").slice(0, 3000)}`;
  for (const norma of KNOWN_NORMAS) {
    if (norma.patterns.some((pattern) => pattern.test(haystack))) {
      return { nombre: norma.nombre, sigla: norma.sigla, fuente: item.source, urlBase: item.canonicalUrl || item.url };
    }
  }

  const title = cleanText(item.title);
  const named =
    title.match(/(?:reforma(?:n)?|adiciona(?:n)?|deroga(?:n)?).*?(Ley [A-ZÁÉÍÓÚÑ][^.,;]+)/i)?.[1] ||
    title.match(/(?:reforma(?:n)?|adiciona(?:n)?|deroga(?:n)?).*?(C[oó]digo [A-ZÁÉÍÓÚÑ][^.,;]+)/i)?.[1] ||
    title.match(/\b(Ley [A-ZÁÉÍÓÚÑ][^.,;]+)/i)?.[1] ||
    title.match(/\b(C[oó]digo [A-ZÁÉÍÓÚÑ][^.,;]+)/i)?.[1] ||
    title.match(/\b(Reglamento [A-ZÁÉÍÓÚÑ][^.,;]+)/i)?.[1];

  if (!named) return null;
  return {
    nombre: cleanText(named).slice(0, 220),
    sigla: null,
    fuente: item.source,
    urlBase: item.canonicalUrl || item.url,
  };
}

async function detectManualOverride(item: Item): Promise<NormaCandidate | null> {
  const raw = item.raw;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const obj = raw as Record<string, unknown>;
  const override = obj.normaOverride;
  if (!override || typeof override !== "object" || Array.isArray(override)) return null;
  const data = override as Record<string, unknown>;
  const nombre = typeof data.nombre === "string" ? cleanText(data.nombre) : "";
  if (!nombre) return null;
  return {
    nombre,
    sigla: typeof data.sigla === "string" ? cleanText(data.sigla) : null,
    fuente: typeof data.fuente === "string" ? cleanText(data.fuente) : item.source,
    urlBase: typeof data.urlBase === "string" ? cleanText(data.urlBase) : item.canonicalUrl || item.url,
  };
}
