/**
 * lib/ingest/scjn.ts
 * Ingesta SCJN por iteración de IDs.
 */
import { prisma } from "@/lib/prisma";
import { classifyItem } from "@/lib/classifier";
import { cleanText } from "@/lib/sidofParse";

const SCJN_BASE = "https://www.internet2.scjn.gob.mx/red2/comunicados/noticia.asp";
const FETCH_HEADERS = {
    "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
};

function stripHtml(html: string) {
    return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

export type IngestResult = {
    ok: boolean;
    checked: number;
    saved: number;
    lastId?: number;
    sample: Array<{ id: string; title: string; url: string; tema?: string | null }>;
};

function extractScjnData(html: string, id: number) {
    const text = stripHtml(html);
    if (!text.includes("No.") && !text.includes("Ciudad de")) return null;

    const dateMatch = text.match(/(\d{1,2})\s+de\s+([a-z]+)\s+(?:de\s+)?(\d{4})/i);
    let published = new Date();

    if (dateMatch) {
        const day = parseInt(dateMatch[1]);
        const monthStr = dateMatch[2].toLowerCase();
        const year = parseInt(dateMatch[3]);
        const months: Record<string, number> = {
            enero: 0, febrero: 1, marzo: 2, abril: 3, mayo: 4, junio: 5,
            julio: 6, agosto: 7, septiembre: 8, octubre: 9, noviembre: 10, diciembre: 11
        };
        if (months[monthStr] !== undefined) {
            published = new Date(year, months[monthStr], day);
        }
    }

    let title = `Comunicado SCJN ${id}`;
    if (dateMatch) {
        const idx = (dateMatch.index || 0) + dateMatch[0].length;
        const slice = text.slice(idx, idx + 400);
        // Buscar bloque mayúsculas
        const upperMatch = slice.match(/[A-ZÁÉÍÓÚÑ\s,".-]{15,}/);
        if (upperMatch) {
            title = cleanText(upperMatch[0]);
        } else {
            title = cleanText(slice.substring(0, 150)) + "...";
        }
    }

    const summary = text.slice(0, 800);

    return { title, published, summary };
}

export async function ingestScjnComunicados(startId: number, count = 30): Promise<IngestResult> {
    let saved = 0;
    let checked = 0;
    const sample: IngestResult["sample"] = [];
    const endId = Math.max(1, startId - count);

    for (let id = startId; id > endId; id--) {
        const url = `${SCJN_BASE}?id=${id}`;
        checked++;

        try {
            const res = await fetch(url, { headers: FETCH_HEADERS, cache: "no-store" });
            if (!res.ok) continue;

            const html = await res.text();
            const data = extractScjnData(html, id);
            if (!data) continue;

            const { title, published, summary } = data;
            const { impacto, tipo, tema } = classifyItem(title, summary);

            await prisma.item.upsert({
                where: { url },
                update: {
                    source: "scjn",
                    title,
                    published,
                    summary: summary.slice(0, 500),
                    impacto,
                    tipo,
                    tema
                },
                create: {
                    source: "scjn",
                    title,
                    url,
                    published,
                    summary: summary.slice(0, 500),
                    impacto,
                    tipo,
                    tema
                }
            });

            saved++;
            if (sample.length < 5) sample.push({ id: String(id), title, url, tema });

        } catch (e) {
            console.error(`Error ingesta SCJN id=${id}`, e);
        }

        await new Promise(r => setTimeout(r, 100));
    }

    return { ok: true, checked, saved, lastId: endId, sample };
}
