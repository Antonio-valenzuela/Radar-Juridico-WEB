import { readFileSync, writeFileSync } from 'fs';
import { runGenerationPipeline } from '../../lib/legal-engine/pipeline';
import { runQualityGateCheck } from '../../lib/legal-engine/qualityGate';
import { createSourceDocument } from '../../lib/legal-engine/context';

const BASE = 'http://localhost:3100';
const results: Array<{ paso: string; estado: string; detalle: string }> = [];
const print = (paso: string, estado: string, detalle: string) => {
  results.push({ paso, estado, detalle });
  console.log(`[${estado.toUpperCase()}] ${paso} :: ${detalle.slice(0, 240)}`);
};

async function upload(filePath: string, mime: string, name: string) {
  const buf = readFileSync(filePath);
  const fd = new FormData();
  fd.append('file', new Blob([buf], { type: mime }), name);
  const res = await fetch(`${BASE}/api/templates/analyze-upload`, { method: 'POST', body: fd });
  return res.json();
}

async function main() {
  const caso = await upload('C:/Users/yahir/AppData/Local/Temp/opencode/real-docs/0129000036717288006AST.PDF', 'application/pdf', '0129000036717288006AST.PDF');
  const machote = await upload('C:/Users/yahir/AppData/Local/Temp/opencode/real-docs/machote-real.pdf', 'application/pdf', 'machote-real.pdf');

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
  const refText = machote.extractedText;

  const startedAt = Date.now();
  const doc = await runGenerationPipeline({
    userInstruction: 'Redactar recurso de revisión contra la ejecutoria que negó el amparo directo 800/2024, con agravios detallados.',
    sourceDocuments: [sourceDoc],
    allowUnvalidatedSource: true,
    referenceDocumentText: refText,
    documentTypeLabel: 'Recurso de Revisión',
  });
  const genMs = Date.now() - startedAt;

  const allText = doc.sections.flatMap((s) => s.content.map((b) => b.text)).join('\n\n');
  const words = allText.trim() ? allText.trim().split(/\s+/).length : 0;
  const chars = allText.length;
  const estimatedPages = Math.max(1, Math.ceil(words / 250));
  const blocks = doc.sections.reduce((acc, s) => acc + s.content.length, 0);
  const argumentsCount = doc.sections.filter((s) => s.type === 'argument').length;
  const references = doc.sections.reduce((acc, s) => acc + s.content.reduce((a, b) => a + (b.sources?.length || 0), 0), 0);
  const pendingFields = (allText.match(/\[DATO PENDIENTE/g) || []).length;
  const paragraphs = allText.split(/\n\s*\n/).filter((p) => p.trim()).length;

  print('1. pipeline con documentos reales', 'OK',
    `secciones=${doc.sections.length}, generado en ${genMs}ms, aiUsed=${doc.generationMetadata.aiUsed} (esperado false: IA no disponible)`);

  // 2. Quality gate con proporcionalidad contra machote real
  const qg = runQualityGateCheck(doc, { referenceLength: refText.length });
  const underDeveloped = qg.criticalErrors.some((e) => e.checkId === 'UNDERDEVELOPED') || !qg.metrics.isProportional;
  print('2. quality gate proporcional', underDeveloped ? 'FAIL (UNDERDEVELOPED)' : 'OK',
    `generado=${chars} chars vs machote=${refText.length} chars, isProportional=${qg.metrics.isProportional}, score=${qg.qualityScore}, canMarkAsFinal=${qg.canMarkAsFinal}`);

  // 3. Métricas
  print('3. métricas', 'OK',
    `generado: páginas≈${estimatedPages}, chars=${chars}, palabras=${words}, secciones=${doc.sections.length}, bloques=${blocks}, párrafos=${paragraphs}, argumentos=${argumentsCount}, referencias=${references}, [DATO PENDIENTE]=${pendingFields}`);

  // 4. Export DOCX real
  const docxRes = await fetch(`${BASE}/api/legal-engine/export/docx`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ document: doc }),
  });
  const docxBuf = Buffer.from(await docxRes.arrayBuffer());
  if (docxRes.ok) {
    writeFileSync('C:/Users/yahir/AppData/Local/Temp/opencode/real-salida.docx', docxBuf);
    print('4. export DOCX', 'OK', `${docxBuf.length} bytes, header=${docxBuf.subarray(0, 2).toString('latin1') === 'PK' ? 'PK (docx válido)' : 'INVÁLIDO'}`);
  } else {
    print('4. export DOCX', 'FALLIDO', `${docxRes.status} ${docxBuf.toString('utf8').slice(0, 150)}`);
  }

  // 5. Export PDF REAL (server-side Chromium)
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
  print('5. export PDF', isRealPdf ? 'OK' : 'PRINT PREVIEW',
    `método=${method}, ${pdfBuf.length} bytes, header=${isRealPdf ? '%PDF (PDF REAL)' : pdfBuf.toString('latin1', 0, 20)}`);
  if (isRealPdf) writeFileSync('C:/Users/yahir/AppData/Local/Temp/opencode/real-salida.pdf', pdfBuf);

  // 6. Persistencia (guardar + reabrir) con documento real
  const draftRes = await fetch(`${BASE}/api/legal-drafts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: doc.title,
      documentType: doc.documentType,
      matter: doc.matter,
      structuredDoc: doc,
      sourceDocuments: doc.sourceDocuments || null,
      generationMetadata: doc.generationMetadata || null,
      status: 'DRAFT',
    }),
  });
  const draft = await draftRes.json();
  print('6. guardar borrador', draftRes.ok ? 'OK' : 'FALLIDO', draftRes.ok ? `id=${draft.draft?.id}` : JSON.stringify(draft).slice(0, 150));
  if (draftRes.ok) {
    const loadRes = await fetch(`${BASE}/api/legal-drafts/${draft.draft.id}`);
    const loaded = await loadRes.json();
    const secciones = loaded.draft?.structuredDoc?.sections?.length;
    print('7. reabrir borrador', secciones === doc.sections.length ? 'OK' : 'FALLIDO', `secciones=${secciones} (esperado ${doc.sections.length})`);
  }

  writeFileSync('C:/Users/yahir/AppData/Local/Temp/opencode/e2e-pipeline-results.json', JSON.stringify({ results, docMeta: { sections: doc.sections.length, title: doc.title, documentTypeLabel: doc.documentTypeLabel } }, null, 2));
  const failed = results.filter((r) => r.estado.includes('FAIL')).length;
  console.log(`\n== CADENA REAL SERVER-SIDE: ${results.length} pasos, ${failed} FAIL(s) ==`);
}

main().catch((e) => { console.error('CRASH:', e.message); process.exit(1); });