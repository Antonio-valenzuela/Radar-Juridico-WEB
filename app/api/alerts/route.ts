import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/security/adminAuth";

export const dynamic = "force-dynamic";

// Alert management is administrative until the app has authenticated user identities.
export async function GET(req: Request) {
    const auth = requireAdmin(req);
    if (!auth.ok) return auth.response;

    const alerts = await prisma.alert.findMany();
    return NextResponse.json({ ok: true, alerts });
}

// POST /api/alerts { email, keyword }
export async function POST(req: Request) {
    try {
        const auth = requireAdmin(req);
        if (!auth.ok) return auth.response;

        const { email, keyword } = await req.json();
        if (!email || !keyword) return NextResponse.json({ ok: false, error: "Datos incompletos" }, { status: 400 });

        const alert = await prisma.alert.create({
            data: { email, keyword }
        });

        return NextResponse.json({ ok: true, alert });
    } catch (error: unknown) {
        console.error("POST /api/alerts error:", error);
        return NextResponse.json({ ok: false, error: "No se pudo crear la alerta" }, { status: 500 });
    }
}
