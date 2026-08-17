import { readFileSync, writeFileSync } from 'fs';

const BASE = 'http://localhost:3100';
const CASE_PDF = 'C:/Users/yahir/AppData/Local/Temp/opencode/real-docs/0129000036717288006AST.PDF';
const MACHOTE_PDF = 'C:/Users/yahir/AppData/Local/Temp/opencode/real-docs/machote-real.pdf';

const results: Array<{ paso: string; estado: string; detalle: string }> = [];
const print = (paso: string, estado: string, detalle: string) => {
  results.push({ paso, estado, detalle });
  console.log(`[${estado.toUpperCase()}] ${paso} :: ${detalle.slice(0, 220)}`);
};

async function upload(filePath: string, mime: string, name: string) {
  const buf = readFileSync(filePath);
  const fd = new FormData();
  fd.append('file', new Blob([buf], { type: mime }), name);
  const res = await fetch(`${BASE}/api/templates/analyze-upload`, { method: 'POST', body: fd });
  return { status: res.status, json: await res.json() };
}

async function main() {
  // 1. ANALIZAR EL PDF REAL DEL CASO
  const caso = await upload(CASE_PDF, 'application/pdf', '0129000036717288006AST.PDF');
  if (!caso.json.ok) return print('1. caso: analyze-upload', 'FALLIDO', JSON.stringify(caso.json).slice(0, 300));
  const c = caso.json;
  const okPaginas = c.qualityScore?.pageCount === 27;
  const okChars = c.qualityScore?.textLength >= 56000 && c.qualityScore?.textLength <= 59000;
  const okMetodo = c.sourceValidationMethod === 'native-text' && !c.ocrProvider;
  const text = (c.extractedText || '') + ' ' + (c.pages || []).map((p: any) => p.text).join(' ');
  const checks = {
    paginas27: okPaginas,
    chars57191: okChars,
    nativoSinMock: okMetodo,
    exp800: text.includes('800/2024'),
    tribunal: text.includes('Segundo Tribunal Colegiado'),
    circuito3: text.includes('Tercer Circuito'),
    avalos: /[ÁA]valos/i.test(text) || text.includes('Ávalos'),
    fecha15abril2026: text.includes('15 de abril de 2026'),
    ant226: text.includes('226/2024'),
  };
  const okDeteccion = Object.values(checks).every(Boolean);
  print('1. caso real (AST)', okPaginas && okChars && okMetodo && okDeteccion ? 'OK' : 'FALLIDO',
    `páginas=${c.qualityScore?.pageCount}, chars=${c.qualityScore?.textLength}, método=${c.sourceValidationMethod}, checks=${JSON.stringify(checks)}`);

  // 2. ANALIZAR EL MACHOTE REAL
  const machote = await upload(MACHOTE_PDF, 'application/pdf', 'Recurso_Revision_Amparo_Directo_800-2024_Version_Ampliada (1).pdf');
  if (!machote.json.ok) return print('2. machote: analyze-upload', 'FALLIDO', JSON.stringify(machote.json).slice(0, 300));
  const m = machote.json;
  const mText = m.extractedText || '';
  print('2. machote real', m.sourceValidated === true ? 'OK' : 'FALLIDO',
    `páginas=${m.qualityScore?.pageCount}, chars=${m.qualityScore?.textLength}, método=${m.sourceValidationMethod}, secciones_detectadas=${(m.classification?.secciones_detectadas || []).join('|')}`);

  // 3. ESTRUCTURA DEL MACHOTE: ¿capítulos/numeración? (estructura profunda)
  const estructura = (m.structureJson || m.classification || {});
  print('3. estructura machote', mText.length > 10000 ? 'OK' : 'REVISAR',
    `structureJson=${JSON.stringify(estructura).slice(0, 250)}`);

  // 4. GENERAR con machote real como referencia → honestidad IA
  const sourceDoc = {
    id: 'caso-real-800-2024',
    filename: c.sourceFileName,
    type: c.mimeType,
    extractedText: c.extractedText,
    pages: c.pages,
    sourceValidated: c.sourceValidated,
    sourceValidationMethod: c.sourceValidationMethod,
    qualityScore: c.qualityScore,
    warnings: c.warnings,
  };
  const genRes = await fetch(`${BASE}/api/legal-engine/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userInstruction: 'Redactar recurso de revisión contra la ejecutoria que negó el amparo directo 800/2024, con agravios detallados.',
      sourceDocuments: [sourceDoc],
      allowUnvalidatedSource: true,
      referenceDocumentText: mText.slice(0, 60000),
      referenceDocumentId: null,
      documentTypeLabel: 'Recurso de Revisión',
    }),
  });
  const gen = await genRes.json();
  const aiUnavailable = genRes.status === 503 && gen.error === 'GENERACIÓN IA NO DISPONIBLE';
  print('4. generación IA', aiUnavailable ? 'FAIL (honesto)' : gen.ok ? 'OK' : 'FALLIDO',
    `HTTP ${genRes.status}, error=${gen.error || 'ok'}, provider=${gen.provider || gen.aiProvider || '-'}, model=${gen.model || gen.aiModel || '-'}, reason=${(gen.reason || '').slice(0, 160)}`);

  // 5. ¿Documentos del Caso? (client-side; el server confirma fuente)
  print('5. fuente del caso', c.sourceValidated === true && c.sourceValidationMethod === 'native-text' ? 'OK' : 'FALLIDO',
    `sourceValidated=${c.sourceValidated}, method=${c.sourceValidationMethod}, ocrProvider=${c.ocrProvider || 'ninguno'}`);

  writeFileSync('C:/Users/yahir/AppData/Local/Temp/opencode/e2e-real-results.json', JSON.stringify(results, null, 2));
  const failed = results.filter((r) => r.estado.includes('FAIL')).length;
  console.log(`\n== E2E REAL: ${results.length} pasos, ${failed} FAIL(s) ==`);
}

main().catch((e) => { console.error('CRASH:', e.message); process.exit(1); });