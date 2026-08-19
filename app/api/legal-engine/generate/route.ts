import { NextRequest, NextResponse } from 'next/server';
import { runGenerationPipeline } from '@/lib/legal-engine/pipeline';
import { UploadedSourceDocument, UniversalLegalDocument } from '@/lib/legal-engine/types';
import { requireLawyerAccess } from '@/lib/security/lawyerAuth';
import { LawyerProfile } from '@/lib/workspace/lawyerProfileTypes';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  console.log('[LegalEngine][Generate] START');
  const auth = await requireLawyerAccess(req);
  if (!auth.ok) {
    console.log('[LegalEngine][Generate] RESPONSE_SENT: auth failure');
    return auth.response;
  }

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

    console.log('[LegalEngine][Generate] DOCUMENT_BUILT');

    // Honestidad de IA: si la redacción no fue producida por un proveedor de IA
    // real (la cadena cayó al generador local), NO se devuelve un documento
    // aparentemente terminado.
    const meta = generatedDoc.generationMetadata;
    if (meta?.aiUsed !== true) {
      console.log('[LegalEngine][Generate] RESPONSE_SENT: error, AI not used (fallback to local)');
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

    console.log('[LegalEngine][Generate] RESPONSE_SENT: success');
    return NextResponse.json({ ok: true, document: generatedDoc });
  } catch (error: any) {
    console.error('Error in generate API:', error);
    console.log('[LegalEngine][Generate] RESPONSE_SENT: error exception');
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}