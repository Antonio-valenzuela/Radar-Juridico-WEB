// app/api/search/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { hybridSearch } from '@/lib/search/hybridSearch';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    
    const query = searchParams.get('q') || '';
    
    // Soporta múltiples formatos: ?fuente=DOF&fuente=SCJN  O  ?fuente=DOF,SCJN
    const parseFilter = (key: string): string[] | undefined => {
      const all = searchParams.getAll(key);
      if (all.length === 0) return undefined;
      const parsed = all.flatMap(val => val.split(',')).map(v => v.trim()).filter(Boolean);
      return parsed.length > 0 ? parsed : undefined;
    };

    const fuente = parseFilter('fuente');
    const materia = parseFilter('materia');
    const tipo = parseFilter('tipo');
    const fecha_desde = searchParams.get('fecha_desde') || undefined;
    const fecha_hasta = searchParams.get('fecha_hasta') || undefined;
    const confianza = searchParams.get('confianza') || undefined;
    const limit = parseInt(searchParams.get('limit') || '10');

    const results = await hybridSearch(query, {
      fuente,
      materia,
      tipo,
      fecha_desde,
      fecha_hasta,
      confianza
    }, limit);

    return NextResponse.json({ ok: true, results });
  } catch (error: any) {
    console.error('[api/search] GET error:', error);
    return NextResponse.json(
      { ok: false, error: 'server_error', message: 'Error interno al ejecutar la búsqueda.' },
      { status: 500 }
    );
  }
}
