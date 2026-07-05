// app/api/admin/jobs/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/security/adminAuth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const adminCheck = requireAdmin(req);
  if (!adminCheck.ok) {
    return adminCheck.response;
  }

  try {
    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');
    const status = searchParams.get('status') || undefined;

    const where = status ? { status } : {};

    const [jobs, total] = await Promise.all([
      prisma.ingestionJob.findMany({
        where,
        include: {
          logs: {
            orderBy: { timestamp: 'desc' },
            take: 5,
          },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.ingestionJob.count({ where })
    ]);

    return NextResponse.json({
      ok: true,
      jobs,
      total,
      limit,
      offset,
    });
  } catch (error: any) {
    console.error('[api/admin/jobs] GET error:', error);
    return NextResponse.json(
      { ok: false, error: 'server_error', message: 'Error interno al obtener los jobs de ingesta.' },
      { status: 500 }
    );
  }
}
