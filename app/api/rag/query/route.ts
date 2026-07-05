import { NextResponse } from 'next/server';
import { answerQuestion } from '@/lib/rag/answer';
import { requireAdmin } from '@/lib/security/adminAuth';
import { checkRateLimit, extractIp } from '@/lib/security/rateLimit';
import { connection } from '@/lib/queue';

export async function GET(req: Request) {
  try {
    const adminCheck = requireAdmin(req);
    if (!adminCheck.ok) {
      return adminCheck.response;
    }

    const provider = (process.env.LLM_PROVIDER || 'gemini').toLowerCase().trim();
    let model = 'N/A';
    if (provider === 'gemini') model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
    else if (provider === 'groq') model = process.env.GROQ_MODEL || 'llama-3.1-8b-instant';
    else if (provider === 'openrouter') model = process.env.OPENROUTER_MODEL || 'openai/gpt-oss-20b:free';

    const limit = 20;
    let used = 0;
    try {
      const todayStr = new Date().toISOString().split('T')[0];
      const redisKey = `rag:attempts:${todayStr}`;
      const val = await connection.get(redisKey);
      used = val ? Number(val) : 0;
    } catch {
      const globalVal = (globalThis as any);
      used = globalVal.ragAttemptsMemory || 0;
    }
    const remaining = Math.max(0, limit - used);

    return NextResponse.json({
      ok: true,
      provider,
      model,
      attempts: { limit, used, remaining }
    });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const adminCheck = requireAdmin(req);
    if (!adminCheck.ok) {
      return adminCheck.response;
    }

    const ip = extractIp(req);
    const rateLimit = checkRateLimit(ip);
    if (!rateLimit.ok) {
      return NextResponse.json({ ok: false, error: "too many requests" }, { status: 429, headers: rateLimit.headers });
    }

    const body = await req.json();
    const { question, limit } = body;

    if (!question) {
      return NextResponse.json({ ok: false, error: 'Question is required' }, { status: 400 });
    }

    const result = await answerQuestion(question, limit || 5);

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('API /api/rag/query error:', error);
    return NextResponse.json(
      { ok: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
