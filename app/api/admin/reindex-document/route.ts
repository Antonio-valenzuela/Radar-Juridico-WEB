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

    const body = await req.json();
    const { itemId } = body;

    if (!itemId) {
      return NextResponse.json({ ok: false, error: 'itemId is required' }, { status: 400 });
    }

    // Find DocumentVersion associated with this item
    const docVersions = await prisma.documentVersion.findMany({
      where: { sourceItemId: itemId }
    });

    if (docVersions.length === 0) {
      return NextResponse.json({ ok: false, error: 'No DocumentVersion found for this itemId' }, { status: 404 });
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
  } catch (error: any) {
    console.error('API /api/admin/reindex-document error:', error);
    return NextResponse.json(
      { ok: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

