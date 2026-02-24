/**
 * API: Sources CRUD
 * GET  /api/sources — list all sources
 * POST /api/sources — create a source
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { SourceCreateSchema } from "@/lib/validation";

export async function GET() {
    try {
        const sources = await prisma.source.findMany({
            orderBy: { createdAt: "desc" },
            include: {
                ingestRuns: {
                    take: 1,
                    orderBy: { startedAt: "desc" }
                }
            }
        });

        return NextResponse.json({ ok: true, data: sources });
    } catch (err: any) {
        console.error("GET /api/sources error:", err);
        return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const parsed = SourceCreateSchema.safeParse(body);

        if (!parsed.success) {
            return NextResponse.json(
                { ok: false, error: parsed.error.issues.map(i => i.message).join(", ") },
                { status: 400 }
            );
        }

        const source = await prisma.source.create({ data: parsed.data });
        return NextResponse.json({ ok: true, data: source }, { status: 201 });
    } catch (err: any) {
        console.error("POST /api/sources error:", err);
        return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
    }
}
