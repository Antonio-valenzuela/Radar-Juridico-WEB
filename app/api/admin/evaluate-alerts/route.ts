import { NextResponse } from 'next/server';
import { evaluateAlertsForItem } from '@/lib/alerts/evaluateAlerts';
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

    const result = await evaluateAlertsForItem(itemId);

    return NextResponse.json({
      ok: true,
      matches: result.matches
    });
  } catch (error: unknown) {
    console.error('API /api/admin/evaluate-alerts error:', error instanceof Error ? error.message : String(error));
    return NextResponse.json(
      { ok: false, error: 'alerts_evaluation_failed', message: 'No fue posible evaluar las alertas.' },
      { status: 500 }
    );
  }
}

