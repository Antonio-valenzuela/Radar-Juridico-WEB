import { describe, it, expect } from 'vitest';
import { readFileSync, writeFileSync } from 'fs';
import { runGenerationPipeline } from '../../lib/legal-engine/pipeline';
import { runQualityGateCheck } from '../../lib/legal-engine/qualityGate';
import { createSourceDocument } from '../../lib/legal-engine/context';

const BASE = 'http://localhost:3100';

async function upload(filePath: string, mime: string, name: string) {
  const buf = readFileSync(filePath);
  const fd = new FormData();
  fd.append('file', new Blob([buf], { type: mime }), name);
  const res = await fetch(`${BASE}/api/templates/analyze-upload`, { method: 'POST', body: fd });
  return res.json();
}

describe('E2E cadena real (caso + machote reales)', () => {
  it('pipeline + quality gate + métricas + DOCX + PDF real + persistencia', async () => {
    const caso = await upload('C:/Users/yahir/AppData/Local/Temp/opencode/real-docs/0129000036717288006AST.PDF', 'application/pdf', '0129000036717288006AST.PDF');
    const machote = await upload('C:/Users/yahir/AppData/Local/Temp/opencode/real-docs/machote-real.pdf', 'application/pdf', 'machote-real.pdf');

    expect(caso.ok).toBe(true);
    expect(machote.ok).toBe(true);
    console.log('[E2E] caso:', caso.qualityScore.pageCount, 'págs', caso.qualityScore.textLength, 'chars', caso.sourceValidationMethod);
    console.log('[E2E] machote:', machote.qualityScore.pageCount, 'págs', machote.qualityScore.textLength, 'chars', machote.sourceValidationMethod);

    const sourceDoc = createSourceDocument({
      id: 'caso-real-800-2024',
      filename: caso.sourceFileName,
      name: caso.sourceFileName,
      sourceValidated: caso.sourceValidated,
      sourceValidationMethod: caso.sourceValidationMethod,
      pages: caso.pages,
      extractedText: caso.extractedText,
      qualityScore: caso.qualityScore,
    });

    const doc = await runGenerationPipeline({
      userInstruction: 'Redactar recurso de revisión contra la ejecutoria que negó el amparo directo 800/2024, con agravios detallados.',
      sourceDocuments: [sourceDoc],
      allowUnvalidatedSource: true,
      referenceDocumentText: machote.extractedText,
      documentTypeLabel: 'Recurso de Revisión',
    });

    const allText = doc.sections.flatMap((s) => s.content.map((b) => b.text)).join('\n\n');
    const words = allText.trim() ? allText.trim().split(/\s+/).length : 0;
    const chars = allText.length;
    const estimatedPages = Math.max(1, Math.ceil(words / 250));
    const blocks = doc.sections.reduce((acc, s) => acc + s.content.length, 0);
    const argumentsCount = doc.sections.filter((s) => s.type === 'argument').length;
    const references = doc.sections.reduce((acc, s) => acc + s.content.reduce((a, b) => a + (b.sources?.length || 0), 0), 0);
    const pendingFields = (allText.match(/\[DATO PENDIENTE/g) || []).length;
    const paragraphs = allText.split(/\n\s*\n/).filter((p) => p.trim()).length;

    console.log('[E2E] estructura del machote aplicada:', doc.sections.length, 'secciones');
    expect(doc.sections.length).toBeGreaterThan(20);

    const qg = runQualityGateCheck(doc, { referenceLength: machote.extractedText.length });
    console.log('[E2E] quality gate:', JSON.stringify(qg.metrics));
    console.log('[E2E] métricas:', `páginas≈${estimatedPages} chars=${chars} palabras=${words} secciones=${doc.sections.length} bloques=${blocks} párrafos=${paragraphs} argumentos=${argumentsCount} referencias=${references} pendientes=${pendingFields}`);

    // DOCX real
    const docxRes = await fetch(`${BASE}/api/legal-engine/export/docx`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ document: doc }),
    });
    const docxBuf = Buffer.from(await docxRes.arrayBuffer());
    expect(docxRes.ok).toBe(true);
    expect(docxBuf.subarray(0, 2).toString('latin1')).toBe('PK');
    writeFileSync('C:/Users/yahir/AppData/Local/Temp/opencode/real-salida.docx', docxBuf);
    console.log('[E2E] DOCX:', docxBuf.length, 'bytes (PK válido)');

    // PDF real
    const pdfPayload = {
      documentType: doc.documentTypeLabel,
      documentTitle: doc.title,
      dateStr: new Date().toISOString(),
      renderedSections: doc.sections.map((s) => ({ title: s.title, content: s.content.map((b) => b.text).join('\n\n') })),
    };
    const pdfRes = await fetch(`${BASE}/api/legal-engine/export/pdf`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(pdfPayload),
    });
    const pdfBuf = Buffer.from(await pdfRes.arrayBuffer());
    const method = pdfRes.headers.get('X-Export-Method');
    const isRealPdf = pdfBuf.subarray(0, 4).toString('latin1') === '%PDF';
    console.log('[E2E] PDF:', `método=${method}`, pdfBuf.length, 'bytes', isRealPdf ? '(%PDF REAL)' : pdfBuf.toString('latin1', 0, 20));
    expect(isRealPdf).toBe(true);
    writeFileSync('C:/Users/yahir/AppData/Local/Temp/opencode/real-salida.pdf', pdfBuf);

    // Persistencia
    const draftRes = await fetch(`${BASE}/api/legal-drafts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: doc.title, documentType: doc.documentType, matter: doc.matter, structuredDoc: doc, status: 'DRAFT' }),
    });
    const draft = await draftRes.json();
    expect(draftRes.ok).toBe(true);
    console.log('[E2E] borrador:', draft.draft?.id);
    const loadRes = await fetch(`${BASE}/api/legal-drafts/${draft.draft.id}`);
    const loaded = await loadRes.json();
    expect(loaded.draft?.structuredDoc?.sections?.length).toBe(doc.sections.length);
    console.log('[E2E] reabierto con', loaded.draft.structuredDoc.sections.length, 'secciones');
  }, 300000);
});