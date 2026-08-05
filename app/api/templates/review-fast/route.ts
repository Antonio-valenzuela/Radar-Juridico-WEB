import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { resolveTemplateForReview, validateValuesAgainstTemplate, TemplateStructureSchema, FastReviewResponse } from '@/lib/templates/templateReview';

const ReviewFastSchema = z.object({
  templateId: z.string().min(1),
  values: z.record(z.string(), z.any()).optional().default({}),
  structureJson: TemplateStructureSchema.optional(),
});

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = ReviewFastSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({
        estado: 'format_errors',
        camposFaltantes: [],
        erroresFormato: ['Payload inválido.'],
        recomendaciones: [parsed.error.message],
      } as FastReviewResponse, { status: 400 });
    }

    const { templateId, values, structureJson } = parsed.data;
    const template = resolveTemplateForReview(templateId, structureJson || undefined);
    if (!template) {
      return NextResponse.json({
        estado: 'format_errors',
        camposFaltantes: [],
        erroresFormato: [`No se encontró la plantilla con id ${templateId}.`],
        recomendaciones: ['Proporciona un templateId válido o una estructura JSON para la plantilla.'],
      } as FastReviewResponse, { status: 404 });
    }

    const review = validateValuesAgainstTemplate(template, values || {});

    return NextResponse.json(review as FastReviewResponse);
  } catch (error: any) {
    return NextResponse.json({
      estado: 'format_errors',
      camposFaltantes: [],
      erroresFormato: [error.message || 'Error interno al revisar el machote.'],
      recomendaciones: ['Intenta de nuevo o contacta al equipo de soporte.'],
    } as FastReviewResponse, { status: 500 });
  }
}
