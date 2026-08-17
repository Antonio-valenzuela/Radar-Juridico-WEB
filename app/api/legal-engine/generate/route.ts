import { NextRequest, NextResponse } from 'next/server';
import { runGenerationPipeline } from '@/lib/legal-engine/pipeline';
import { UploadedSourceDocument, UniversalLegalDocument } from '@/lib/legal-engine/types';
import { requireLawyerAccess } from '@/lib/security/lawyerAuth';
import { LawyerProfile } from '@/lib/workspace/lawyerProfileTypes';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const auth = await requireLawyerAccess(req);
  if (!auth.ok) return auth.response;

  try {
    const body = await req.json();
    const {
      userInstruction,
      sourceDocuments,
      allowUnvalidatedSource,
      referenceDocumentText,
      referenceDocumentId,
      matter,
      documentTypeLabel,
      existingDocument,
      lawyerProfile,
    } = body;

    const generatedDoc = await runGenerationPipeline(
      {
        userInstruction,
        sourceDocuments: sourceDocuments as UploadedSourceDocument[],
        allowUnvalidatedSource: allowUnvalidatedSource || true,
        referenceDocumentText: referenceDocumentText as string | undefined,
        referenceDocumentId: referenceDocumentId as string | undefined,
        matter: matter as string | undefined,
        documentTypeLabel: documentTypeLabel as string | undefined,
        existingDocument: existingDocument as UniversalLegalDocument | undefined,
        lawyerProfile: lawyerProfile as LawyerProfile | undefined,
      },
      {}
    );

    // Honestidad de IA: si la redacción no fue producida por un proveedor de IA
    // real (la cadena cayó al generador local), NO se devuelve un documento
    // aparentemente terminado.
    const meta = generatedDoc.generationMetadata;
    if (meta?.aiUsed !== true) {
      return NextResponse.json(
        {
          ok: false,
          error: 'GENERACIÓN IA NO DISPONIBLE',
          aiStatus: 'UNAVAILABLE',
          provider: meta?.aiProvider || null,
          model: meta?.aiModel || null,
          reason: meta?.aiError || 'Ningún proveedor de IA configurado respondió.',
        },
        { status: 503 }
      );
    }

    return NextResponse.json({ ok: true, document: generatedDoc });
  } catch (error: any) {
    console.error('Error in generate API:', error);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}