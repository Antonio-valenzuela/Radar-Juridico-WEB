import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// GET /api/alerts?email=... (list own) or admin all
export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const email = searchParams.get("email");
    const token = req.headers.get("x-admin-token");

    if (token === process.env.ADMIN_TOKEN) {
        const alerts = await prisma.alert.findMany();
        return NextResponse.json({ ok: true, alerts });
    }

    if (!email) {
        return NextResponse.json({ ok: false, error: "Falta email o token" }, { status: 401 });
    }

    const alerts = await prisma.alert.findMany({ where: { email } });
    return NextResponse.json({ ok: true, alerts });
}

// POST /api/alerts { email, keyword }
export async function POST(req: Request) {
    try {
        const { email, keyword } = await req.json();
        if (!email || !keyword) return NextResponse.json({ ok: false, error: "Datos incompletos" }, { status: 400 });

        const alert = await prisma.alert.create({
            data: { email, keyword }
        });

        return NextResponse.json({ ok: true, alert });
    } catch (e: any) {
        return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
    }
}
