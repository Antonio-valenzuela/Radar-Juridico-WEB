import { NextRequest, NextResponse } from 'next/server';
import { buildStructure } from '@/lib/legal-engine/structureBuilder';
import { ClassificationResult } from '@/lib/legal-engine/types';
import { checkRateLimit, extractIp } from '@/lib/security/rateLimit';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const ip = extractIp(req);
    const rateLimitResult = checkRateLimit(ip, 30);
    if (!rateLimitResult.ok) {
      return NextResponse.json(
        { ok: false, error: 'rate_limit', friendlyMessage: 'Demasiadas solicitudes.' },
        { status: 429 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const { classification } = body as { classification: ClassificationResult };

    if (!classification || !classification.documentType) {
      return NextResponse.json(
        { ok: false, error: 'invalid_input', message: 'La clasificación es obligatoria.' },
        { status: 400 }
      );
    }

    const sections = buildStructure(classification);

    return NextResponse.json({
      ok: true,
      sections,
    });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error.message || 'Error al construir la estructura.' },
      { status: 500 }
    );
  }
}
