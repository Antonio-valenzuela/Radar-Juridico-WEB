import { NextResponse } from 'next/server';
import { hybridSearch } from '@/lib/search/hybridSearch';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { query, limit, filters } = body;

    if (!query) {
      return NextResponse.json({ ok: false, error: 'Query is required' }, { status: 400 });
    }

    const results = await hybridSearch({
      query,
      limit: limit || 10,
      filters
    });

    return NextResponse.json({
      ok: true,
      results
    });
  } catch (error: any) {
    console.error('API /api/search/hybrid error:', error);
    return NextResponse.json(
      { ok: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
