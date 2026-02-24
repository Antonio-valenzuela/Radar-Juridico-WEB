/**
 * API: Changes / Reforms
 * GET /api/changes — list recent changes
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
    try {
        const sp = req.nextUrl.searchParams;
        const tipo = sp.get("tipo")?.trim() || "";
        const page = Math.max(1, Number(sp.get("page")) || 1);
        const limit = Math.min(100, Math.max(1, Number(sp.get("limit")) || 50));

        const where: any = {};
        if (tipo) {
            where.documentVersion = { tipo_cambio: tipo };
        }

        const [total, changes] = await Promise.all([
            prisma.change.count({ where }),
            prisma.change.findMany({
                where,
                orderBy: { createdAt: "desc" },
                skip: (page - 1) * limit,
                take: limit,
                include: {
                    documentVersion: {
                        select: {
                            tipo_cambio: true,
                            fecha_detectado: true,
                            document: {
                                select: {
                                    id: true,
                                    titulo: true,
                                    impacto: true,
                                    source: { select: { nombre: true } },
                                },
                            },
                        },
                    },
                },
            }),
        ]);

        return NextResponse.json({
            ok: true,
            data: changes,
            meta: { page, limit, total },
        });
    } catch (err: any) {
        console.error("GET /api/changes error:", err);
        return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
    }
}
