import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function DELETE(_request: NextRequest) {
  return NextResponse.json(
    { ok: false, error: 'Funcionalidad de plantillas personalizadas no disponible temporalmente (501 Not Implemented).' },
    { status: 501 }
  );
}

/*
// Código original reservado para cuando se aplique el esquema del modelo de plantillas personalizadas:
import { prisma } from '@/lib/prisma';
import { requireCaseAccess } from '@/lib/cases/access';
*/
