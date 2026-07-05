/**
 * Ingestor: Cámara de Diputados — LeyesBiblio
 *
 * Scrapes https://www.diputados.gob.mx/LeyesBiblio/ which lists all
 * federal laws with their "última reforma" date. We collect laws whose
 * last-reform date falls within the requested `days` window.
 *
 * Limitations:
 * - No formal API; relies on the public HTML table.
 * - If the page structure changes, the parser must be updated.
 * - Rate limit: single request to the index page, one per law for detail (optional).
 */
import { prisma } from "@/lib/prisma";
import { classifyItem } from "@/lib/classifier";
import { cleanText, stripHtml } from "@/lib/sidofParse";
import type { IngestorParams, IngestorResult } from "./types";

const INDEX_URL = "https://www.diputados.gob.mx/LeyesBiblio/";
const PDF_BASE = "https://www.diputados.gob.mx/LeyesBiblio/pdf/";
const FETCH_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (compatible; JuridicoRadar/1.0; +https://github.com/juridico-radar)",
  Accept: "text/html, */*",
};

interface LawEntry {
  nombre: string;
  abrev: string;
  pdfUrl: string;
  ultimaReforma: Date | null;
}

function parseReformaDate(raw: string): Date | null {
  // Accepts "DD/MM/YYYY", "DD-MM-YYYY", or "DD de mes de YYYY"
  const numeric = raw.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (numeric) {
    const d = new Date(
      parseInt(numeric[3]),
      parseInt(numeric[2]) - 1,
      parseInt(numeric[1])
    );
    if (!isNaN(d.getTime())) return d;
  }

  const spanish = raw.match(/(\d{1,2})\s+de\s+([a-záéíóúñ]+)\s+(?:de\s+)?(\d{4})/i);
  if (spanish) {
    const months: Record<string, number> = {
      enero: 0, febrero: 1, marzo: 2, abril: 3, mayo: 4, junio: 5,
      julio: 6, agosto: 7, septiembre: 8, octubre: 9, noviembre: 10, diciembre: 11,
    };
    const month = months[spanish[2].toLowerCase()];
    if (month !== undefined) {
      const d = new Date(parseInt(spanish[3]), month, parseInt(spanish[1]));
      if (!isNaN(d.getTime())) return d;
    }
  }

  return null;
}

function parseLeyesTable(html: string): LawEntry[] {
  const laws: LawEntry[] = [];

  // Extract all table rows
  const rows = [...html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)];

  for (const row of rows) {
    const cells = [...row[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)];
    if (cells.length < 3) continue;

    // Column layout (from diputados.gob.mx LeyesBiblio as of 2025):
    // [0] Num  [1] Nombre (with PDF link)  [2] Abreviatura  [3] Última Reforma  [4] Tipo?
    const nameCell = cells[1]?.[1] || "";
    const nombre = cleanText(stripHtml(nameCell));
    if (!nombre || nombre.length < 5 || nombre.match(/^(No\.|Nombre|#)/i)) continue;

    // Extract PDF href
    const pdfMatch = nameCell.match(/href=["']([^"']*?\.pdf[^"']*?)["']/i);
    const rawHref = pdfMatch?.[1]?.trim() || "";
    const pdfUrl = rawHref.startsWith("http")
      ? rawHref
      : rawHref
      ? `https://www.diputados.gob.mx/LeyesBiblio/${rawHref.replace(/^\//, "")}`
      : `${PDF_BASE}${encodeURIComponent(nombre.slice(0, 30))}.pdf`;

    const abrev = cleanText(stripHtml(cells[2]?.[1] || ""));

    // Try cells 3 and 4 for the date
    const rawDate3 = cleanText(stripHtml(cells[3]?.[1] || ""));
    const rawDate4 = cells[4] ? cleanText(stripHtml(cells[4][1] || "")) : "";
    const ultimaReforma = parseReformaDate(rawDate3) || parseReformaDate(rawDate4);

    laws.push({ nombre, abrev, pdfUrl, ultimaReforma });
  }

  return laws;
}

export async function ingest({ days = 30 }: IngestorParams = {}): Promise<IngestorResult> {
  const errors: string[] = [];
  let found = 0;
  let saved = 0;
  const sample: { title: string; url: string }[] = [];

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - Math.max(1, days));

  try {
    const res = await fetch(INDEX_URL, {
      cache: "no-store",
      headers: FETCH_HEADERS,
    });

    if (!res.ok) {
      return {
        source: "diputados",
        ok: false,
        found: 0,
        saved: 0,
        errors: [`LeyesBiblio index HTTP ${res.status}`],
      };
    }

    const html = await res.text();
    const allLaws = parseLeyesTable(html);
    found = allLaws.length;

    if (found === 0) {
      errors.push("No laws parsed from index — page structure may have changed");
      return { source: "diputados", ok: false, found, saved, errors };
    }

    // Filter to laws updated within `days`
    const recentLaws = allLaws.filter(
      (l) => l.ultimaReforma && l.ultimaReforma >= cutoff
    );

    for (const law of recentLaws) {
      try {
        // Use PDF URL as the stable unique identifier
        const url = law.pdfUrl || `${INDEX_URL}#${law.abrev || encodeURIComponent(law.nombre.slice(0, 30))}`;
        const title = law.abrev ? `${law.nombre} (${law.abrev})` : law.nombre;
        const published = law.ultimaReforma!;

        const reformDate = published.toLocaleDateString("es-MX", {
          day: "2-digit",
          month: "long",
          year: "numeric",
        });
        const summary = `Ley federal vigente. Última reforma publicada el ${reformDate} en el DOF.`;

        const { impacto, tipo, tema, keywordsHit } = classifyItem(title, summary);

        await prisma.item.upsert({
          where: { url },
          update: {
            source: "diputados",
            title,
            published,
            summary,
            impacto: impacto || "medio",
            tipo: tipo || "LEY",
            tema,
            keywordsHit: keywordsHit.length > 0 ? keywordsHit.join(",") : null,
          },
          create: {
            source: "diputados",
            title,
            url,
            published,
            summary,
            impacto: impacto || "medio",
            tipo: tipo || "LEY",
            tema,
            keywordsHit: keywordsHit.length > 0 ? keywordsHit.join(",") : null,
          },
        });

        saved++;
        if (sample.length < 5) sample.push({ title, url });
      } catch (e: any) {
        errors.push(`${law.nombre}: ${e.message}`);
      }
    }
  } catch (e: any) {
    errors.push(e.message);
    return { source: "diputados", ok: false, found, saved, errors };
  }

  return { source: "diputados", ok: true, found, saved, errors, sample };
}
