import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const sources = await prisma.officialSource.findMany({
      where: {
        isActive: true,
        OR: [
          { type: { in: ['court', 'gazette', 'custom_official', 'dof', 'scjn', 'cjf'] } },
          { slug: { contains: 'boletin' } },
          { slug: { contains: 'jalisco' } },
          { slug: { contains: 'cjf' } },
          { slug: { contains: 'federal' } },
        ],
      },
      select: {
        id: true,
        name: true,
        slug: true,
        type: true,
        jurisdiction: true,
        state: true,
        matter: true,
        description: true,
        baseUrl: true,
        requiresBrowser: true,
        trustLevel: true,
      },
      orderBy: { name: 'asc' },
    });

    if (sources.length === 0) {
      const fallbackSources = [
        {
          id: 'source-jalisco-boletin',
          name: 'Boletín Judicial del Estado de Jalisco (CJJ)',
          slug: 'boletin-jalisco',
          type: 'court',
          jurisdiction: 'Estatal',
          state: 'Jalisco',
          matter: 'Civil / Familiar / Mercantil',
          description: 'Portal del Consejo de la Judicatura del Estado de Jalisco (nilo.cjj.gob.mx)',
          baseUrl: 'https://ciudadano.cjj.gob.mx/boletin_judicial/consultar',
          requiresBrowser: false,
          trustLevel: 'official',
        },
        {
          id: 'source-federal-boletin',
          name: 'Boletín Judicial Federal (PJF / CJF)',
          slug: 'boletin-federal',
          type: 'court',
          jurisdiction: 'Federal',
          state: 'Nacional',
          matter: 'Amparo / Federal',
          description: 'Boletín del Consejo de la Judicatura Federal y Juzgados de Distrito',
          baseUrl: 'https://sise.cjf.gob.mx/SiseInternet/default.aspx',
          requiresBrowser: true,
          trustLevel: 'official',
        },
        {
          id: 'source-cjf-sise',
          name: 'Listas de Acuerdos del CJF / SISE',
          slug: 'cjf-sise',
          type: 'cjf',
          jurisdiction: 'Federal',
          state: 'Nacional',
          matter: 'Amparo / Procesal',
          description: 'Sistema Integral de Seguimiento de Expedientes del CJF',
          baseUrl: 'https://www.cjf.gob.mx/consultas.htm',
          requiresBrowser: true,
          trustLevel: 'official',
        },
      ];
      return NextResponse.json({ ok: true, sources: fallbackSources });
    }

    return NextResponse.json({ ok: true, sources });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: 'Error al consultar catálogo de fuentes de boletín.' },
      { status: 500 }
    );
  }
}
