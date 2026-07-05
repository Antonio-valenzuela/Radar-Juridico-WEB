// app/api/rag/chat/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { generateRAGAnswer } from '@/lib/rag/answer';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    if (!body || !body.question) {
      return NextResponse.json(
        { ok: false, error: 'bad_request', message: 'La pregunta (question) es requerida.' },
        { status: 400 }
      );
    }

    const { question } = body;
    const answer = await generateRAGAnswer(question);

    return NextResponse.json(answer);
  } catch (error: any) {
    console.error('[api/rag/chat] POST error:', error);
    return NextResponse.json(
      { ok: false, error: 'server_error', message: 'Error interno al procesar el chat RAG.' },
      { status: 500 }
    );
  }
}
