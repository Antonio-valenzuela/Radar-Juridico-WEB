import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(_request: NextRequest) {
  return NextResponse.json(
    { ok: false, error: 'Funcionalidad de plantillas personalizadas no disponible temporalmente (501 Not Implemented).' },
    { status: 501 }
  );
}

export async function POST(_request: NextRequest) {
  return NextResponse.json(
    { ok: false, error: 'Funcionalidad de plantillas personalizadas no disponible temporalmente (501 Not Implemented).' },
    { status: 501 }
  );
}

/*
// Código original reservado para cuando se aplique el esquema del modelo de plantillas personalizadas:
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireCaseAccess } from '@/lib/cases/access';

const customTemplateSchema = z.object({
  title: z.string().min(1),
  category: z.string().min(1),
  legalBasis: z.string().optional(),
  documentType: z.string().min(1),
  description: z.string().optional(),
  applicableLaws: z.array(z.string()).optional(),
  warnings: z.array(z.string()).optional(),
  disclaimer: z.string().optional(),
  exportFormats: z.array(z.string()).optional(),
  structureJson: z.any().optional(),
  originalText: z.string().optional(),
  sourceFileName: z.string().optional(),
  content: z.string().optional(),
});
*/
