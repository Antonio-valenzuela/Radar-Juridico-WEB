import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { indexDocumentVersion } from '@/lib/documents/indexDocument';
import { requireAdmin } from '@/lib/security/adminAuth';

export async function POST(req: Request) {
  try {
    const adminCheck = requireAdmin(req);
    if (!adminCheck.ok) {
      return adminCheck.response;
    }

    const body = await req.json().catch(() => null);
    const itemId = body && typeof body === 'object' && typeof body.itemId === 'string' ? body.itemId.trim() : '';

    if (!itemId) {
      return NextResponse.json({ ok: false, error: 'invalid_item', message: 'Falta un identificador de documento válido.' }, { status: 400 });
    }

    // Find DocumentVersion associated with this item
    const docVersions = await prisma.documentVersion.findMany({
      where: { sourceItemId: itemId }
    });

    if (docVersions.length === 0) {
      return NextResponse.json({ ok: false, error: 'document_not_found', message: 'No hay una versión indexable para este documento.' }, { status: 404 });
    }

    let totalChunks = 0;
    
    // Index each document version found
    for (const dv of docVersions) {
      const result = await indexDocumentVersion(dv.id);
      totalChunks += result.chunks;
    }

    return NextResponse.json({
      ok: true,
      chunks: totalChunks
    });
  } catch (error: unknown) {
    console.error('API /api/admin/reindex-document error:', error instanceof Error ? error.message : String(error));
    return NextResponse.json(
      { ok: false, error: 'reindex_failed', message: 'No fue posible reindexar el documento.' },
      { status: 500 }
    );
  }
}

