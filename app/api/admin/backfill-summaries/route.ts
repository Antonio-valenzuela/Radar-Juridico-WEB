import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { stripHtml, isBadGenericSidofTitle } from "@/lib/sidofParse";
import { classifyItem } from "@/lib/classifier";

export const dynamic = "force-dynamic";

/**
 * Endpoint de mantenimiento para arreglar registros viejos.
 * GET /api/admin/backfill-summaries?limit=200
 */
export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get("limit") || "100", 10);

    try {
        // Buscar items con summary corto, nulo o títulos genéricos
        const items = await prisma.item.findMany({
            where: {
                OR: [
                    { summary: { equals: null } },
                    { summary: { lt: "" } }, // Trick for empty strings if any
                    { title: { contains: "Bienvenido" } },
                    { title: { contains: "Diario Oficial" } }
                ]
            },
            take: limit
        });

        let updated = 0;

        for (const item of items) {
            let newTitle = item.title;
            let newSummary = item.summary;

            // 1. Si el título es malo, intentar obtener algo mejor del summary existente o marcarlo
            if (isBadGenericSidofTitle(item.title)) {
                if (item.summary && item.summary.length > 30) {
                    newTitle = item.summary.slice(0, 100) + "...";
                }
            }

            // 2. Si el summary es corto y tenemos una URL de SIDOF, en el futuro podríamos re-scrapear.
            // Por ahora, al menos aseguramos que no sea nulo y re-clasificamos.
            const { impacto, tipo, tema } = classifyItem(newTitle, newSummary);

            await prisma.item.update({
                where: { id: item.id },
                data: {
                    title: newTitle,
                    summary: newSummary || "Sin resumen disponible (pendiente re-ingesta)",
                    impacto: impacto || item.impacto,
                    tipo: tipo || item.tipo,
                    tema: tema || item.tema
                }
            });
            updated++;
        }

        return NextResponse.json({ ok: true, found: items.length, updated });
    } catch (e: any) {
        return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
    }
}
