import { readFileSync, writeFileSync } from 'fs';

const BASE = 'http://localhost:3100';
const results: Array<{ paso: string; estado: string; detalle: string }> = [];
const print = (paso: string, estado: string, detalle: string) => {
  results.push({ paso, estado, detalle });
  console.log(`[${estado.toUpperCase()}] ${paso} :: ${detalle.slice(0, 180)}`);
};

async function main() {
  // 1. Analyze upload del PDF demo
  const pdf = readFileSync('scripts/demo/Recurso_Revision_800_2024_Exportado.pdf');
  const fd = new FormData();
  fd.append('file', new Blob([pdf], { type: 'application/pdf' }), 'Recurso_Revision_800_2024_Exportado.pdf');
  const uploadRes = await fetch(`${BASE}/api/templates/analyze-upload`, { method: 'POST', body: fd });
  const upload = await uploadRes.json();
  if (!upload.ok) return print('analyze-upload', 'FALLIDO', JSON.stringify(upload));
  const sourceDoc = {
    id: 'e2e-800-2024',
    filename: upload.sourceFileName,
    type: upload.mimeType,
    extractedText: upload.extractedText,
    pages: upload.pages,
    sourceValidated: upload.sourceValidated,
    sourceValidationMethod: upload.sourceValidationMethod,
    qualityScore: upload.qualityScore,
    warnings: upload.warnings,
  };
  print('analyze-upload', 'OK', `validado=${upload.sourceValidated}, método=${upload.sourceValidationMethod}, páginas=${upload.pages?.length}`);

  // 2. Generación completa
  const genRes = await fetch(`${BASE}/api/legal-engine/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userInstruction: 'Recurso de revisión contra la resolución que niega el amparo, materia laboral.',
      sourceDocuments: [sourceDoc],
      allowUnvalidatedSource: true,
      documentTypeLabel: 'Recurso de Revisión',
    }),
  });
  const gen = await genRes.json();
  if (!gen.ok) return print('generate', 'FALLIDO', `${genRes.status} ${JSON.stringify(gen).slice(0, 300)}`);
  const doc = gen.document;
  print('generate', 'OK', `tipo=${doc.documentTypeLabel}, secciones=${doc.sections?.length}, páginas=${doc.metrics?.estimatedPages ?? doc.sections?.length}`);

  // 3. Regenerar una sección
  const section = doc.sections?.[1];
  if (section) {
    const regRes = await fetch(`${BASE}/api/legal-engine/generate-section`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ document: doc, sectionId: section.id, instruction: 'Profundizar con cita a la ley de amparo' }),
    });
    const reg = await regRes.json();
    print('generate-section', reg.ok ? 'OK' : 'FALLIDO', reg.ok ? `sección=${section.id}, texto=${(reg.text || '').length} chars` : JSON.stringify(reg).slice(0, 200));
  } else {
    print('generate-section', 'SALTADO', 'no hay sección[1]');
  }

  // 4. Export DOCX
  const docxRes = await fetch(`${BASE}/api/legal-engine/export/docx`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ document: doc }),
  });
  const docxBuf = Buffer.from(await docxRes.arrayBuffer());
  if (docxRes.ok) {
    writeFileSync('C:/Users/yahir/AppData/Local/Temp/opencode/e2e-output.docx', docxBuf);
    print('export-docx', 'OK', `${docxBuf.length} bytes`);
  } else {
    print('export-docx', 'FALLIDO', `${docxRes.status} ${docxBuf.toString('utf8').slice(0, 200)}`);
  }

  // 5. Export PDF (mismo shape que el page)
  const pdfPayload = {
    documentType: doc.documentTypeLabel,
    documentTitle: doc.title,
    dateStr: new Date().toISOString(),
    renderedSections: (doc.sections || []).map((s: any) => ({ title: s.title, content: (s.content || []).map((b: any) => b.text).join('\n\n') })),
  };
  const pdfRes = await fetch(`${BASE}/api/legal-engine/export/pdf`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(pdfPayload),
  });
  const pdfBuf = Buffer.from(await pdfRes.arrayBuffer());
  if (pdfRes.ok) {
    writeFileSync('C:/Users/yahir/AppData/Local/Temp/opencode/e2e-output.pdf', pdfBuf);
    print('export-pdf', 'OK', `${pdfBuf.length} bytes`);
  } else {
    print('export-pdf', 'FALLIDO', `${pdfRes.status} ${pdfBuf.toString('utf8').slice(0, 200)}`);
  }

  // 6. Guardar borrador (legal-drafts)
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
      status: doc.status === 'final' ? 'READY_FOR_PROFESSIONAL_REVIEW' : 'DRAFT',
    }),
  });
  const draft = await draftRes.json();
  print('save-draft', draftRes.ok ? 'OK' : 'FALLIDO', draftRes.ok ? `id=${draft.draft?.id}` : JSON.stringify(draft).slice(0, 200));

  // 7. Reabrir borrador
  if (draftRes.ok && draft.draft?.id) {
    const loadRes = await fetch(`${BASE}/api/legal-drafts/${draft.draft.id}`);
    const loaded = await loadRes.json();
    print('load-draft', loadRes.ok ? 'OK' : 'FALLIDO', loadRes.ok ? `secciones=${loaded.draft?.structuredDoc?.sections?.length}` : JSON.stringify(loaded).slice(0, 200));
  }

  writeFileSync('C:/Users/yahir/AppData/Local/Temp/opencode/e2e-results.json', JSON.stringify(results, null, 2));
  const failed = results.filter((r) => r.estado === 'FALLIDO').length;
  console.log(`\n== E2E ${failed === 0 ? 'TODO OK' : `${failed} FALLIDO(S)`} (${results.length} pasos) ==`);
}

main().catch((e) => {
  console.error('E2E CRASH:', e.message);
  process.exit(1);
});