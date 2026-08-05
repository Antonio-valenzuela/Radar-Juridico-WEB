import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { runDeepReviewMode } from '@/lib/ai/orchestrator';
import { resolveTemplateForReview, TemplateStructureSchema, DeepReviewResponse } from '@/lib/templates/templateReview';

const ReviewDeepSchema = z.object({
  templateId: z.string().min(1),
  values: z.record(z.string(), z.any()).optional().default({}),
  structureJson: TemplateStructureSchema.optional(),
});

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = ReviewDeepSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({
        revisionLegal: '',
        revisionRedaccion: '',
        revisionProcesal: '',
        riesgos: [`Payload inválido: ${parsed.error.message}`],
      } as DeepReviewResponse, { status: 400 });
    }

    const { templateId, values, structureJson } = parsed.data;
    const template = resolveTemplateForReview(templateId, structureJson || undefined);
    if (!template) {
      return NextResponse.json({
        revisionLegal: '',
        revisionRedaccion: '',
        revisionProcesal: '',
        riesgos: [`No se encontró la plantilla con id ${templateId}.`],
      } as DeepReviewResponse, { status: 404 });
    }

    const activeDocument = {
      templateId: template.id,
      templateName: template.title,
      documentType: template.documentType || 'machote',
      matter: template.category,
      jurisdiction: 'federal',
      fields: values || {},
      pendingMarkers: [] as string[],
    };

    const deepResult = await runDeepReviewMode({
      userMessage: 'Revisión profunda del machote jurídico actual.',
      mode: 'deep',
      taskType: 'document_review',
      legalContext: activeDocument,
      retrievedSources: [],
    });

    const revisionLegal = deepResult.summary || 'No se obtuvo resumen legal.';
    const revisionRedaccion = deepResult.issues && deepResult.issues.length > 0
      ? deepResult.issues.map((issue) => `${issue.title}: ${issue.suggestedText || issue.explanation}`).join('\n')
      : 'No se identificaron cambios de redacción críticos.';
    const revisionProcesal = deepResult.contradictions && deepResult.contradictions.length > 0
      ? deepResult.contradictions.join('\n')
      : 'No se detectaron contradicciones procesales evidentes.';
    const riesgos = [
      ...(deepResult.issues?.filter((issue) => issue.severity === 'critical').map((issue) => issue.title) || []),
      ...(deepResult.contradictions || []),
      ...(deepResult.unsupportedClaims || []),
    ].filter(Boolean);

    return NextResponse.json({
      revisionLegal,
      revisionRedaccion,
      revisionProcesal,
      riesgos,
    } as DeepReviewResponse);
  } catch (error: any) {
    return NextResponse.json({
      revisionLegal: '',
      revisionRedaccion: '',
      revisionProcesal: '',
      riesgos: [error.message || 'Error interno durante la revisión profunda.'],
    } as DeepReviewResponse, { status: 500 });
  }
}
