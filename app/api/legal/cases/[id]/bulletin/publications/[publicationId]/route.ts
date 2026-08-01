import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { buildMatterTenantWhere, requireCaseAccess } from '@/lib/cases/access';

type RouteContext = { params: Promise<{ id: string; publicationId: string }> };

const idSchema = z.string().trim().min(1).max(100);

export async function GET(request: Request, { params }: RouteContext) {
  const access = await requireCaseAccess(request);
  if (!access.ok) return access.response;
  const routeParams = await params;
  const matterId = idSchema.safeParse(routeParams.id);
  const publicationId = idSchema.safeParse(routeParams.publicationId);
  if (!matterId.success || !publicationId.success) return NextResponse.json({ ok: false, error: 'invalid_id' }, { status: 400 });
  const matter = await prisma.matter.findFirst({ where: buildMatterTenantWhere(matterId.data, access.context), select: { id: true } });
  if (!matter) return NextResponse.json({ ok: false, error: 'case_not_found' }, { status: 404 });
  const link = await prisma.matterBulletinEntry.findUnique({
    where: { matterId_bulletinEntryId: { matterId: matter.id, bulletinEntryId: publicationId.data } },
    include: {
      bulletinEntry: { include: { source: { select: { name: true, slug: true, baseUrl: true } } } },
      actuation: true,
    },
  });
  if (!link) return NextResponse.json({ ok: false, error: 'publication_not_found' }, { status: 404 });
  const { bulletinEntry, ...association } = link;
  return NextResponse.json({
    ok: true,
    publication: {
      ...bulletinEntry,
      raw: undefined,
      linkId: association.id,
      reviewed: association.reviewed,
      reviewedAt: association.reviewedAt,
      notes: association.notes,
      firstSeenAt: association.firstSeenAt,
      lastVerifiedAt: association.lastSeenAt,
      actuation: association.actuation,
    },
  });
}
