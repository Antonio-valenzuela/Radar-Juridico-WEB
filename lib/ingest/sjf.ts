import { prisma } from "@/lib/prisma";
import { classifyItem } from "@/lib/classifier";
import { cleanText } from "@/lib/sidofParse";

const SJF_API_BASE = "https://sjf2.scjn.gob.mx/servicios/detalle"; // tesis, ejecutoria, voto
const FETCH_HEADERS = {
    "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "application/json, text/plain, */*"
};

export type IngestResult = {
    ok: boolean;
    checked: number;
    saved: number;
    failed: number;
    lastId?: number;
    sample: Array<{ registro: string; rubro: string; url: string; tipo: string }>;
};

/**
 * Detecta si el contenido devuelto es "basura" o error de bot-block.
 */
function isJunkSjfContent(text: string): boolean {
    const lower = text.toLowerCase();
    return (
        lower.includes("outdated browser") ||
        lower.includes("jhipster") ||
        lower.includes("ha ocurrido un error :-(") ||
        lower.includes("no se encontró información") ||
        lower.includes("access denied") ||
        lower.includes("cloudflare") ||
        text.length < 50 // Demasiado corto para ser una tesis
    );
}

export async function ingestSjf(startId: number, count = 20): Promise<IngestResult> {
    let saved = 0;
    let checked = 0;
    let failed = 0;
    const sample: IngestResult["sample"] = [];
    
    // Iteramos hacia atrás buscando registros digitales
    const endId = startId - count;

    for (let id = startId; id > endId; id--) {
        const url = `https://sjf2.scjn.gob.mx/detalle/tesis/${id}`;
        const apiUrl = `${SJF_API_BASE}/tesis?registro=${id}`;
        checked++;

        try {
            const res = await fetch(apiUrl, { headers: FETCH_HEADERS, cache: "no-store" });
            
            if (!res.ok) {
                failed++;
                continue;
            }

            // Primero verificamos si es HTML (posible bloqueo) o JSON
            const contentType = res.headers.get("content-type") || "";
            if (contentType.includes("text/html")) {
                const html = await res.text();
                if (isJunkSjfContent(html)) {
                    console.warn(`SJF Ingest: ID ${id} saltado por contenido basura/bloqueo.`);
                    failed++;
                    continue;
                }
            }

            const data = await res.json();

            // Estructura esperada de SJF2 API: { tesisDTO: { rubro, texto, registroDigital, ... } }
            const item = data?.tesisDTO;
            if (!item || !item.rubro) {
                failed++;
                continue;
            }

            const rubro = cleanText(item.rubro);
            const summary = cleanText(item.texto || item.precedentes || "").slice(0, 2000);
            const registro = String(item.registroDigital || id);
            
            // Tipo: Mapeo simple
            let tipo = "TESIS";
            if (item.ta_tj === "Jurisprudencia") {
                tipo = "JURISPRUDENCIA";
            }

            // Fecha
            let published = new Date();
            if (item.fechaPublicacion) {
                // Formato suele ser "Viernes 10 de enero de 2014 10:30"
                const dateMatch = item.fechaPublicacion.match(/(\d{1,2})\s+de\s+([a-z]+)\s+(?:de\s+)?(\d{4})/i);
                if (dateMatch) {
                    const day = parseInt(dateMatch[1]);
                    const months: Record<string, number> = {
                        enero: 0, febrero: 1, marzo: 2, abril: 3, mayo: 4, junio: 5,
                        julio: 6, agosto: 7, septiembre: 8, octubre: 9, noviembre: 10, diciembre: 11
                    };
                    const month = months[dateMatch[2].toLowerCase()];
                    const year = parseInt(dateMatch[3]);
                    if (month !== undefined) published = new Date(year, month, day);
                }
            }

            // Clasificar
            const { tema, impacto, keywordsHit } = classifyItem(rubro, summary);

            // Upsert en DB
            await prisma.item.upsert({
                where: { url },
                update: {
                    source: "sjf",
                    title: rubro,
                    published,
                    summary,
                    tipo,
                    tema,
                    impacto: impacto || "alto", // Jurisprudencia es impacto alto por defecto
                    keywordsHit: keywordsHit.length > 0 ? keywordsHit.join(",") : null,
                },
                create: {
                    source: "sjf",
                    title: rubro,
                    url,
                    published,
                    summary,
                    tipo,
                    tema,
                    impacto: impacto || "alto",
                    keywordsHit: keywordsHit.length > 0 ? keywordsHit.join(",") : null,
                }
            });

            saved++;
            if (sample.length < 5) {
                sample.push({ registro, rubro, url, tipo });
            }

        } catch (e) {
            console.error(`Error ingesta SJF id=${id}`, e);
            failed++;
        }

        // Delay para no saturar/ser bloqueado
        await new Promise(r => setTimeout(r, 500));
    }

    return { ok: true, checked, saved, failed, lastId: endId, sample };
}

