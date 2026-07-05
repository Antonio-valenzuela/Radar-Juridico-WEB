import { NextResponse } from 'next/server';
import { createWeeklyDigest } from '@/lib/digest/storeDigest';
import { requireAdmin } from '@/lib/security/adminAuth';

export async function POST(req: Request) {
  try {
    const adminCheck = requireAdmin(req);
    if (!adminCheck.ok) {
      return adminCheck.response;
    }

    const result = await createWeeklyDigest(7);

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('API /api/admin/run-weekly-digest error:', error);
    return NextResponse.json(
      { ok: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

