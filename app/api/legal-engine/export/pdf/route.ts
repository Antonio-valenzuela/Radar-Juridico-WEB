import { NextRequest, NextResponse } from 'next/server';
import { generatePrintHtml } from '@/lib/templates/exportPdf';
import { requireLawyerAccess } from '@/lib/security/lawyerAuth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const auth = await requireLawyerAccess(req);
  if (!auth.ok) return auth.response;

  try {
    const body = await req.json();
    const { documentType, documentTitle, dateStr, renderedSections } = body;

    if (!Array.isArray(renderedSections)) {
      return NextResponse.json({ ok: false, error: 'Falta renderedSections en el payload.' }, { status: 400 });
    }

    const renderedDoc = {
      title: documentTitle,
      header: documentType,
      body: renderedSections.map((s: any) => s.content).join('\n\n'),
      sections: renderedSections,
      footer: 'Documento redactado con Radar Jurídico',
      warnings: [],
      disclaimer: '',
      generatedAt: dateStr,
    };

    const html = generatePrintHtml(renderedDoc);

    // Intento 1: PDF REAL generado en servidor con Chromium (Playwright).
    try {
      const { chromium } = await import('playwright');
      const browser = await chromium.launch({ headless: true });
      try {
        const page = await browser.newPage({ format: 'Letter' } as any);
        await page.setContent(html, { waitUntil: 'networkidle' });
        const pdfBuffer = await page.pdf({
          format: 'Letter',
          printBackground: true,
          margin: { top: '0.6in', right: '0.7in', bottom: '0.6in', left: '0.7in' },
        });
        return new NextResponse(new Uint8Array(pdfBuffer), {
          headers: {
            'Content-Type': 'application/pdf',
            'Content-Disposition': `attachment; filename="${(documentTitle || 'escrito').replace(/[^a-z0-9]/gi, '_').slice(0, 80)}.pdf"`,
            'X-Export-Method': 'pdf',
          },
        });
      } finally {
        await browser.close();
      }
    } catch (err: any) {
      console.warn('[export/pdf] Chromium no disponible, devolviendo PRINT PREVIEW:', err.message);
    }

    // Intento 2 (fallback honesto): HTML de impresión marcado explícitamente como PRINT PREVIEW.
    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html',
        'X-Export-Method': 'print-preview',
        'X-Export-Method-Note': 'PDF real no disponible en el servidor; use la vista de impresión del navegador.',
      },
    });
  } catch (error: any) {
    console.error('Error exporting PDF HTML:', error);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}