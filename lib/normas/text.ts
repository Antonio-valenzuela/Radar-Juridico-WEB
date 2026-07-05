import crypto from "crypto";
import * as cheerio from "cheerio";
import { fetchWithRetry } from "@/lib/sources/http";
import { cleanText, stripHtml } from "@/lib/ingest/normalize";

export type ExtractedText = {
  ok: boolean;
  url: string;
  contentType: "html" | "pdf" | "text" | "unknown";
  text: string | null;
  error?: string;
};

export function hashText(text: string) {
  return crypto.createHash("sha256").update(text).digest("hex");
}

export function normalizeLegalText(text: string) {
  const normalized = cleanText(text)
    .replace(/\b(Diario Oficial de la Federaci[oó]n|C[aá]mara de Diputados|Secretar[ií]a General)\b/gi, " ")
    .replace(/\b(P[aá]gina|Page)\s+\d+\s+(de|of)\s+\d+\b/gi, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
  return normalized.normalize("NFC");
}

export async function extractTextFromUrl(url: string): Promise<ExtractedText> {
  try {
    const res = await fetchWithRetry(url, {
      headers: { Accept: "text/html,application/pdf,text/plain,*/*" },
      timeoutMs: 30000,
      retries: 1,
    });
    if (!res.ok) {
      return { ok: false, url, contentType: "unknown", text: null, error: `HTTP ${res.status}` };
    }

    const contentType = (res.headers.get("content-type") || "").toLowerCase();
    const isPdf = contentType.includes("pdf") || /\.pdf($|\?)/i.test(url);

    if (isPdf) {
      const buffer = Buffer.from(await res.arrayBuffer());
      const text = await extractPdfText(buffer);
      return {
        ok: Boolean(text),
        url,
        contentType: "pdf",
        text: text ? normalizeLegalText(text) : null,
        error: text ? undefined : "PDF sin texto extraible",
      };
    }

    const body = await res.text();
    if (contentType.includes("html") || /<html|<body|<div/i.test(body)) {
      return { ok: true, url, contentType: "html", text: normalizeLegalText(extractHtmlText(body)) };
    }

    return { ok: true, url, contentType: "text", text: normalizeLegalText(body) };
  } catch (error) {
    return {
      ok: false,
      url,
      contentType: "unknown",
      text: null,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function extractHtmlText(html: string) {
  const $ = cheerio.load(html);
  $("script,style,noscript,nav,header,footer,iframe,svg").remove();
  const main = $("main").text() || $("body").text() || stripHtml(html);
  return main;
}

async function extractPdfText(buffer: Buffer) {
  try {
    const mod = await import("pdf-parse");
    const pdfParse = ("default" in mod ? mod.default : mod) as unknown as (
      input: Buffer
    ) => Promise<{ text?: string }>;
    const parsed = await pdfParse(buffer);
    return parsed.text || "";
  } catch {
    return "";
  }
}
