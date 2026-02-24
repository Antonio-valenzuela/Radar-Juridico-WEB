/**
 * API: Monitor Status
 * GET /api/monitor/status — scan status, last run times
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
    try {
        const [
            activeSources,
            totalDocuments,
            todayChanges,
            weekChanges,
            unreadNotifications,
            recentRuns,
            sources,
        ] = await Promise.all([
            prisma.source.count({ where: { activo: true } }),
            prisma.document.count(),
            prisma.documentVersion.count({
                where: {
                    fecha_detectado: {
                        gte: new Date(new Date().setHours(0, 0, 0, 0)),
                    },
                },
            }),
            prisma.documentVersion.count({
                where: {
                    fecha_detectado: {
                        gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
                    },
                },
            }),
            prisma.notification.count({ where: { leido: false } }),
            prisma.ingestRun.findMany({
                orderBy: { startedAt: "desc" },
                take: 5,
            }),
            prisma.source.findMany({
                where: { activo: true },
                select: {
                    id: true,
                    nombre: true,
                    ultima_revision: true,
                    error_count: true,
                    last_error: true,
                    frecuencia_minutos: true,
                },
                orderBy: { ultima_revision: "desc" },
            }),
        ]);

        return NextResponse.json({
            ok: true,
            data: {
                activeSources,
                totalDocuments,
                todayChanges,
                weekChanges,
                unreadNotifications,
                recentRuns,
                sources,
            },
        });
    } catch (err: any) {
        return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
    }
}
