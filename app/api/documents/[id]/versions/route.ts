/**
 * API: Document versions
 * GET /api/documents/[id]/versions
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
    _req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    try {
        const doc = await prisma.document.findUnique({
            where: { id },
            select: { id: true, titulo: true },
        });

        if (!doc) {
            return NextResponse.json({ ok: false, error: "Documento no encontrado" }, { status: 404 });
        }

        const versions = await prisma.documentVersion.findMany({
            where: { documentId: id },
            orderBy: { fecha_detectado: "desc" },
            include: {
                changes: true,
            },
        });

        return NextResponse.json({ ok: true, data: { document: doc, versions } });
    } catch (err: any) {
        return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
    }
}
