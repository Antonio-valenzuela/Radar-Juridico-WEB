import { NextRequest, NextResponse } from 'next/server';
import { classifyIntent } from '@/lib/legal-engine/classifier';
import { checkRateLimit, extractIp } from '@/lib/security/rateLimit';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const ip = extractIp(req);
    const rateLimitResult = checkRateLimit(ip, 30);
    if (!rateLimitResult.ok) {
      return NextResponse.json(
        { ok: false, error: 'rate_limit', friendlyMessage: 'Demasiadas solicitudes. Por favor intente más tarde.' },
        { status: 429 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const { text = '' } = body;

    if (!text || typeof text !== 'string') {
      return NextResponse.json(
        { ok: false, error: 'invalid_input', message: 'El texto de instrucción es obligatorio.' },
        { status: 400 }
      );
    }

    const classification = classifyIntent(text);

    return NextResponse.json({
      ok: true,
      classification,
    });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error.message || 'Error al clasificar la intención.' },
      { status: 500 }
    );
  }
}
