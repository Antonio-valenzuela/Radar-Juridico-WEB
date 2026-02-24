/**
 * API: Source by ID
 * GET    /api/sources/[id]
 * PUT    /api/sources/[id]
 * DELETE /api/sources/[id]
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { SourceUpdateSchema } from "@/lib/validation";

export async function GET(
    _req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    try {
        const source = await prisma.source.findUnique({
            where: { id },
            include: {
                ingestRuns: { take: 5, orderBy: { startedAt: "desc" } },
            },
        });

        if (!source) {
            return NextResponse.json({ ok: false, error: "Fuente no encontrada" }, { status: 404 });
        }

        return NextResponse.json({ ok: true, data: source });
    } catch (err: any) {
        return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
    }
}

export async function PUT(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    try {
        const body = await req.json();
        const parsed = SourceUpdateSchema.safeParse(body);

        if (!parsed.success) {
            return NextResponse.json(
                { ok: false, error: parsed.error.issues.map(i => i.message).join(", ") },
                { status: 400 }
            );
        }

        const source = await prisma.source.update({
            where: { id },
            data: parsed.data,
        });

        return NextResponse.json({ ok: true, data: source });
    } catch (err: any) {
        return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
    }
}

export async function DELETE(
    _req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    try {
        await prisma.source.delete({ where: { id } });
        return NextResponse.json({ ok: true });
    } catch (err: any) {
        return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
    }
}
