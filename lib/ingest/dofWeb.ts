import { prisma } from "@/lib/prisma";
import { classifyItem } from "@/lib/classifier";
import { fetchOfficialUrl } from "@/lib/sources/officialFetch";
import { quarantineDocument } from "./quarantine";
import { parseDofNote } from "./dofParser";
import * as cheerio from "cheerio";

const DOF_BASE = "https://www.dof.gob.mx";
const FETCH_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
};

export type IngestResult = {
  ok: boolean;
  date: string;
  found: number;
  saved: number;
  quarantined: number;
  sample: Array<{
    title: string;
    url: string;
    tema?: string | null;
  }>;
};

function formatDateArg(date?: Date) {
  const d = date || new Date();
  const day = d.getDate().toString().padStart(2, "0");
  const month = (d.getMonth() + 1).toString().padStart(2, "0");
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

export async function ingestDofWeb(dateStr?: string): Promise<IngestResult> {
  const targetDate = dateStr || formatDateArg(); // DD/MM/YYYY
  const indexUrl = `${DOF_BASE}/index.php?fecha=${targetDate}`;

  // 1. Fetch Index
  const { response: res } = await fetchOfficialUrl(indexUrl, { headers: FETCH_HEADERS, cache: "no-store" });
  if (!res.ok) {
    return { ok: false, date: targetDate, found: 0, saved: 0, quarantined: 0, sample: [] };
  }

  const html = await res.text();

  // 2. Extract note links: nota_detalle.php?codigo=XXXXX&fecha=DD/MM/YYYY
  const linkRegex = /nota_detalle\.php\?codigo=(\d+)&fecha=([0-9/]+)/g;
  const matches = [...html.matchAll(linkRegex)];

  if (matches.length === 0) {
    return { ok: true, date: targetDate, found: 0, saved: 0, quarantined: 0, sample: [] };
  }

  const uniqueLinks = new Map<string, string>();
  for (const m of matches) {
    const codigo = m[1];
    const fecha = m[2];
    const fullUrl = `${DOF_BASE}/nota_detalle.php?codigo=${codigo}&fecha=${fecha}`;
    uniqueLinks.set(codigo, fullUrl);
  }

  let saved = 0;
  let quarantined = 0;
  const sample: IngestResult["sample"] = [];
  const codigos = Array.from(uniqueLinks.keys());

  for (const codigo of codigos) {
    const url = uniqueLinks.get(codigo)!;
    try {
      const { response: noteRes } = await fetchOfficialUrl(url, { headers: FETCH_HEADERS, cache: "no-store" });
      if (!noteRes.ok) continue;

      const noteHtml = await noteRes.text();
      const parsed = parseDofNote(noteHtml, url);
      const title = parsed.title || "Nota DOF " + codigo;
      const bodyClean = parsed.text;
      const summary = parsed.summary || bodyClean.slice(0, 1200);
      const category = parsed.quality.status === "noise" ? "ruido" : "administrativo";

      if (parsed.quality.status === "noise") {
        await quarantineDocument({
          source: "dof-web",
          documentUrl: url,
          reason: "NOISE_DETECTED",
          category: "ruido",
          detail: parsed.quality.reasons.join("; ") || "El contenido extraído parece ser navegación/UI, no texto legal.",
          extractedText: bodyClean.slice(0, 500),
        });
        quarantined++;
        continue;
      }

      // ── Classification & persistence ─────────────────────────────────────
      const { impacto, tipo, tema, keywordsHit } = classifyItem(title, summary);

      // Published date
      const parts = targetDate.split("/");
      const published = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`); // YYYY-MM-DD

      await prisma.item.upsert({
        where: { url },
        update: {
          source: "dof-web",
          title,
          published,
          summary,
          impacto: impacto || "bajo",
          tipo: tipo || "NOTA",
          tema,
          category,
          keywordsHit: keywordsHit.length > 0 ? keywordsHit.join(",") : null,
        },
        create: {
          source: "dof-web",
          title,
          url,
          published,
          summary,
          impacto: impacto || "bajo",
          tipo: tipo || "NOTA",
          tema,
          category,
          keywordsHit: keywordsHit.length > 0 ? keywordsHit.join(",") : null,
        },
      });

      saved++;
      if (sample.length < 5) sample.push({ title, url, tema });
    } catch (e) {
      console.error(`Error scraping DOF web ${url}`, e);
    }

    await new Promise((r) => setTimeout(r, 100));
  }

  return { ok: true, date: targetDate, found: codigos.length, saved, quarantined, sample };
}

import { extractLegalContentFromHtml } from "@/lib/ingest/manualUrl";

export function extractBodyText(html: string): string {
  // Carga y remoción agresiva de ruido del DOF antes de pasarlo al parser genérico
  const $ = cheerio.load(html);
  $("#login-box, .login-box, #login, .login, [id*='login'], [class*='login']").remove();
  $(".menu, #menu, nav, header, footer, noscript, style, script").remove();

  const extracted = extractLegalContentFromHtml($.html(), "https://www.dof.gob.mx/nota_detalle.php?codigo=123");
  let text = extracted.text;

  // Sanitización de texto redundante por seguridad
  text = text
    .replace(/iniciar\s+sesión/gi, "")
    .replace(/olvidé\s+mi\s+contraseña/gi, "")
    .replace(/soporta\s+javascript/gi, "")
    .replace(/active\s+javascript/gi, "");

  return text;
}
