import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
    try {
        const url = new URL(req.url);
        const q = (url.searchParams.get("q") || "").trim();
        const source = (url.searchParams.get("source") || "").trim();
        const impacto = (url.searchParams.get("impacto") || "").trim();
        const tipo = (url.searchParams.get("tipo") || "").trim();
        const tema = (url.searchParams.get("tema") || "").trim();

        const where: any = {};
        if (source) where.source = source;
        if (impacto) where.impacto = impacto;
        if (tipo) where.tipo = tipo;
        if (tema) where.tema = tema;

        if (q) {
            where.OR = [
                { title: { contains: q, mode: "insensitive" } },
                { summary: { contains: q, mode: "insensitive" } },
            ];
        }

        const items = await prisma.item.findMany({
            where,
            orderBy: { published: "desc" },
            take: 1000, // Limit export
        });

        // Generate CSV
        const headers = ["ID", "Source", "Date", "Title", "Topic", "Type", "Impact", "URL"];
        const rows = items.map(i => [
            i.id,
            i.source,
            i.published.toISOString().split("T")[0],
            `"${i.title.replace(/"/g, '""')}"`, // Escape quotes
            i.tema || "",
            i.tipo || "",
            i.impacto || "",
            i.url
        ]);

        const csvContent = [
            headers.join(","),
            ...rows.map(r => r.join(","))
        ].join("\n");

        return new NextResponse(csvContent, {
            headers: {
                "Content-Type": "text/csv",
                "Content-Disposition": `attachment; filename="juridico-radar-export-${new Date().toISOString().split("T")[0]}.csv"`
            }
        });

    } catch (e: any) {
        return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
    }
}
