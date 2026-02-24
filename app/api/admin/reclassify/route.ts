import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { classifyItem } from "@/lib/classifier";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const limit = parseInt(searchParams.get("limit") || "200");

        // 1. Buscar items sin tema o con tema genérico si hiciera falta
        const items = await prisma.item.findMany({
            where: {
                tema: null
            },
            take: limit,
            orderBy: { createdAt: "desc" }
        });

        let updatedCount = 0;

        for (const item of items) {
            const summary = item.summary || "";
            const { impacto, tipo, tema } = classifyItem(item.title, summary);

            // Solo actualizamos si encontramos un tema, o para llenar tipo/impacto
            const dataToUpdate: any = {};

            if (tema) dataToUpdate.tema = tema;
            if (!item.tipo || item.tipo === "NOTA") dataToUpdate.tipo = tipo; // Mejorar tipo si es genérico
            if (!item.impacto) dataToUpdate.impacto = impacto;

            if (Object.keys(dataToUpdate).length > 0) {
                await prisma.item.update({
                    where: { id: item.id },
                    data: dataToUpdate
                });
                updatedCount++;
            }
        }

        return NextResponse.json({
            ok: true,
            processed: items.length,
            updated: updatedCount,
            message: `Reclasificados ${updatedCount} de ${items.length} items analizados (tema=null)`
        });

    } catch (err: any) {
        console.error("Reclassify error", err);
        return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
    }
}
