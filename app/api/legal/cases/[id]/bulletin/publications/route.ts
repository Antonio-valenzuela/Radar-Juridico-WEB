import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { buildMatterTenantWhere, requireCaseAccess } from '@/lib/cases/access';

type RouteContext = { params: Promise<{ id: string }> };

const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).max(100).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
});

export async function GET(request: Request, { params }: RouteContext) {
  const access = await requireCaseAccess(request);
  if (!access.ok) return access.response;
  const { id } = await params;
  const matter = await prisma.matter.findFirst({
    where: buildMatterTenantWhere(id, access.context), select: { id: true },
  });
  if (!matter) return NextResponse.json({ ok: false, error: 'case_not_found' }, { status: 404 });

  const url = new URL(request.url);
  const parsed = paginationSchema.safeParse({
    page: url.searchParams.get('page') || undefined,
    pageSize: url.searchParams.get('pageSize') || undefined,
  });
  if (!parsed.success) return NextResponse.json({ ok: false, error: 'invalid_pagination' }, { status: 400 });
  const { page, pageSize } = parsed.data;

  try {
    const where = { matterId: matter.id };
    const [total, links] = await Promise.all([
      prisma.matterBulletinEntry.count({ where }),
      prisma.matterBulletinEntry.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { lastSeenAt: 'desc' },
        include: {
          bulletinEntry: {
            select: {
              id: true, expedienteNumber: true, expedienteYear: true, matterLabel: true,
              judicialDistrict: true, court: true, chamber: true, bulletinNumber: true,
              publicationDate: true, publicationDateRaw: true, agreementDate: true,
              agreementDateRaw: true, proceedingType: true, heading: true,
              extract: true, sourceUrl: true, contentHash: true, verificationStatus: true,
              evidenceKind: true, origin: true,
              source: { select: { name: true, slug: true, baseUrl: true } },
            },
          },
          actuation: { select: { id: true, reviewed: true } },
        },
      }),
    ]);
    const publications = links.map(({ bulletinEntry, ...link }) => ({
      ...bulletinEntry,
      linkId: link.id,
      reviewed: link.reviewed,
      reviewedAt: link.reviewedAt,
      notes: link.notes,
      firstSeenAt: link.firstSeenAt,
      lastVerifiedAt: link.lastSeenAt,
      actuation: link.actuation,
    }));
    return NextResponse.json({ ok: true, page, pageSize, total, publications });
  } catch (error) {
    console.error('[bulletin.publications_failed]', { matterId: matter.id, error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ ok: false, error: 'database_unavailable', message: 'No fue posible consultar las publicaciones.' }, { status: 503 });
  }
}
