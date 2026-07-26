import { NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requireCaseAccess } from '@/lib/cases/access';
import { validateMatterCreate } from '@/lib/cases/validation';

const pageNumber = (value: string | null, fallback: number, maximum: number) => {
  const parsed = Number.parseInt(value || '', 10);
  return Number.isFinite(parsed) && parsed >= 0
    ? Math.min(parsed, maximum)
    : fallback;
};

export async function GET(request: Request) {
  const access = await requireCaseAccess(request);
  if (!access.ok) return access.response;

  try {
    const { searchParams } = new URL(request.url);
    const skip = pageNumber(searchParams.get('skip'), 0, 10_000);
    const take = pageNumber(searchParams.get('take'), 50, 100) || 50;
    const search = searchParams.get('search')?.trim().slice(0, 200);
    const where: Prisma.MatterWhereInput = {
      organizationId: access.context.organizationId,
      ...(search
        ? {
            OR: [
              { caseNumber: { contains: search, mode: 'insensitive' } },
              { court: { contains: search, mode: 'insensitive' } },
              { title: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      prisma.matter.findMany({
        where,
        skip,
        take,
        orderBy: { updatedAt: 'desc' },
        include: {
          _count: {
            select: {
              parties: true,
              actuations: true,
              deadlines: true,
              caseFiles: true,
              caseAlerts: true,
            },
          },
        },
      }),
      prisma.matter.count({ where }),
    ]);

    return NextResponse.json({ data: items, meta: { total, skip, take } });
  } catch {
    return NextResponse.json(
      { error: 'No fue posible consultar los expedientes.' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const access = await requireCaseAccess(request);
  if (!access.ok) return access.response;

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const validation = validateMatterCreate(body);
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    const item = await prisma.matter.create({
      data: {
        ...validation.data,
        organizationId: access.context.organizationId,
        assignedUserId: access.context.userId,
      },
    });
    return NextResponse.json(item, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: 'No fue posible crear el expediente.' },
      { status: 500 }
    );
  }
}
