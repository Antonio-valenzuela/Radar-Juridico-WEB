import { NextRequest, NextResponse } from 'next/server';
import { exportUniversalToDocx } from '@/lib/legal-engine/exportDocxUniversal';
import { UniversalLegalDocument } from '@/lib/legal-engine/types';
import { requireLawyerAccess } from '@/lib/security/lawyerAuth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const auth = await requireLawyerAccess(req);
  if (!auth.ok) return auth.response;

  try {
    const body = await req.json();
    const { document } = body;

    if (!document) {
      return NextResponse.json({ ok: false, error: 'Falta el documento a exportar.' }, { status: 400 });
    }

    const buffer = await exportUniversalToDocx(document as UniversalLegalDocument);

    const fileName = `${(document as UniversalLegalDocument).title || 'documento_generado'}`.replace(/[^a-z0-9]+/gi, '_').toLowerCase();

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="${fileName}.docx"`,
      },
    });
  } catch (error: any) {
    console.error('Error exporting DOCX:', error);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}