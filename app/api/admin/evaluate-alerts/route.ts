import { NextResponse } from 'next/server';
import { evaluateAlertsForItem } from '@/lib/alerts/evaluateAlerts';
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

    const result = await evaluateAlertsForItem(itemId);

    return NextResponse.json({
      ok: true,
      matches: result.matches
    });
  } catch (error: any) {
    console.error('API /api/admin/evaluate-alerts error:', error);
    return NextResponse.json(
      { ok: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

