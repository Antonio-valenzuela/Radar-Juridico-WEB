/**
 * API: Documents
 * GET /api/documents — list documents with filters
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
    try {
        const sp = req.nextUrl.searchParams;
        const q = sp.get("q")?.trim() || "";
        const materia = sp.get("materia")?.trim() || "";
        const nivel = sp.get("nivel")?.trim() || "";
        const impacto = sp.get("impacto")?.trim() || "";
        const sourceId = sp.get("sourceId")?.trim() || "";
        const page = Math.max(1, Number(sp.get("page")) || 1);
        const limit = Math.min(100, Math.max(1, Number(sp.get("limit")) || 50));

        const where: any = {};
        if (materia) where.materia = materia;
        if (nivel) where.nivel = nivel;
        if (impacto) where.impacto = impacto;
        if (sourceId) where.sourceId = sourceId;

        if (q) {
            where.OR = [
                { titulo: { contains: q, mode: "insensitive" } },
                { contenido_actual: { contains: q, mode: "insensitive" } },
            ];
        }

        const [total, documents] = await Promise.all([
            prisma.document.count({ where }),
            prisma.document.findMany({
                where,
                orderBy: { updatedAt: "desc" },
                skip: (page - 1) * limit,
                take: limit,
                include: {
                    source: { select: { nombre: true, tipo: true } },
                    _count: { select: { versions: true, notifications: true } },
                },
            }),
        ]);

        return NextResponse.json({
            ok: true,
            data: documents,
            meta: { page, limit, total },
        });
    } catch (err: any) {
        console.error("GET /api/documents error:", err);
        return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
    }
}
