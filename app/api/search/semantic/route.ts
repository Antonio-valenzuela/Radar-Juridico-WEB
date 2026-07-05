import { NextResponse } from 'next/server';
import { semanticSearch } from '@/lib/search/semanticSearch';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { query, limit } = body;

    if (!query) {
      return NextResponse.json({ ok: false, error: 'Query is required' }, { status: 400 });
    }

    const results = await semanticSearch(query, limit || 10);

    return NextResponse.json({
      ok: true,
      results
    });
  } catch (error: any) {
    console.error('API /api/search/semantic error:', error);
    return NextResponse.json(
      { ok: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
