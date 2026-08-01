import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { buildMatterTenantWhere, requireCaseAccess } from '@/lib/cases/access';

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: RouteContext) {
  const access = await requireCaseAccess(request);
  if (!access.ok) return access.response;
  const { id } = await params;
  const matter = await prisma.matter.findFirst({ where: buildMatterTenantWhere(id, access.context), select: { id: true } });
  if (!matter) return NextResponse.json({ ok: false, error: 'case_not_found' }, { status: 404 });

  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const entryId = typeof body?.entryId === 'string' ? body.entryId.trim() : '';
  const action = body?.action === 'actuation' ? 'actuation' : body?.action === 'notes' ? 'notes' : body?.action === 'review' ? 'review' : '';
  const notes = typeof body?.notes === 'string' ? body.notes.trim().slice(0, 5000) : undefined;
  if (!entryId || !action) return NextResponse.json({ ok: false, error: 'invalid_entry_action', message: 'La acción o publicación no es válida.' }, { status: 400 });

  const entry = await prisma.judicialBulletinEntry.findFirst({ where: { id: entryId, matterId: matter.id }, include: { actuation: true } });
  if (!entry) return NextResponse.json({ ok: false, error: 'entry_not_found', message: 'La publicación no pertenece a este expediente.' }, { status: 404 });

  if (action === 'review' || action === 'notes') {
    const updated = await prisma.judicialBulletinEntry.update({
      where: { id: entry.id },
      data: { reviewed: action === 'review' ? true : entry.reviewed, reviewedAt: action === 'review' ? new Date() : entry.reviewedAt, ...(notes !== undefined ? { notes } : {}) },
    });
    return NextResponse.json({ ok: true, entry: updated });
  }

  const actuation = entry.actuation || await prisma.caseActuation.create({
    data: {
      matterId: matter.id,
      date: entry.publicationDate || entry.agreementDate || new Date(),
      type: entry.proceedingType || 'Boletín Judicial',
      summary: entry.heading || entry.extract || `Publicación del expediente ${entry.expedienteNumber}`,
      sourceUrl: entry.sourceUrl,
      bulletinEntryId: entry.id,
    },
  });
  return NextResponse.json({ ok: true, actuation });
}
