/**
 * API: Notifications
 * GET   /api/notifications — list notifications
 * PATCH /api/notifications — mark as read
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
    try {
        const sp = req.nextUrl.searchParams;
        const unreadOnly = sp.get("unread") === "true";
        const page = Math.max(1, Number(sp.get("page")) || 1);
        const limit = Math.min(100, Math.max(1, Number(sp.get("limit")) || 50));

        const where: any = {};
        if (unreadOnly) where.leido = false;

        const [total, unreadCount, notifications] = await Promise.all([
            prisma.notification.count({ where }),
            prisma.notification.count({ where: { leido: false } }),
            prisma.notification.findMany({
                where,
                orderBy: { createdAt: "desc" },
                skip: (page - 1) * limit,
                take: limit,
                include: {
                    document: {
                        select: {
                            id: true,
                            titulo: true,
                            source: { select: { nombre: true } },
                        },
                    },
                },
            }),
        ]);

        return NextResponse.json({
            ok: true,
            data: notifications,
            unreadCount,
            meta: { page, limit, total },
        });
    } catch (err: any) {
        return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
    }
}

export async function PATCH(req: NextRequest) {
    try {
        const body = await req.json();

        if (body.all === true) {
            await prisma.notification.updateMany({
                where: { leido: false },
                data: { leido: true },
            });
            return NextResponse.json({ ok: true, message: "Todas marcadas como leídas" });
        }

        if (Array.isArray(body.ids) && body.ids.length > 0) {
            await prisma.notification.updateMany({
                where: { id: { in: body.ids } },
                data: { leido: true },
            });
            return NextResponse.json({ ok: true, message: `${body.ids.length} marcadas como leídas` });
        }

        return NextResponse.json(
            { ok: false, error: "Especifica ids o all:true" },
            { status: 400 }
        );
    } catch (err: any) {
        return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
    }
}
