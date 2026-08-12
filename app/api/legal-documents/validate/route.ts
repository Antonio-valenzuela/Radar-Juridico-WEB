import { NextRequest, NextResponse } from 'next/server';
import { validateDocument } from '@/lib/legal-engine/validator';
import { UniversalLegalDocument } from '@/lib/legal-engine/types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { document } = body as { document: UniversalLegalDocument };

    if (!document || !document.sections) {
      return NextResponse.json(
        { ok: false, error: 'invalid_document', message: 'El documento a validar es obligatorio.' },
        { status: 400 }
      );
    }

    const validationResult = validateDocument(document);

    return NextResponse.json({
      ok: true,
      validation: validationResult,
    });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error.message || 'Error al validar el documento.' },
      { status: 500 }
    );
  }
}
